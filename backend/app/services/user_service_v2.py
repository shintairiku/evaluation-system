from __future__ import annotations

import math
from dataclasses import dataclass
from time import perf_counter
from typing import Dict, Iterable, List, Optional, Sequence, Set
from uuid import UUID

from cachetools import TTLCache

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import BadRequestError, PermissionDeniedError
from ..database.models.user import User as UserModel
from ..database.repositories.user_repository_v2 import UserRepositoryV2
from ..database.repositories.supervisor_review_repository import SupervisorReviewRepository
from ..schemas.common import PaginatedResponse, PaginationParams
from ..schemas.stage_competency import Stage as StageSchema
from ..schemas.user import (
    Department as DepartmentSchema,
    Role as RoleSchema,
    User as UserSchema,
    UserDetailResponse,
    UserStatus,
)
from ..schemas.user_page import (
    UserListPageFilters,
    UserListPageMeta,
    UserListPageResponse,
)
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.rbac_helper import RBACHelper


@dataclass(frozen=True)
class ListUsersResult:
    payload: PaginatedResponse[UserDetailResponse]
    next_cursor: Optional[str]
    approximate_total: bool
    metrics: Dict[str, float]


class UserServiceV2:
    """
    Optimised user listing service that orchestrates batched repository calls and RBAC filtering.
    """

    # Shared across all instances to enable cross-request caching
    _global_page_cache: TTLCache = TTLCache(maxsize=128, ttl=30)
    _filters_cache: TTLCache = TTLCache(maxsize=64, ttl=60)

    DEFAULT_INCLUDES: Set[str] = frozenset({"department", "stage", "roles", "supervisor", "subordinates"})
    MAX_LIMIT = 100

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepositoryV2(session)
        RBACHelper.initialize_with_repository(self.user_repo)
        self._query_count = 0
        self._db_time_ms = 0.0
        # Short-lived in-process cache for hot list responses (per org/filters)
        self._page_cache: TTLCache = UserServiceV2._global_page_cache
        # Shared filters cache across instances to avoid per-request rebuilds
        self._filters_cache: TTLCache = UserServiceV2._filters_cache

    async def list_users(
        self,
        ctx: AuthContext,
        *,
        page: int,
        limit: int,
        cursor: Optional[str] = None,
        search_term: Optional[str] = None,
        statuses: Optional[Sequence[UserStatus]] = None,
        department_ids: Optional[Sequence[UUID]] = None,
        stage_ids: Optional[Sequence[UUID]] = None,
        role_ids: Optional[Sequence[UUID]] = None,
        supervisor_id: Optional[UUID] = None,
        include: Optional[Set[str]] = None,
        with_count: bool = True,
        sort: Optional[str] = None,
    ) -> ListUsersResult:
        cache_key = self._build_cache_key(
            ctx,
            page=page,
            limit=limit,
            cursor=cursor,
            search_term=search_term,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            include=include,
            with_count=with_count,
            sort=sort,
        )
        cached = self._page_cache.get(cache_key)
        if cached:
            return cached

        if not ctx.organization_id:
            raise BadRequestError("Organization context is required")

        include_set = self._normalise_include(include)
        pagination = PaginationParams(page=page, limit=min(limit, self.MAX_LIMIT))
        self._reset_metrics()

        accessible_user_ids = await RBACHelper.get_accessible_user_ids(ctx)
        if accessible_user_ids == []:
            empty_payload = PaginatedResponse.create([], 0, pagination)
            return ListUsersResult(
                payload=empty_payload,
                next_cursor=None,
                approximate_total=False,
                metrics=self._collect_metrics(),
            )

        filtered_user_ids = await self._apply_supervisor_filter(
            accessible_user_ids,
            supervisor_id,
            ctx.organization_id,
        )

        users, next_cursor = await self._timed(
            self.user_repo.list_users_keyset,
            ctx.organization_id,
            pagination.limit,
            cursor=cursor,
            page=pagination.page,
            search_term=search_term,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            user_ids=filtered_user_ids,
            sort=sort,
        )

        total = 0
        approximate_total = False
        if with_count:
            total = await self._timed(
                self.user_repo.count_users,
                ctx.organization_id,
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                supervisor_id=supervisor_id,
                user_ids=filtered_user_ids,
            )
        else:
            total = self._estimate_total(users, pagination)
            approximate_total = True

        response_items = await self._build_response_items(
            users,
            ctx.organization_id,
            include_set,
        )

        payload = PaginatedResponse(
            items=response_items,
            total=total,
            page=pagination.page,
            limit=pagination.limit,
            pages=self._compute_pages(total, pagination.limit),
        )

        result = ListUsersResult(
            payload=payload,
            next_cursor=next_cursor,
            approximate_total=approximate_total,
            metrics=self._collect_metrics(),
        )

        self._page_cache[cache_key] = result
        return result

    async def get_user_list_page(
        self,
        ctx: AuthContext,
        *,
        page: int,
        limit: int,
        cursor: Optional[str] = None,
        search_term: Optional[str] = None,
        statuses: Optional[Sequence[UserStatus]] = None,
        department_ids: Optional[Sequence[UUID]] = None,
        stage_ids: Optional[Sequence[UUID]] = None,
        role_ids: Optional[Sequence[UUID]] = None,
        supervisor_id: Optional[UUID] = None,
        include: Optional[Set[str]] = None,
        with_count: bool = True,
        sort: Optional[str] = None,
    ) -> UserListPageResponse:
        """Page-shaped response for the users list UI: data + filter metadata in one call."""
        users_result = await self.list_users(
            ctx,
            page=page,
            limit=limit,
            cursor=cursor,
            search_term=search_term,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            include=include,
            with_count=with_count,
            sort=sort,
        )

        filters = await self._build_filter_metadata(
            org_id=ctx.organization_id,
            search_term=search_term,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
        )

        meta = UserListPageMeta(
            total=users_result.payload.total,
            page=users_result.payload.page,
            limit=users_result.payload.limit,
            pages=users_result.payload.pages,
            approximate_total=users_result.approximate_total,
            next_cursor=users_result.next_cursor,
        )

        return UserListPageResponse(
            users=users_result.payload.items,
            meta=meta,
            filters=filters,
        )

    async def get_user_detail(
        self,
        ctx: AuthContext,
        user_id: UUID,
        *,
        include: Optional[Set[str]] = None,
    ) -> Optional[UserDetailResponse]:
        if not ctx.organization_id:
            raise BadRequestError("Organization context is required")

        include_set = self._normalise_include(include)
        self._reset_metrics()

        users_map = await self._timed(
            self.user_repo.fetch_users_by_ids,
            [user_id],
            ctx.organization_id,
        )
        user_model = users_map.get(user_id)
        if not user_model:
            return None

        response_items = await self._build_response_items(
            [user_model],
            ctx.organization_id,
            include_set,
        )
        return response_items[0] if response_items else None

    async def get_users_by_ids(
        self,
        ctx: AuthContext,
        user_ids: Sequence[UUID],
        *,
        include: Optional[Set[str]] = None,
    ) -> List[UserDetailResponse]:
        """Batch fetch user details by explicit IDs with RBAC enforcement."""
        if not ctx.organization_id:
            raise BadRequestError("Organization context is required")

        requested_ids: list[UUID] = []
        seen: set[UUID] = set()
        for user_id in user_ids:
            if not user_id or user_id in seen:
                continue
            seen.add(user_id)
            requested_ids.append(user_id)

        if not requested_ids:
            return []

        include_set = self._normalise_include(include or {"department", "stage", "roles"})
        self._reset_metrics()

        accessible_user_ids: Optional[Sequence[UUID]]
        try:
            accessible_user_ids = await RBACHelper.get_accessible_user_ids(ctx)
        except PermissionDeniedError:
            accessible_user_ids = []

        review_access_ids: set[UUID] = set()
        if ctx.user_id and ctx.has_permission(Permission.GOAL_APPROVE):
            review_access_ids = await self._timed(
                SupervisorReviewRepository(self.session).get_subordinate_ids_for_supervisor,
                ctx.user_id,
                ctx.organization_id,
                subordinate_ids=list(requested_ids),
                status="draft",
            )

        if accessible_user_ids == [] and not review_access_ids:
            return []

        if accessible_user_ids is not None:
            accessible_set = set(accessible_user_ids)
            if review_access_ids:
                accessible_set.update(review_access_ids)
            requested_ids = [user_id for user_id in requested_ids if user_id in accessible_set]
            if not requested_ids:
                return []

        users_map = await self._timed(
            self.user_repo.fetch_users_by_ids,
            requested_ids,
            ctx.organization_id,
        )
        ordered_models = [users_map[user_id] for user_id in requested_ids if user_id in users_map]

        return await self._build_response_items(
            ordered_models,
            ctx.organization_id,
            include_set,
        )

    async def _apply_supervisor_filter(
        self,
        accessible_user_ids: Optional[Sequence[UUID]],
        supervisor_id: Optional[UUID],
        org_id: str,
    ) -> Optional[Sequence[UUID]]:
        if not supervisor_id:
            return accessible_user_ids

        subordinate_ids = await self._timed(
            self.user_repo.fetch_subordinate_ids,
            supervisor_id,
            org_id,
        )

        if accessible_user_ids is None:
            return subordinate_ids

        subordinate_set = set(subordinate_ids)
        filtered = [user_id for user_id in accessible_user_ids if user_id in subordinate_set]
        return filtered

    async def _build_response_items(
        self,
        users: Sequence[UserModel],
        org_id: str,
        include: Set[str],
    ) -> List[UserDetailResponse]:
        if not users:
            return []

        user_ids = [user.id for user in users]
        related_ids = set(user_ids)

        supervisor_map: Dict[UUID, UUID] = {}
        supervisor_models: Dict[UUID, UserModel] = {}
        subordinates_models_map: Dict[UUID, List[UserModel]] = {}

        if "supervisor" in include:
            supervisor_map = await self._timed(
                self.user_repo.fetch_supervisors_for_users,
                user_ids,
                org_id,
            )
            supervisor_ids = set(supervisor_map.values())
            if supervisor_ids:
                supervisor_models = await self._timed(
                    self.user_repo.fetch_users_by_ids,
                    supervisor_ids,
                    org_id,
                )
                related_ids.update(supervisor_ids)

        if "subordinates" in include:
            subordinates_models_map = await self._timed(
                self.user_repo.fetch_subordinates_for_users,
                user_ids,
                org_id,
            )
            # Collect subordinate user ids to fetch roles and department/stage
            subordinate_ids: Set[UUID] = set()
            for subs in subordinates_models_map.values():
                for sub in subs:
                    subordinate_ids.add(sub.id)
            if subordinate_ids:
                related_ids.update(subordinate_ids)

        department_ids = {user.department_id for user in users if user.department_id}
        stage_ids = {user.stage_id for user in users if user.stage_id}

        for supervisor in supervisor_models.values():
            if supervisor.department_id:
                department_ids.add(supervisor.department_id)
            if supervisor.stage_id:
                stage_ids.add(supervisor.stage_id)

        # Also include subordinate departments and stages for proper DTO building
        if subordinates_models_map:
            for subs in subordinates_models_map.values():
                for sub in subs:
                    if sub.department_id:
                        department_ids.add(sub.department_id)
                    if sub.stage_id:
                        stage_ids.add(sub.stage_id)

        department_models: Dict[UUID, DepartmentSchema] = {}
        stage_models: Dict[UUID, StageSchema] = {}
        role_models: Dict[UUID, List[RoleSchema]] = {}

        # Only fetch departments if explicitly requested or needed for related relations
        if "department" in include or "supervisor" in include or "subordinates" in include:
            raw_departments = await self._timed(self.user_repo.fetch_departments, department_ids)
            department_models = {
                dep_id: DepartmentSchema.model_validate(model, from_attributes=True)
                for dep_id, model in raw_departments.items()
            }

        # Only fetch stages if explicitly requested or needed for related relations
        if "stage" in include or "supervisor" in include or "subordinates" in include:
            raw_stages = await self._timed(self.user_repo.fetch_stages, stage_ids)
            stage_models = {
                stage_id: StageSchema.model_validate(model, from_attributes=True)
                for stage_id, model in raw_stages.items()
            }

        # Only fetch roles if explicitly requested or needed for supervisor/subordinate relations
        if "roles" in include or "supervisor" in include or "subordinates" in include:
            raw_roles = await self._timed(self.user_repo.fetch_roles_for_users, related_ids, org_id)
            for user_id, roles in raw_roles.items():
                role_models[user_id] = sorted(
                    [RoleSchema.model_validate(role, from_attributes=True) for role in roles],
                    key=lambda role: role.hierarchy_order,
                )

        department_dtos = department_models
        stage_dtos = stage_models
        role_dtos: Dict[UUID, List[RoleSchema]] = role_models

        supervisor_dtos: Dict[UUID, UserSchema] = {}
        if supervisor_models:
            supervisor_dtos = {
                sup_id: self._build_user_schema(supervisor, department_dtos, stage_dtos, role_dtos)
                for sup_id, supervisor in supervisor_models.items()
            }

        response_items: List[UserDetailResponse] = []
        for user in users:
            supervisor = None
            if "supervisor" in include:
                supervisor_id = supervisor_map.get(user.id)
                if supervisor_id:
                    supervisor = supervisor_dtos.get(supervisor_id)

            subordinates = None
            if "subordinates" in include and subordinates_models_map:
                models = subordinates_models_map.get(user.id) or []
                if models:
                    subordinates = [
                        self._build_user_schema(sub, department_dtos, stage_dtos, role_dtos)
                        for sub in models
                    ]

            response_items.append(
                UserDetailResponse(
                    id=user.id,
                    clerk_user_id=user.clerk_user_id,
                    employee_code=user.employee_code,
                    name=user.name,
                    email=user.email,
                    status=UserStatus(user.status),
                    job_title=user.job_title,
                    department=department_dtos.get(user.department_id),
                    stage=stage_dtos.get(user.stage_id),
                    roles=role_dtos.get(user.id, []),
                    supervisor=supervisor,
                    subordinates=subordinates,
                )
            )

        return response_items

    def _build_user_schema(
        self,
        user: UserModel,
        department_map: Dict[UUID, DepartmentSchema],
        stage_map: Dict[UUID, StageSchema],
        role_map: Dict[UUID, List[RoleSchema]],
    ) -> UserSchema:
        return UserSchema(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            employee_code=user.employee_code,
            name=user.name,
            email=user.email,
            status=UserStatus(user.status),
            job_title=user.job_title,
            department_id=user.department_id,
            stage_id=user.stage_id,
            created_at=user.created_at,
            updated_at=user.updated_at,
            department=department_map.get(user.department_id),
            stage=stage_map.get(user.stage_id),
            roles=role_map.get(user.id, []),
        )

    def _normalise_include(self, include: Optional[Iterable[str]]) -> Set[str]:
        if include is None:
            return set(self.DEFAULT_INCLUDES)
        normalised = {part.strip().lower() for item in include for part in item.split(",") if part.strip()}
        if not normalised:
            return set(self.DEFAULT_INCLUDES)
        return normalised

    async def _timed(self, func, *args, **kwargs):
        start = perf_counter()
        result = await func(*args, **kwargs)
        elapsed = (perf_counter() - start) * 1000
        self._db_time_ms += elapsed
        self._query_count += 1
        return result

    def _reset_metrics(self):
        self._query_count = 0
        self._db_time_ms = 0.0

    def _collect_metrics(self) -> Dict[str, float]:
        return {
            "query_count": float(self._query_count),
            "db_time_ms": round(self._db_time_ms, 2),
        }

    def _build_cache_key(
        self,
        ctx: AuthContext,
        *,
        page: int,
        limit: int,
        cursor: Optional[str],
        search_term: Optional[str],
        statuses: Optional[Sequence[UserStatus]],
        department_ids: Optional[Sequence[UUID]],
        stage_ids: Optional[Sequence[UUID]],
        role_ids: Optional[Sequence[UUID]],
        supervisor_id: Optional[UUID],
        include: Optional[Set[str]],
        with_count: bool,
        sort: Optional[str],
    ) -> str:
        def _list(val):
            if val is None:
                return None
            return tuple(sorted(str(v) for v in val))

        return "|".join(
            [
                ctx.organization_id or "_no_org",
                ctx.clerk_user_id or "_no_user",
                str(page),
                str(limit),
                cursor or "_nocursor",
                search_term or "",
                str(_list(statuses)),
                str(_list(department_ids)),
                str(_list(stage_ids)),
                str(_list(role_ids)),
                str(supervisor_id or ""),
                ",".join(sorted(include)) if include else "_noinclude",
                "1" if with_count else "0",
                sort or "",
            ]
        )

    async def _build_filter_metadata(
        self,
        *,
        org_id: str,
        search_term: Optional[str],
        statuses: Optional[Sequence[UserStatus]],
        department_ids: Optional[Sequence[UUID]],
        stage_ids: Optional[Sequence[UUID]],
        role_ids: Optional[Sequence[UUID]],
        supervisor_id: Optional[UUID],
    ) -> UserListPageFilters:
        # Filters are organization-scoped and change infrequently; cache for 60s.
        departments, stages, roles = await self._get_cached_filters(org_id)

        return UserListPageFilters(
            search=search_term,
            statuses=list(statuses) if statuses else None,
            department_ids=list(department_ids) if department_ids else None,
            stage_ids=list(stage_ids) if stage_ids else None,
            role_ids=list(role_ids) if role_ids else None,
            supervisor_id=supervisor_id,
            departments=[
                DepartmentSchema.model_validate(dept, from_attributes=True)
                for dept in departments
            ],
            stages=[
                StageSchema.model_validate(stage, from_attributes=True)
                for stage in stages
            ],
            roles=[
                RoleSchema.model_validate(role, from_attributes=True)
                for role in roles
            ],
        )

    async def _get_cached_filters(self, org_id: str):
        cached = self._filters_cache.get(org_id)
        if cached:
            return cached

        departments = await self._timed(self.user_repo.list_departments_for_org, org_id)
        stages = await self._timed(self.user_repo.list_stages_for_org, org_id)
        roles = await self._timed(self.user_repo.list_roles_for_org, org_id)

        filters_tuple = (departments, stages, roles)
        self._filters_cache[org_id] = filters_tuple
        return filters_tuple

    def _estimate_total(self, users: Sequence[UserModel], pagination: PaginationParams) -> int:
        if not users:
            return (pagination.page - 1) * pagination.limit
        return (pagination.page - 1) * pagination.limit + len(users)

    def _compute_pages(self, total: int, limit: int) -> int:
        if limit <= 0:
            return 0
        return math.ceil(total / limit)
