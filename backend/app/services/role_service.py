from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.models.role import Role
from ..schemas.user import Role as RoleSchema


class RoleService:
    """Service for role operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all_roles(self) -> List[RoleSchema]:
        """
        Get all roles for user selection.
        
        Returns:
            List[RoleSchema]: All available roles
        """
        result = await self.session.execute(select(Role))
        roles = result.scalars().all()
        
        return [
            RoleSchema(
                id=role.id,
                name=role.name,
                description=role.description
            )
            for role in roles
        ]