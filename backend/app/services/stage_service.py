from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.models.user import Stage
from ..schemas.user import Stage as StageSchema


class StageService:
    """Service for stage operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all_stages(self) -> List[StageSchema]:
        """
        Get all stages for user selection.
        
        Returns:
            List[StageSchema]: All available stages
        """
        result = await self.session.execute(select(Stage))
        stages = result.scalars().all()
        
        return [
            StageSchema(
                id=stage.id,
                name=stage.name,
                description=stage.description
            )
            for stage in stages
        ]