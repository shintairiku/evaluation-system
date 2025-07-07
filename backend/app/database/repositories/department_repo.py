from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.user import Department


class DepartmentRepository:
    """Simple repository for department operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all(self) -> List[Department]:
        """Get all departments."""
        result = await self.session.execute(select(Department))
        return result.scalars().all()