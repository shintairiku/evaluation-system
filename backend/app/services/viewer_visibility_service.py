import logging
from typing import Iterable, List, Optional, Set
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.role_repo import RoleRepository
from ..database.repositories.user_repo import UserRepository
from ..database.repositories.viewer_visibility_repo import (
    ViewerVisibilityGrant,
    ViewerVisibilityOverride,
    ViewerVisibilityRepository,
)
from ..schemas.viewer_visibility import (
    ViewerVisibilityGrantItem,
    ViewerVisibilityOverridePayload,
    ViewerVisibilityPatchRequest,
    ViewerVisibilityResponse,
    ViewerVisibilityUpdateRequest,
)
from ..core.exceptions import ConflictError, NotFoundError
from ..security.decorators import require_permission
from ..security.permissions import Permission as PermissionEnum
from ..security.viewer_visibility import ViewerSubjectType
from ..security.viewer_visibility_cache import invalidate_viewer_visibility_cache


logger = logging.getLogger(__name__)


class ViewerVisibilityService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ViewerVisibilityRepository(session)
        self.user_repo = UserRepository(session)
        self.department_repo = DepartmentRepository(session)
        self.role_repo = RoleRepository(session)

    @require_permission(PermissionEnum.ROLE_MANAGE)
    async def get_viewer_visibility(self, viewer_user_id: UUID, context) -> ViewerVisibilityResponse:
        org_id = context.organization_id
        self._ensure_request_scope(org_id)
        await self._ensure_viewer_role(viewer_user_id, org_id)

        grants = await self.repo.list_grants(viewer_user_id, org_id)
        version = await self.repo.get_latest_version(viewer_user_id, org_id) or "0"

        return self._build_response(viewer_user_id, version, grants)

    @require_permission(PermissionEnum.ROLE_MANAGE)
    async def replace_viewer_visibility(
        self,
        viewer_user_id: UUID,
        payload: ViewerVisibilityUpdateRequest,
        context,
    ) -> ViewerVisibilityResponse:
        org_id = context.organization_id
        self._ensure_request_scope(org_id)
        await self._ensure_viewer_role(viewer_user_id, org_id)

        previous_version = await self._ensure_fresh_version(payload.version, viewer_user_id, org_id)
        before_grants = await self.repo.list_grants(viewer_user_id, org_id)

        overrides = self._normalize_overrides(payload.grants)
        await self._validate_targets(overrides, org_id)

        try:
            await self.repo.replace_grants(
                viewer_user_id,
                org_id,
                overrides,
                created_by=context.user_id,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        self._post_write_cleanup(org_id, viewer_user_id)
        response = await self._load_response_after_change(viewer_user_id, org_id)
        self._log_change_event(
            context,
            viewer_user_id,
            before_grants,
            response.grants,
            previous_version,
            response.version,
        )
        return response

    @require_permission(PermissionEnum.ROLE_MANAGE)
    async def patch_viewer_visibility(
        self,
        viewer_user_id: UUID,
        payload: ViewerVisibilityPatchRequest,
        context,
    ) -> ViewerVisibilityResponse:
        org_id = context.organization_id
        self._ensure_request_scope(org_id)
        await self._ensure_viewer_role(viewer_user_id, org_id)

        previous_version = await self._ensure_fresh_version(payload.version, viewer_user_id, org_id)
        before_grants = await self.repo.list_grants(viewer_user_id, org_id)

        adds = self._normalize_overrides(payload.add)
        removes = self._normalize_overrides(payload.remove)

        if adds:
            await self._validate_targets(adds, org_id)

        try:
            if removes:
                await self.repo.delete_overrides(viewer_user_id, org_id, removes)
            if adds:
                await self.repo.add_overrides(viewer_user_id, org_id, adds, created_by=context.user_id)
            if not adds and not removes:
                # Nothing to change
                await self.session.rollback()
                return self._build_response(viewer_user_id, previous_version, before_grants)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        self._post_write_cleanup(org_id, viewer_user_id)
        response = await self._load_response_after_change(viewer_user_id, org_id)
        self._log_change_event(
            context,
            viewer_user_id,
            before_grants,
            response.grants,
            previous_version,
            response.version,
        )
        return response

    async def _ensure_viewer_role(self, viewer_user_id: UUID, org_id: str) -> None:
        roles = await self.role_repo.get_user_roles(viewer_user_id, org_id)
        if not roles:
            raise NotFoundError(f"Viewer user {viewer_user_id} not found")
        if not any(role.name.lower() == "viewer" for role in roles):
            raise NotFoundError(f"User {viewer_user_id} is not a Viewer")

    def _ensure_request_scope(self, org_id: Optional[str]) -> None:
        if not org_id:
            raise NotFoundError("Organization scope is required")

    async def _validate_targets(self, overrides: List[ViewerVisibilityOverride], org_id: str) -> None:
        for override in overrides:
            if override.subject_type == ViewerSubjectType.USER:
                user = await self.user_repo.get_user_by_id(override.subject_id, org_id)
                if not user:
                    raise NotFoundError(f"Target user {override.subject_id} not found in org {org_id}")
            elif override.subject_type == ViewerSubjectType.DEPARTMENT:
                department = await self.department_repo.get_by_id(override.subject_id, org_id)
                if not department:
                    raise NotFoundError(f"Target department {override.subject_id} not found in org {org_id}")
            elif override.subject_type == ViewerSubjectType.SUPERVISOR_TEAM:
                supervisor = await self.user_repo.get_user_by_id(override.subject_id, org_id)
                if not supervisor:
                    raise NotFoundError(f"Target supervisor {override.subject_id} not found in org {org_id}")
            else:
                raise NotFoundError(f"Unsupported subject type {override.subject_type}")

    def _normalize_overrides(
        self,
        payloads: Iterable[ViewerVisibilityOverridePayload],
    ) -> List[ViewerVisibilityOverride]:
        normalized: List[ViewerVisibilityOverride] = []
        seen: Set[ViewerVisibilityOverride] = set()
        for payload in payloads:
            override = ViewerVisibilityOverride(
                subject_type=payload.subject_type,
                subject_id=payload.subject_id,
                resource_type=payload.resource_type,
            )
            if override in seen:
                continue
            seen.add(override)
            normalized.append(override)
        return normalized

    async def _ensure_fresh_version(self, expected_version: Optional[str], viewer_user_id: UUID, org_id: str) -> str:
        current_version = await self.repo.get_latest_version(viewer_user_id, org_id) or "0"
        normalized_expected = expected_version or "0"
        if normalized_expected != current_version:
            raise ConflictError("Viewer visibility grants were updated. Please refresh and try again.")
        return current_version

    async def _load_response_after_change(self, viewer_user_id: UUID, org_id: str) -> ViewerVisibilityResponse:
        grants = await self.repo.list_grants(viewer_user_id, org_id)
        version = await self.repo.get_latest_version(viewer_user_id, org_id) or "0"
        return self._build_response(viewer_user_id, version, grants)

    def _build_response(
        self,
        viewer_user_id: UUID,
        version: str,
        grants: List[ViewerVisibilityGrant],
    ) -> ViewerVisibilityResponse:
        sorted_grants = sorted(
            grants,
            key=lambda grant: (
                grant.subject_type.value,
                str(grant.subject_id),
                grant.resource_type.value,
            ),
        )
        items = [
            ViewerVisibilityGrantItem(
                subject_type=grant.subject_type,
                subject_id=grant.subject_id,
                resource_type=grant.resource_type,
                created_by=grant.created_by,
                created_at=grant.created_at,
            )
            for grant in sorted_grants
        ]
        return ViewerVisibilityResponse(
            viewer_user_id=viewer_user_id,
            version=version,
            grants=items,
        )

    def _post_write_cleanup(self, org_id: str, viewer_user_id: UUID) -> None:
        invalidate_viewer_visibility_cache(org_id, viewer_user_id)

    def _log_change_event(
        self,
        context,
        viewer_user_id: UUID,
        before: List[ViewerVisibilityGrant],
        after: List[ViewerVisibilityGrantItem],
        previous_version: str,
        new_version: str,
    ) -> None:
        added = {self._format_grant_item(grant) for grant in after}
        removed = {
            self._format_grant(grant)
            for grant in before
        }

        logger.info(
            "viewer_visibility.change",
            extra={
                "event": "viewer_visibility.change",
                "organization_id": context.organization_id,
                "viewer_user_id": str(viewer_user_id),
                "actor_user_id": str(context.user_id) if context.user_id else None,
                "actor_clerk_id": context.clerk_user_id,
                "added_targets": sorted(added - removed),
                "removed_targets": sorted(removed - added),
                "previous_version": previous_version,
                "new_version": new_version,
                "request_id": getattr(context, "request_id", None),
            },
        )

    def _format_grant(self, grant: ViewerVisibilityGrant) -> str:
        return f"{grant.subject_type.value}:{grant.subject_id}:{grant.resource_type.value}"

    def _format_grant_item(self, grant: ViewerVisibilityGrantItem) -> str:
        return f"{grant.subject_type.value}:{grant.subject_id}:{grant.resource_type.value}"
