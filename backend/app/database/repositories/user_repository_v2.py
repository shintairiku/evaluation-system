import base64
import json
import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import func, literal, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlalchemy.orm import aliased

from .base import BaseRepository
from ..models.user import (
    Department,
    Role,
    User,
    UserSupervisor,
    user_roles,
)
from ..models.stage_competency import Stage
from ...schemas.user import UserStatus

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UserListCursor:
    name: str
    user_id: UUID
    direction: str = "asc"

    def encode(self) -> str:
        payload = {"name": self.name, "id": str(self.user_id), "direction": self.direction}
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
        logger.debug("Encoded cursor payload %s -> %s", payload, encoded)
        return encoded

    @staticmethod
    def decode(value: str) -> "UserListCursor":
        try:
            raw = base64.urlsafe_b64decode(value.encode("ascii")).decode("utf-8")
            payload = json.loads(raw)
            cursor = UserListCursor(
                name=payload["name"],
                user_id=UUID(payload["id"]),
                direction=payload.get("direction", "asc"),
            )
            logger.debug("Decoded cursor %s -> %s", value, cursor)
            return cursor
        except Exception as exc:  # pragma: no cover - defensive branch
            logger.warning("Failed to decode cursor %s: %s", value, exc)
            raise ValueError("Invalid cursor") from exc


