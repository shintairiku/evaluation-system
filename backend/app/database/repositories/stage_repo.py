from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.user import Stage


class StageRepository:
    """Simple repository for stage operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all(self) -> List[Stage]:
        """Get all stages."""
        result = await self.session.execute(select(Stage))
        return result.scalars().all()
    
    async def get_stage_by_id(self, stage_id: UUID) -> Optional[Stage]:
        """Get stage by ID."""
        result = await self.session.execute(
            select(Stage).where(Stage.id == stage_id)
        )
        return result.scalar_one_or_none()