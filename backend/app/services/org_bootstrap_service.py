import logging
from typing import Dict, Iterable, List

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.permission_repo import (
    PermissionRepository,
    RolePermissionRepository,
)
from ..database.repositories.role_repo import RoleRepository
from ..schemas.user import RoleCreate
from ..security.permissions import Permission as PermissionEnum


logger = logging.getLogger(__name__)


class OrgBootstrapService:
    """
    Seed minimal roles and default role-permission assignments for a new organization.

    Notes:
    - This is one-time bootstrap data, not a runtime fallback.
    - Safe defaults only; admins can modify later via the Permissions tab.
    """

    CANONICAL_ROLES = [
        ("admin", "System administrator"),
        ("manager", "People manager"),
        ("supervisor", "Team supervisor"),
        ("employee", "Regular employee"),
        ("viewer", "Read-only viewer (grants via visibility)")
    ]

    def __init__(self, session: AsyncSession):
        self.session = session
        self.role_repo = RoleRepository(session)
        self.permission_repo = PermissionRepository(session)
        self.role_permission_repo = RolePermissionRepository(session)

    async def bootstrap(self, organization_id: str) -> None:
        # 1) Ensure permission catalog exists (codes, descriptions, groups)
        await self._ensure_catalog_seeded()

        # 2) Ensure canonical roles exist (idempotent)
        roles = await self._ensure_roles(organization_id)

        # 3) Apply default role-permission assignments (idempotent replace)
        await self._ensure_role_permissions(organization_id, roles)

        await self.session.flush()
        logger.info(
            "org.bootstrap.completed",
            extra={"event": "org.bootstrap.completed", "organization_id": organization_id},
        )

    async def _ensure_catalog_seeded(self) -> None:
        # Build catalog triples (code, description, group)
        from ..services.permission_service import PERMISSION_CATALOG_METADATA

        # Validate coverage of enum
        missing = [
            p.value for p in PermissionEnum if p.value not in PERMISSION_CATALOG_METADATA
        ]
        if missing:
            raise ValueError(
                f"Missing metadata for permissions: {missing}. Update PERMISSION_CATALOG_METADATA."
            )

        catalog = [
            (code, desc, group) for code, (group, desc) in PERMISSION_CATALOG_METADATA.items()
        ]
        await self.permission_repo.ensure_permission_codes(catalog)

    async def _ensure_roles(self, org_id: str) -> Dict[str, object]:
        roles: Dict[str, object] = {}
        order = 1
        for name, description in self.CANONICAL_ROLES:
            existing = await self.role_repo.get_by_name(name, org_id)
            if existing is None:
                created = await self.role_repo.create_role(
                    RoleCreate(name=name, description=description, hierarchy_order=order),
                    org_id,
                )
                roles[name] = created
                logger.info(
                    "org.bootstrap.role.created",
                    extra={
                        "event": "org.bootstrap.role.created",
                        "organization_id": org_id,
                        "role_name": name,
                    },
                )
            else:
                roles[name] = existing
            order += 1
        return roles

    async def _ensure_role_permissions(self, org_id: str, roles_by_name: Dict[str, object]) -> None:
        # Build safe default sets
        all_codes = [p.value for p in PermissionEnum]

        def codes(items: Iterable[PermissionEnum]) -> List[str]:
            return [p.value for p in items]

        admin_codes = all_codes

        manager_codes = codes(
            [
                PermissionEnum.USER_READ_SUBORDINATES,
                PermissionEnum.USER_READ_SELF,
                PermissionEnum.DEPARTMENT_READ,
                PermissionEnum.ROLE_READ_ALL,
                PermissionEnum.GOAL_READ_SUBORDINATES,
                PermissionEnum.GOAL_APPROVE,
                PermissionEnum.EVALUATION_READ,
                PermissionEnum.EVALUATION_REVIEW,
                PermissionEnum.COMPETENCY_READ,
                PermissionEnum.ASSESSMENT_READ_SUBORDINATES,
                PermissionEnum.STAGE_READ_ALL,
            ]
        )

        supervisor_codes = codes(
            [
                PermissionEnum.USER_READ_SUBORDINATES,
                PermissionEnum.USER_READ_SELF,
                PermissionEnum.GOAL_READ_SUBORDINATES,
                PermissionEnum.GOAL_APPROVE,
                PermissionEnum.EVALUATION_READ,
                PermissionEnum.EVALUATION_REVIEW,
                PermissionEnum.ASSESSMENT_READ_SUBORDINATES,
            ]
        )

        employee_codes = codes(
            [
                PermissionEnum.USER_READ_SELF,
                PermissionEnum.GOAL_READ_SELF,
                PermissionEnum.GOAL_MANAGE_SELF,
                PermissionEnum.ASSESSMENT_MANAGE_SELF,
                PermissionEnum.COMPETENCY_READ_SELF,
                PermissionEnum.STAGE_READ_SELF,
            ]
        )

        # Viewer: no broad permissions by default; relies on explicit grants
        viewer_codes: List[str] = []

        default_map: Dict[str, List[str]] = {
            "admin": admin_codes,
            "manager": manager_codes,
            "supervisor": supervisor_codes,
            "employee": employee_codes,
            "viewer": viewer_codes,
        }

        # Persist using repository replace (idempotent)
        for role_name, code_list in default_map.items():
            role = roles_by_name.get(role_name)
            if not role:
                continue
            permissions = await self.permission_repo.get_by_codes(code_list) if code_list else []
            await self.role_permission_repo.replace_role_permissions(role, org_id, permissions)
            logger.info(
                "org.bootstrap.role_permissions.applied",
                extra={
                    "event": "org.bootstrap.role_permissions.applied",
                    "organization_id": org_id,
                    "role_name": role_name,
                    "permission_count": len(code_list),
                },
            )