class UserRepositoryV2(BaseRepository[User]):
    """
    Optimised read-only repository for the v2 users list endpoint.
    Provides keyset pagination helpers and batched relation fetches.
    """

    DEFAULT_SORT_FIELD = "name"
    DEFAULT_SORT_DIRECTION = "asc"

    SUPPORTED_SORT_FIELDS = {
        "name": User.name,
        "last_name": User.name,  # alias for UI compatibility
        "created_at": User.created_at,
    }

    def __init__(self, session: AsyncSession):
        super().__init__(session, User)

    async def list_users_keyset(
        self,
        org_id: str,
        limit: int,
        *,
        cursor: Optional[str] = None,
        page: int = 1,
        search_term: Optional[str] = None,
        statuses: Optional[Sequence[UserStatus]] = None,
        department_ids: Optional[Sequence[UUID]] = None,
        stage_ids: Optional[Sequence[UUID]] = None,
        role_ids: Optional[Sequence[UUID]] = None,
        supervisor_id: Optional[UUID] = None,
        user_ids: Optional[Sequence[UUID]] = None,
        sort: Optional[str] = None,
    ) -> Tuple[List[User], Optional[str]]:
        """
        Return a page of users ordered deterministically using keyset pagination.

        Args:
            org_id: Organisation scope
            limit: Max number of users to return
            cursor: Optional opaque cursor representing the last seen record
            page: Page number (1-based). Used to iterate keyset when cursor absent.
            search_term / statuses / department_ids / stage_ids / role_ids: Filters
            supervisor_id: Filter by supervisor relationship
            user_ids: Optional RBAC scoping list
            sort: Sort definition, e.g. "name:asc" or "created_at:desc"

        Returns:
            list[User]: Ordered user models (relationships stay unloaded)
            next_cursor (str | None): opaque cursor for the next page
        """

        actual_limit = max(1, min(limit, 100))
        sort_field, sort_direction = self._parse_sort(sort)
        base_cursor = UserListCursor.decode(cursor) if cursor else None

        logger.debug(
            "Listing users (org=%s, limit=%s, page=%s, cursor=%s, sort=%s %s)",
            org_id,
            actual_limit,
            page,
            base_cursor,
            sort_field.key,
            sort_direction,
        )

        current_cursor = base_cursor
        target_page = max(page, 1)

        # Iterate using keyset pagination until reaching desired page
        for _ in range(1, target_page):
            batch, next_cursor = await self._fetch_page(
                org_id,
                actual_limit,
                cursor=current_cursor,
                search_term=search_term,
                statuses=statuses,
                department_ids=department_ids,
                stage_ids=stage_ids,
                role_ids=role_ids,
                supervisor_id=supervisor_id,
                user_ids=user_ids,
                sort_column=sort_field,
                sort_direction=sort_direction,
            )
            if not batch or not next_cursor:
                return [], None
            current_cursor = UserListCursor.decode(next_cursor)

        results, next_cursor = await self._fetch_page(
            org_id,
            actual_limit,
            cursor=current_cursor,
            search_term=search_term,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            user_ids=user_ids,
            sort_column=sort_field,
            sort_direction=sort_direction,
        )

        return results, next_cursor

    async def _fetch_page(
        self,
        org_id: str,
        limit: int,
        *,
        cursor: Optional[UserListCursor],
        search_term: Optional[str],
        statuses: Optional[Sequence[UserStatus]],
        department_ids: Optional[Sequence[UUID]],
        stage_ids: Optional[Sequence[UUID]],
        role_ids: Optional[Sequence[UUID]],
        supervisor_id: Optional[UUID],
        user_ids: Optional[Sequence[UUID]],
        sort_column,
        sort_direction: str,
    ) -> Tuple[List[User], Optional[str]]:
        stmt = self._build_base_query(
            org_id,
            search_term=search_term,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            user_ids=user_ids,
        )

        stmt = self._apply_cursor(stmt, cursor, sort_column, sort_direction)

        order_clause = sort_column.asc() if sort_direction == "asc" else sort_column.desc()
        stmt = stmt.order_by(order_clause, User.id.asc() if sort_direction == "asc" else User.id.desc())
        stmt = stmt.limit(limit + 1)

        result = await self.session.execute(stmt)
        rows = list(result.scalars().all())

        if len(rows) == 0:
            return [], None

        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]

        last_user = rows[-1]
        next_cursor = None
        if has_more:
            next_cursor = UserListCursor(
                name=last_user.name or "",
                user_id=last_user.id,
                direction=sort_direction,
            ).encode()

        return rows, next_cursor

    def _build_base_query(
        self,
        org_id: str,
        *,
        search_term: Optional[str],
        statuses: Optional[Sequence[UserStatus]],
        department_ids: Optional[Sequence[UUID]],
        stage_ids: Optional[Sequence[UUID]],
        role_ids: Optional[Sequence[UUID]],
        supervisor_id: Optional[UUID],
        user_ids: Optional[Sequence[UUID]],
    ) -> Select:
        stmt = select(User)
        stmt = self.apply_org_scope_direct(stmt, User.clerk_organization_id, org_id)

        if search_term:
            pattern = f"%{search_term.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.name).like(pattern),
                    func.lower(User.employee_code).like(pattern),
                    func.lower(User.job_title).like(pattern),
                    func.lower(User.email).like(pattern),
                )
            )

        if statuses:
            status_values = [status.value if isinstance(status, UserStatus) else str(status) for status in statuses]
            stmt = stmt.where(User.status.in_(status_values))

        if department_ids:
            stmt = stmt.where(User.department_id.in_(list(department_ids)))

        if stage_ids:
            stmt = stmt.where(User.stage_id.in_(list(stage_ids)))

        if user_ids:
            stmt = stmt.where(User.id.in_(list(user_ids)))

        if role_ids:
            role_exists = (
                select(user_roles.c.user_id)
                .where(
                    user_roles.c.user_id == User.id,
                    user_roles.c.role_id.in_(list(role_ids)),
                )
                .exists()
            )
            stmt = stmt.where(role_exists)

        if supervisor_id:
            supervisor_exists = (
                select(UserSupervisor.user_id)
                .where(
                    UserSupervisor.user_id == User.id,
                    UserSupervisor.supervisor_id == supervisor_id,
                )
                .exists()
            )
            stmt = stmt.where(supervisor_exists)

        return stmt

    def _apply_cursor(self, stmt: Select, cursor: Optional[UserListCursor], sort_column, sort_direction: str) -> Select:
        if not cursor:
            return stmt

        if cursor.direction != sort_direction:
            # Ensure cursors cannot be reused across direction changes
            raise ValueError("Cursor direction mismatch")

        comparator = tuple_(sort_column, User.id)
        cursor_tuple = tuple_(literal(cursor.name), literal(cursor.user_id))

        if sort_direction == "asc":
            stmt = stmt.where(comparator > cursor_tuple)
        else:
            stmt = stmt.where(comparator < cursor_tuple)

        return stmt

    def _parse_sort(self, sort: Optional[str]):
        field_name = self.DEFAULT_SORT_FIELD
        direction = self.DEFAULT_SORT_DIRECTION

        if sort:
            if ":" in sort:
                field_part, direction_part = sort.split(":", 1)
                field_name = field_part.strip().lower() or field_name
                direction = direction_part.strip().lower() or direction
            else:
                field_name = sort.strip().lower()

        if field_name not in self.SUPPORTED_SORT_FIELDS:
            field_name = self.DEFAULT_SORT_FIELD

        if direction not in {"asc", "desc"}:
            direction = self.DEFAULT_SORT_DIRECTION

        sort_column = self.SUPPORTED_SORT_FIELDS[field_name]
        return sort_column, direction

    async def fetch_departments(self, ids: Iterable[UUID]) -> Dict[UUID, Department]:
        id_list = [dept_id for dept_id in set(ids) if dept_id]
        if not id_list:
            return {}
        stmt = select(Department).where(Department.id.in_(id_list))
        result = await self.session.execute(stmt)
        departments = {department.id: department for department in result.scalars().all()}
        return departments

    async def fetch_stages(self, ids: Iterable[UUID]) -> Dict[UUID, Stage]:
        id_list = [stage_id for stage_id in set(ids) if stage_id]
        if not id_list:
            return {}
        stmt = select(Stage).where(Stage.id.in_(id_list))
        result = await self.session.execute(stmt)
        stages = {stage.id: stage for stage in result.scalars().all()}
        return stages

    async def fetch_roles_for_users(self, user_ids: Iterable[UUID]) -> Dict[UUID, List[Role]]:
        id_list = [user_id for user_id in set(user_ids) if user_id]
        if not id_list:
            return {}

        stmt = (
            select(Role, user_roles.c.user_id)
            .join(user_roles, Role.id == user_roles.c.role_id)
            .where(user_roles.c.user_id.in_(id_list))
        )
        result = await self.session.execute(stmt)

        role_map: Dict[UUID, List[Role]] = {}
        for role, user_id in result.all():
            role_map.setdefault(user_id, []).append(role)

        return role_map

    async def fetch_supervisors_for_users(self, user_ids: Iterable[UUID], org_id: str) -> Dict[UUID, UUID]:
        id_list = [user_id for user_id in set(user_ids) if user_id]
        if not id_list:
            return {}

        supervisor_alias = aliased(User)
        stmt = (
            select(UserSupervisor.user_id, UserSupervisor.supervisor_id)
            .join(User, UserSupervisor.user_id == User.id)
            .join(supervisor_alias, UserSupervisor.supervisor_id == supervisor_alias.id)
            .where(UserSupervisor.user_id.in_(id_list))
            .where(User.clerk_organization_id == org_id)
            .where(supervisor_alias.clerk_organization_id == org_id)
        )

        result = await self.session.execute(stmt)
        supervisor_map = {row.user_id: row.supervisor_id for row in result}
        return supervisor_map

    async def fetch_subordinate_counts(self, user_ids: Iterable[UUID], org_id: str) -> Dict[UUID, int]:
        id_list = [user_id for user_id in set(user_ids) if user_id]
        if not id_list:
            return {}

        supervisor_alias = aliased(User)
        stmt = (
            select(
                UserSupervisor.supervisor_id,
                func.count(UserSupervisor.user_id).label("subordinate_count"),
            )
            .where(UserSupervisor.supervisor_id.in_(id_list))
            .group_by(UserSupervisor.supervisor_id)
        )
        stmt = (
            stmt.join(User, UserSupervisor.user_id == User.id)
            .join(supervisor_alias, UserSupervisor.supervisor_id == supervisor_alias.id)
            .where(supervisor_alias.clerk_organization_id == org_id)
            .where(User.clerk_organization_id == org_id)
        )

        result = await self.session.execute(stmt)
        counts = {row.supervisor_id: row.subordinate_count for row in result}
        return counts

    async def fetch_subordinate_ids(self, supervisor_id: UUID, org_id: str) -> List[UUID]:
        supervisor_alias = aliased(User)
        stmt = (
            select(UserSupervisor.user_id)
            .join(User, UserSupervisor.user_id == User.id)
            .join(supervisor_alias, UserSupervisor.supervisor_id == supervisor_alias.id)
            .where(UserSupervisor.supervisor_id == supervisor_id)
            .where(User.clerk_organization_id == org_id)
            .where(supervisor_alias.clerk_organization_id == org_id)
        )
        result = await self.session.execute(stmt)
        return [row.user_id for row in result]

    async def get_subordinates(self, supervisor_id: UUID, org_id: str) -> List[User]:
        """
        Compatibility helper for RBACHelper. Returns subordinate user models without eager relationships.
        """
        subordinate_ids = await self.fetch_subordinate_ids(supervisor_id, org_id)
        if not subordinate_ids:
            return []
        subordinate_map = await self.fetch_users_by_ids(subordinate_ids, org_id)
        return list(subordinate_map.values())

    async def fetch_subordinates_for_users(self, supervisor_ids: Iterable[UUID], org_id: str) -> Dict[UUID, List[User]]:
        """
        Fetch subordinate User models for multiple supervisors in a single query.
        Returns a mapping: supervisor_id -> List[User].
        """
        id_list = [sup_id for sup_id in set(supervisor_ids) if sup_id]
        if not id_list:
            return {}

        supervisor_alias = aliased(User)
        stmt = (
            select(UserSupervisor.supervisor_id, User)
            .join(User, UserSupervisor.user_id == User.id)
            .join(supervisor_alias, UserSupervisor.supervisor_id == supervisor_alias.id)
            .where(UserSupervisor.supervisor_id.in_(id_list))
            .where(User.clerk_organization_id == org_id)
            .where(supervisor_alias.clerk_organization_id == org_id)
        )

        result = await self.session.execute(stmt)
        mapping: Dict[UUID, List[User]] = {}
        for supervisor_id, user in result.all():
            mapping.setdefault(supervisor_id, []).append(user)
        return mapping

    async def fetch_users_by_ids(self, ids: Iterable[UUID], org_id: str) -> Dict[UUID, User]:
        id_list = [user_id for user_id in set(ids) if user_id]
        if not id_list:
            return {}

        stmt = select(User).where(User.id.in_(id_list))
        stmt = self.apply_org_scope_direct(stmt, User.clerk_organization_id, org_id)

        result = await self.session.execute(stmt)
        users = {user.id: user for user in result.scalars().all()}
        return users

    async def get_users_by_department(self, department_id: UUID, org_id: str) -> List[User]:
        """
        Compatibility helper for RBACHelper that returns active users for a department.
        """
        stmt = (
            select(User)
            .where(User.department_id == department_id)
            .where(User.status == UserStatus.ACTIVE.value)
            .order_by(User.name)
        )
        stmt = self.apply_org_scope_direct(stmt, User.clerk_organization_id, org_id)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_users(
        self,
        org_id: str,
        *,
        search_term: Optional[str] = None,
        statuses: Optional[Sequence[UserStatus]] = None,
        department_ids: Optional[Sequence[UUID]] = None,
        stage_ids: Optional[Sequence[UUID]] = None,
        role_ids: Optional[Sequence[UUID]] = None,
        supervisor_id: Optional[UUID] = None,
        user_ids: Optional[Sequence[UUID]] = None,
    ) -> int:
        stmt = select(func.count(User.id))
        stmt = self.apply_org_scope_direct(stmt, User.clerk_organization_id, org_id)

        if search_term:
            pattern = f"%{search_term.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.name).like(pattern),
                    func.lower(User.employee_code).like(pattern),
                    func.lower(User.job_title).like(pattern),
                    func.lower(User.email).like(pattern),
                )
            )

        if statuses:
            status_values = [status.value if isinstance(status, UserStatus) else str(status) for status in statuses]
            stmt = stmt.where(User.status.in_(status_values))

        if department_ids:
            stmt = stmt.where(User.department_id.in_(list(department_ids)))

        if stage_ids:
            stmt = stmt.where(User.stage_id.in_(list(stage_ids)))

        if user_ids:
            stmt = stmt.where(User.id.in_(list(user_ids)))

        if role_ids:
            role_exists = (
                select(user_roles.c.user_id)
                .where(
                    user_roles.c.user_id == User.id,
                    user_roles.c.role_id.in_(list(role_ids)),
                )
                .exists()
            )
            stmt = stmt.where(role_exists)

        if supervisor_id:
            supervisor_exists = (
                select(UserSupervisor.user_id)
                .where(
                    UserSupervisor.user_id == User.id,
                    UserSupervisor.supervisor_id == supervisor_id,
                )
                .exists()
            )
            stmt = stmt.where(supervisor_exists)

        result = await self.session.execute(stmt)
        return int(result.scalar() or 0)
