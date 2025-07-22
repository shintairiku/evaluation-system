from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from ..models.stage_competency import Stage
from ...schemas.stage_competency import StageCreate, StageUpdate


class StageRepository:
    """Repository for stage operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, stage_data: StageCreate) -> Stage:
        """Create a new stage."""
        stage = Stage(
            name=stage_data.name,
            description=stage_data.description
        )
        self.session.add(stage)
        return stage
    
    async def get_by_id(self, stage_id: UUID) -> Optional[Stage]:
        """Get stage by ID."""
        result = await self.session.execute(
            select(Stage).where(Stage.id == stage_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_name(self, name: str) -> Optional[Stage]:
        """Get stage by name."""
        result = await self.session.execute(
            select(Stage).where(Stage.name == name)
        )
        return result.scalar_one_or_none()
    
    async def get_all(self) -> List[Stage]:
        """Get all stages ordered by name."""
        result = await self.session.execute(
            select(Stage).order_by(Stage.name)
        )
        return result.scalars().all()
    
    async def update(self, stage_id: UUID, stage_data: StageUpdate) -> Optional[Stage]:
        """Update a stage."""
        existing_stage = await self.get_by_id(stage_id)
        if not existing_stage:
            return None
        
        if stage_data.name is not None:
            existing_stage.name = stage_data.name
        if stage_data.description is not None:
            existing_stage.description = stage_data.description
        
        self.session.add(existing_stage)
        return existing_stage
    
    async def delete(self, stage_id: UUID) -> bool:
        """Delete a stage."""
        result = await self.session.execute(
            delete(Stage).where(Stage.id == stage_id).returning(Stage.id)
        )
        return result.scalar_one_or_none() is not None
    
    async def count_users_by_stage(self, stage_id: UUID) -> int:
        """Count number of users in a stage."""
        from ..models.user import User
        result = await self.session.execute(
            select(func.count(User.id)).where(User.stage_id == stage_id)
        )
        return result.scalar_one()