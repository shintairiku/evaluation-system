from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.viewer_visibility import (
    ViewerVisibilityDepartment,
    ViewerVisibilitySupervisorTeam,
    ViewerVisibilityUser,
)
from ..models.user import User
from ...security.rbac_types import ResourceType
from ...security.viewer_visibility import ViewerSubjectType
from .base import BaseRepository


@dataclass(frozen=True)
class ViewerVisibilityOverride:
    subject_type: ViewerSubjectType
    subject_id: UUID
    resource_type: ResourceType


@dataclass(frozen=True)
class ViewerVisibilityGrant(ViewerVisibilityOverride):
    created_by: Optional[UUID]
    created_at: datetime


class ViewerVisibilityRepository(BaseRepository):
    SUBJECT_MODEL_MAP = {
        ViewerSubjectType.USER: (ViewerVisibilityUser, "target_user_id"),
        ViewerSubjectType.DEPARTMENT: (ViewerVisibilityDepartment, "target_department_id"),
        ViewerSubjectType.SUPERVISOR_TEAM: (ViewerVisibilitySupervisorTeam, "supervisor_user_id"),
    }

    def __init__(self, session: AsyncSession):
        super().__init__(session)

    async def list_grants(self, viewer_user_id: UUID, org_id: str) -> List[ViewerVisibilityGrant]:
        grants: List[ViewerVisibilityGrant] = []

        for subject_type, (model, target_column) in self.SUBJECT_MODEL_MAP.items():
            query = select(model).where(model.viewer_user_id == viewer_user_id)
            query = self.apply_org_scope_direct(query, model.organization_id, org_id)
            rows = (await self.session.execute(query)).scalars().all()

            for row in rows:
                try:
                    resource_type = ResourceType(row.resource_type)
                except ValueError:
                    continue

                grants.append(
                    ViewerVisibilityGrant(
                        subject_type=subject_type,
                        subject_id=getattr(row, target_column),
                        resource_type=resource_type,
                        created_by=row.created_by,
                        created_at=row.created_at,
                    )
                )

        return grants

    async def get_latest_version(self, viewer_user_id: UUID, org_id: str) -> Optional[str]:
        timestamps: List[datetime] = []
        for model, _ in self.SUBJECT_MODEL_MAP.values():
            query = select(func.max(model.updated_at)).where(model.viewer_user_id == viewer_user_id)
            query = self.apply_org_scope_direct(query, model.organization_id, org_id)
            result = await self.session.execute(query)
            max_ts = result.scalar_one_or_none()
            if max_ts:
                timestamps.append(max_ts)

        if not timestamps:
            return None

        latest = max(timestamps)
        return latest.isoformat()

    async def replace_grants(
        self,
        viewer_user_id: UUID,
        org_id: str,
        overrides: Iterable[ViewerVisibilityOverride],
        created_by: Optional[UUID] = None,
    ) -> None:
        await self.delete_all_for_viewer(viewer_user_id, org_id)
        await self.add_overrides(viewer_user_id, org_id, overrides, created_by)

    async def delete_all_for_viewer(self, viewer_user_id: UUID, org_id: str) -> None:
        for model, _ in self.SUBJECT_MODEL_MAP.values():
            delete_query = delete(model).where(model.viewer_user_id == viewer_user_id)
            delete_query = self.apply_org_scope_direct(delete_query, model.organization_id, org_id)
            await self.session.execute(delete_query)

    async def delete_overrides(
        self,
        viewer_user_id: UUID,
        org_id: str,
        overrides: Iterable[ViewerVisibilityOverride],
    ) -> None:
        for override in overrides:
            model, target_column = self._model_info_for_subject(override.subject_type)
            target_value = getattr(model, target_column)
            delete_query = (
                delete(model)
                .where(model.viewer_user_id == viewer_user_id)
                .where(target_value == override.subject_id)
                .where(model.resource_type == override.resource_type.value)
            )
            delete_query = self.apply_org_scope_direct(delete_query, model.organization_id, org_id)
            await self.session.execute(delete_query)

    async def add_overrides(
        self,
        viewer_user_id: UUID,
        org_id: str,
        overrides: Iterable[ViewerVisibilityOverride],
        created_by: Optional[UUID] = None,
    ) -> None:
        counter = 0
        for override in overrides:
            model, target_column = self._model_info_for_subject(override.subject_type)
            kwargs = {
                "organization_id": org_id,
                "viewer_user_id": viewer_user_id,
                target_column: override.subject_id,
                "resource_type": override.resource_type.value,
                "created_by": created_by,
            }
            instance = model(**kwargs)
            self.session.add(instance)
            counter += 1

        if counter:
            await self.session.flush()

    def _model_info_for_subject(self, subject_type: ViewerSubjectType) -> Tuple:
        if subject_type not in self.SUBJECT_MODEL_MAP:
            raise ValueError(f"Unsupported subject type {subject_type}")
        return self.SUBJECT_MODEL_MAP[subject_type]
