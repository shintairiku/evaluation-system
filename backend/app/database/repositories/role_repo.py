from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.user import Role


class RoleRepository:
    """Simple repository for role operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all(self) -> List[Role]:
        """Get all roles."""
        result = await self.session.execute(select(Role))
        return result.scalars().all()