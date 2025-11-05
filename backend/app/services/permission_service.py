import logging
from typing import List, Optional, Set
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.permission_repo import (
    PermissionRepository,
    RolePermissionRepository,
)
from ..database.repositories.role_repo import RoleRepository
from ..schemas.permission import (
    PermissionCatalogItem,
    RolePermissionPatchRequest,
    RolePermissionResponse,
    RolePermissionUpdateRequest,
)
from ..security.context import AuthContext
from ..security.decorators import require_permission
from ..security.permissions import Permission as PermissionEnum
from ..security.role_permission_cache import invalidate_role_permission_cache
from ..core.exceptions import ConflictError, NotFoundError, PermissionDeniedError


logger = logging.getLogger(__name__)


class PermissionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.permission_repo = PermissionRepository(session)
        self.role_permission_repo = RolePermissionRepository(session)
        self.role_repo = RoleRepository(session)

    async def _ensure_catalog_seeded(self) -> None:
        permission_catalog = [
            (permission.value, permission.name.replace("_", " "))
            for permission in PermissionEnum
        ]
        _, created = await self.permission_repo.ensure_permission_codes(permission_catalog)
        if created:
            await self.session.commit()

    @require_permission(PermissionEnum.ROLE_READ_ALL)
    async def list_catalog(self, context: AuthContext) -> List[PermissionCatalogItem]:
        await self._ensure_catalog_seeded()
        permissions = await self.permission_repo.list_permissions()
        return [
            PermissionCatalogItem(code=permission.code, description=permission.description)
            for permission in permissions
        ]

    @require_permission(PermissionEnum.ROLE_READ_ALL)
    async def get_role_permissions(self, role_id: UUID, context: AuthContext) -> RolePermissionResponse:
        await self._ensure_catalog_seeded()
        role = await self.role_repo.get_by_id(role_id, context.organization_id)
        if not role:
            raise NotFoundError(f"Role {role_id} not found")

        permissions, version = await self.role_permission_repo.fetch_permissions_with_version(
            role.id,
            context.organization_id,
        )

        version_token = version or "0"

        items = [
            PermissionCatalogItem(code=permission.code, description=permission.description)
            for permission in permissions
        ]
        return RolePermissionResponse(role_id=role.id, permissions=items, version=version_token)

    async def _ensure_fresh_version(
        self,
        expected_version: Optional[str],
        role_id: UUID,
        org_id: str,
    ) -> str:
        current_version = await self.permission_repo.get_role_version(role_id, org_id)
        normalized_expected = expected_version or "0"
        normalized_current = current_version or "0"
        if normalized_expected != normalized_current:
            raise ConflictError(
                "Role permissions were updated by another administrator. Please refresh and try again."
            )
        return normalized_current

    def _record_audit_event(
        self,
        *,
        context: AuthContext,
        role,
        added: Set[str],
        removed: Set[str],
        previous_version: str,
        new_version: str,
    ) -> None:
        logger.info(
            "role_permissions.change",
            extra={
                "event": "role_permissions.change",
                "organization_id": context.organization_id,
                "role_id": str(role.id),
                "role_name": role.name,
                "actor_user_id": str(context.user_id) if context.user_id else None,
                "actor_clerk_id": context.clerk_user_id,
                "added_permissions": sorted(added),
                "removed_permissions": sorted(removed),
                "previous_version": previous_version,
                "new_version": new_version,
                "request_id": getattr(context, "request_id", None),
            },
        )

    @require_permission(PermissionEnum.ROLE_MANAGE)
    async def replace_role_permissions(
        self,
        role_id: UUID,
        payload: RolePermissionUpdateRequest,
        context: AuthContext,
    ) -> RolePermissionResponse:
        await self._ensure_catalog_seeded()
        role = await self.role_repo.get_by_id(role_id, context.organization_id)
        if not role:
            raise NotFoundError(f"Role {role_id} not found")

        previous_version = await self._ensure_fresh_version(payload.version, role_id, context.organization_id)

        try:
            permissions = await self.permission_repo.get_by_codes(payload.permissions)
            before = await self.permission_repo.list_for_role(role.id, context.organization_id)
            await self.role_permission_repo.replace_role_permissions(role, context.organization_id, permissions)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        logger.info(
            "Role permissions updated",
            extra={
                "role_id": str(role_id),
                "organization_id": context.organization_id,
                "permission_count": len(payload.permissions),
            },
        )

        response = await self.get_role_permissions(role_id, context)
        invalidate_role_permission_cache(context.organization_id, role.id)
        self._record_audit_event(
            context=context,
            role=role,
            added={perm.code for perm in permissions} - {perm.code for perm in before},
            removed={perm.code for perm in before} - {perm.code for perm in permissions},
            previous_version=previous_version,
            new_version=response.version,
        )
        return response

    @require_permission(PermissionEnum.ROLE_MANAGE)
    async def patch_role_permissions(
        self,
        role_id: UUID,
        payload: RolePermissionPatchRequest,
        context: AuthContext,
    ) -> RolePermissionResponse:
        await self._ensure_catalog_seeded()
        role = await self.role_repo.get_by_id(role_id, context.organization_id)
        if not role:
            raise NotFoundError(f"Role {role_id} not found")

        previous_version = await self._ensure_fresh_version(payload.version, role_id, context.organization_id)

        current_permissions = await self.permission_repo.list_for_role(role.id, context.organization_id)
        current_codes = {permission.code: permission for permission in current_permissions}
        before_codes = set(current_codes.keys())

        # Remove specified permissions
        for code in payload.remove:
            current_codes.pop(code, None)

        # Add new permissions
        if payload.add:
            additions = await self.permission_repo.get_by_codes(payload.add)
            for permission in additions:
                current_codes[permission.code] = permission

        try:
            await self.role_permission_repo.replace_role_permissions(
                role,
                context.organization_id,
                list(current_codes.values()),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        response = await self.get_role_permissions(role_id, context)
        after_codes = {item.code for item in response.permissions}
        invalidate_role_permission_cache(context.organization_id, role.id)
        self._record_audit_event(
            context=context,
            role=role,
            added=after_codes - before_codes,
            removed=before_codes - after_codes,
            previous_version=previous_version,
            new_version=response.version,
        )
        return response

    @require_permission(PermissionEnum.ROLE_MANAGE)
    async def clone_role_permissions(
        self,
        role_id: UUID,
        from_role_id: UUID,
        context: AuthContext,
    ) -> RolePermissionResponse:
        if role_id == from_role_id:
            raise PermissionDeniedError("Cannot clone permissions onto the same role")

        await self._ensure_catalog_seeded()

        role = await self.role_repo.get_by_id(role_id, context.organization_id)
        source_role = await self.role_repo.get_by_id(from_role_id, context.organization_id)

        if not role or not source_role:
            raise NotFoundError("Source or target role not found")

        before_permissions = await self.permission_repo.list_for_role(role.id, context.organization_id)
        before_codes = {perm.code for perm in before_permissions}
        previous_version = await self.permission_repo.get_role_version(role.id, context.organization_id) or "0"

        permissions = await self.permission_repo.list_for_role(source_role.id, context.organization_id)

        try:
            await self.role_permission_repo.replace_role_permissions(
                role,
                context.organization_id,
                permissions,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        response = await self.get_role_permissions(role_id, context)
        after_codes = {item.code for item in response.permissions}
        invalidate_role_permission_cache(context.organization_id, role.id)
        self._record_audit_event(
            context=context,
            role=role,
            added=after_codes - before_codes,
            removed=before_codes - after_codes,
            previous_version=previous_version,
            new_version=response.version,
        )
        return response
