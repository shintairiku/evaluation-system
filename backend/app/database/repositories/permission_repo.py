import logging
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Sequence, Tuple, Union
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.permission import Permission as PermissionModel, RolePermission as RolePermissionModel
from ..models.user import Role as RoleModel
from .base import BaseRepository


logger = logging.getLogger(__name__)


class PermissionRepository(BaseRepository[PermissionModel]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, PermissionModel)

    async def list_permissions(self) -> List[PermissionModel]:
        result = await self.session.execute(select(PermissionModel).order_by(PermissionModel.code))
        return list(result.scalars().all())

    async def get_by_code(self, code: str) -> Optional[PermissionModel]:
        result = await self.session.execute(
            select(PermissionModel).where(PermissionModel.code == code)
        )
        return result.scalar_one_or_none()

    async def ensure_permission_codes(
        self,
        permissions: Sequence[tuple[str, str, str]],
    ) -> tuple[List[PermissionModel], bool]:
        result = await self.session.execute(select(PermissionModel))
        existing_permissions = list(result.scalars().all())
        existing_by_code = {perm.code: perm for perm in existing_permissions}
        created: List[PermissionModel] = []
        updated = False

        for code, description, permission_group in permissions:
            permission = existing_by_code.get(code)
            if permission is None:
                permission = PermissionModel(
                    code=code,
                    description=description,
                    permission_group=permission_group,
                )
                self.session.add(permission)
                created.append(permission)
                existing_by_code[code] = permission
            else:
                fields_changed = False
                if permission.description != description:
                    permission.description = description
                    fields_changed = True
                if permission.permission_group != permission_group:
                    permission.permission_group = permission_group
                    fields_changed = True
                if fields_changed:
                    updated = True

        if created or updated:
            if created:
                logger.info("Seeded %d new permissions", len(created))
            if updated:
                logger.info("Updated existing permission metadata")
            await self.session.flush()

        return list(existing_by_code.values()), bool(created or updated)

    async def list_for_role(self, role_id: str, org_id: str) -> List[PermissionModel]:
        permissions_query = (
            select(PermissionModel)
            .join(RolePermissionModel, RolePermissionModel.permission_id == PermissionModel.id)
            .where(RolePermissionModel.role_id == role_id)
        )
        permissions_query = self.apply_org_scope_direct(
            permissions_query,
            RolePermissionModel.organization_id,
            org_id,
        )
        permission_result = await self.session.execute(permissions_query)
        permissions = sorted(permission_result.scalars().all(), key=lambda p: p.code)
        return permissions

    async def get_role_version(self, role_id: Union[str, UUID], org_id: str) -> Optional[str]:
        version_query = (
            select(func.max(RolePermissionModel.updated_at))
            .where(RolePermissionModel.role_id == role_id)
        )
        version_query = self.apply_org_scope_direct(
            version_query,
            RolePermissionModel.organization_id,
            org_id,
        )
        result = await self.session.execute(version_query)
        version_value: Optional[datetime] = result.scalar_one_or_none()
        if not version_value:
            return None
        # Preserve microseconds to provide higher resolution for optimistic locking
        return version_value.isoformat()

    async def get_by_codes(self, codes: Iterable[str]) -> List[PermissionModel]:
        codes = list(dict.fromkeys(codes))
        if not codes:
            return []
        result = await self.session.execute(
            select(PermissionModel).where(PermissionModel.code.in_(codes))
        )
        permissions = list(result.scalars().all())
        missing = set(codes) - {p.code for p in permissions}
        if missing:
            raise ValueError(f"Unknown permission codes: {sorted(missing)}")
        order_map = {code: index for index, code in enumerate(codes)}
        permissions.sort(key=lambda perm: order_map.get(perm.code, len(order_map)))
        return permissions

    async def list_permissions_grouped(self) -> Dict[str, List[PermissionModel]]:
        result = await self.session.execute(
            select(PermissionModel).order_by(PermissionModel.permission_group, PermissionModel.code)
        )
        grouped: Dict[str, List[PermissionModel]] = {}
        for permission in result.scalars().all():
            grouped.setdefault(permission.permission_group, []).append(permission)
        return grouped


class RolePermissionRepository(BaseRepository[RolePermissionModel]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, RolePermissionModel)

    async def list_for_role(self, role_id: str, org_id: str) -> List[PermissionModel]:
        permission_repo = PermissionRepository(self.session)
        return await permission_repo.list_for_role(role_id, org_id)

    async def get_role_version(self, role_id: Union[str, UUID], org_id: str) -> Optional[str]:
        permission_repo = PermissionRepository(self.session)
        return await permission_repo.get_role_version(role_id, org_id)

    async def replace_role_permissions(
        self,
        role: RoleModel,
        org_id: str,
        permissions: Sequence[PermissionModel],
    ) -> None:
        delete_query = (
            delete(RolePermissionModel)
            .where(RolePermissionModel.role_id == role.id)
            .where(RolePermissionModel.organization_id == org_id)
        )
        await self.session.execute(delete_query)

        for permission in permissions:
            assignment = RolePermissionModel(
                organization_id=org_id,
                role_id=role.id,
                permission_id=permission.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self.session.add(assignment)

        await self.session.flush()

    async def fetch_permissions_with_version(
        self,
        role_id: str,
        org_id: str,
    ) -> Tuple[List[PermissionModel], Optional[str]]:
        permissions = await self.list_for_role(role_id, org_id)
        version = await self.get_role_version(role_id, org_id)
        return permissions, version

    async def fetch_permissions_for_roles(
        self,
        role_ids: Sequence[Union[str, UUID]],
        org_id: str,
    ) -> Dict[str, Tuple[List[PermissionModel], Optional[str]]]:
        if not role_ids:
            return {}

        role_ids_str = [str(role_id) for role_id in role_ids]
        permissions_query = (
            select(RolePermissionModel.role_id, PermissionModel)
            .join(PermissionModel, RolePermissionModel.permission_id == PermissionModel.id)
            .where(RolePermissionModel.role_id.in_(role_ids_str))
        )
        permissions_query = self.apply_org_scope_direct(
            permissions_query,
            RolePermissionModel.organization_id,
            org_id,
        )

        permissions_result = await self.session.execute(permissions_query)
        permissions_by_role: Dict[str, List[PermissionModel]] = {role_id: [] for role_id in role_ids_str}

        for role_id, permission in permissions_result.all():
            role_key = str(role_id)
            permissions_by_role.setdefault(role_key, []).append(permission)

        versions_query = (
            select(
                RolePermissionModel.role_id,
                func.max(RolePermissionModel.updated_at),
            )
            .where(RolePermissionModel.role_id.in_(role_ids_str))
            .group_by(RolePermissionModel.role_id)
        )
        versions_query = self.apply_org_scope_direct(
            versions_query,
            RolePermissionModel.organization_id,
            org_id,
        )

        versions_result = await self.session.execute(versions_query)
        version_map: Dict[str, Optional[str]] = {
            str(role_id): (timestamp.isoformat() if timestamp else None)
            for role_id, timestamp in versions_result.all()
        }

        combined: Dict[str, Tuple[List[PermissionModel], Optional[str]]] = {}
        for role_id in role_ids_str:
            permissions = permissions_by_role.get(role_id, [])
            permissions.sort(key=lambda perm: perm.code)
            combined[role_id] = (permissions, version_map.get(role_id))

        return combined
