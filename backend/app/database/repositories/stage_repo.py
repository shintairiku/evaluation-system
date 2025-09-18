from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from ..models.stage_competency import Stage
from ...schemas.stage_competency import StageCreate, StageUpdate
from .base import BaseRepository



class StageRepository(BaseRepository[Stage]):
    """Repository for stage operations."""
    
    def __init__(self, session: AsyncSession):
        super().__init__(session, Stage)
        self.session = session
    
    async def create(self, stage_data: StageCreate, org_id: str) -> Stage:
        """Create a new stage within organization scope."""
        # Check if stage with same name already exists in this organization
        existing = await self.get_by_name(stage_data.name, org_id)
        if existing:
            raise ValueError(f"Stage with name '{stage_data.name}' already exists in organization")
        
        stage = Stage(
            organization_id=org_id,
            name=stage_data.name,
            description=stage_data.description
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
