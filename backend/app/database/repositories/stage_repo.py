from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from ..models.stage_competency import Stage, StageWeightHistory
from ..models.user import User
from ...schemas.stage_competency import StageCreate, StageUpdate
from .base import BaseRepository



class StageRepository(BaseRepository[Stage]):
    """Repository for stage operations."""
    
    def __init__(self, session: AsyncSession):
        super().__init__(session, Stage)
    
    async def create(self, stage_data: StageCreate, org_id: str) -> Stage:
        """Create a new stage within organization scope."""
        # Check if stage with same name already exists in this organization
        existing = await self.get_by_name(stage_data.name, org_id)
        if existing:
            raise ValueError(f"Stage with name '{stage_data.name}' already exists in organization")
        
        default_quant_weight = 70.0
        default_qual_weight = 30.0
        default_comp_weight = 10.0

        stage = Stage(
            organization_id=org_id,
            name=stage_data.name,
            description=stage_data.description,
            quantitative_weight=default_quant_weight,
            qualitative_weight=default_qual_weight,
            competency_weight=default_comp_weight
        )
        self.session.add(stage)
        return stage
    
    async def get_by_id(self, stage_id: UUID, org_id: str) -> Optional[Stage]:
        """Get stage by ID within organization scope."""
        query = select(Stage).where(Stage.id == stage_id)
        query = self.apply_org_scope_direct(query, Stage.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_name(self, name: str, org_id: str) -> Optional[Stage]:
        """Get stage by name within organization scope."""
        query = select(Stage).where(Stage.name == name)
        query = self.apply_org_scope_direct(query, Stage.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_all(self, org_id: str) -> List[Stage]:
        """Get all stages ordered by name within organization scope."""
        query = select(Stage).order_by(Stage.name)
        query = self.apply_org_scope_direct(query, Stage.organization_id, org_id)
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def update(self, stage_id: UUID, stage_data: StageUpdate, org_id: str) -> Optional[Stage]:
        """Update a stage within organization scope."""
        existing_stage = await self.get_by_id(stage_id, org_id)
        if not existing_stage:
            return None
        
        if stage_data.name is not None:
            existing_stage.name = stage_data.name
        if stage_data.description is not None:
            existing_stage.description = stage_data.description
        
        self.session.add(existing_stage)
        return existing_stage

    async def update_weights(self, stage_id: UUID, weight_data, org_id: str) -> Optional[Stage]:
        """Update weight configuration for a stage and return the updated model."""
        stage = await self.get_by_id(stage_id, org_id)
        if not stage:
            return None

        stage.quantitative_weight = weight_data.quantitative_weight
        stage.qualitative_weight = weight_data.qualitative_weight
        stage.competency_weight = weight_data.competency_weight

        self.session.add(stage)
        return stage

    async def add_weight_history_entry(
        self,
        stage: Stage,
        org_id: str,
        actor_user_id: UUID,
        previous_weights: dict
    ) -> StageWeightHistory:
        """Persist a weight history entry for auditing purposes."""
        history_entry = StageWeightHistory(
            stage_id=stage.id,
            organization_id=org_id,
            actor_user_id=actor_user_id,
            quantitative_weight_before=previous_weights.get("quantitative_weight"),
            quantitative_weight_after=stage.quantitative_weight,
            qualitative_weight_before=previous_weights.get("qualitative_weight"),
            qualitative_weight_after=stage.qualitative_weight,
            competency_weight_before=previous_weights.get("competency_weight"),
            competency_weight_after=stage.competency_weight,
        )
        self.session.add(history_entry)
        return history_entry

    async def get_weight_history(
        self,
        stage_id: UUID,
        org_id: str,
        limit: int = 20
    ) -> List[Tuple[StageWeightHistory, Optional[str], Optional[str]]]:
        """Retrieve recent weight history entries for a stage within organization scope.
        
        Returns a list of tuples containing:
        - StageWeightHistory entry
        - Actor user name (or None)
        - Actor employee code (or None)
        """
        query = (
            select(
                StageWeightHistory,
                User.name,
                User.employee_code
            )
            .outerjoin(User, StageWeightHistory.actor_user_id == User.id)
            .where(StageWeightHistory.stage_id == stage_id)
            .order_by(StageWeightHistory.changed_at.desc())
            .limit(limit)
        )
        query = self.apply_org_scope_direct(query, StageWeightHistory.organization_id, org_id)
        result = await self.session.execute(query)
        return result.all()
    
    async def delete(self, stage_id: UUID, org_id: str) -> bool:
        """Delete a stage within organization scope."""
        # First verify stage exists in organization
        existing = await self.get_by_id(stage_id, org_id)
        if not existing:
            return False
        
        result = await self.session.execute(
            delete(Stage).where(Stage.id == stage_id).returning(Stage.id)
        )
        return result.scalar_one_or_none() is not None
    
    async def count_users_by_stage(self, stage_id: UUID, org_id: str) -> int:
        """Count number of users in a stage within organization scope."""
        from ..models.user import User
        
        # First verify stage exists in organization
        existing = await self.get_by_id(stage_id, org_id)
        if not existing:
            return 0
        
        result = await self.session.execute(
            select(func.count(User.id)).where(
                User.stage_id == stage_id,
                User.clerk_organization_id == org_id
            )
        )
        return result.scalar_one()
