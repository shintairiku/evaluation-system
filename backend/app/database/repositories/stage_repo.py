from typing import List
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