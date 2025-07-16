from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.user import Role
from ...schemas.user import RoleCreate, RoleUpdate


class RoleRepository:
    """Repository for role database operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_role(self, role_data: RoleCreate) -> Role:
        """Create a new role."""
        role = Role(
            name=role_data.name,
            description=role_data.description
        )
        self.session.add(role)
        await self.session.flush()
        await self.session.refresh(role)
        return role
    
    async def get_by_id(self, role_id: UUID) -> Optional[Role]:
        """Get role by ID."""
        result = await self.session.execute(
            select(Role).where(Role.id == role_id)
        )
        return result.scalar_one_or_none()
    
    async def get_all(self) -> List[Role]:
        """Get all roles."""
        result = await self.session.execute(select(Role))
        return list(result.scalars().all())
    
    async def update_role(self, role_id: UUID, role_data: RoleUpdate) -> Optional[Role]:
        """Update a role."""
        role = await self.get_by_id(role_id)
        if not role:
            return None
        
        if role_data.name is not None:
            role.name = role_data.name
        if role_data.description is not None:
            role.description = role_data.description
        
        await self.session.flush()
        await self.session.refresh(role)
        return role
    
    async def delete_role(self, role_id: UUID) -> bool:
        """Delete a role."""
        role = await self.get_by_id(role_id)
        if not role:
            return False
        
        await self.session.delete(role)
        await self.session.flush()
        return True
    
    async def get_user_roles(self, user_id) -> List[Role]:
        """Get user roles by user ID."""
        from ..models.user import user_roles
        
        query = (
            select(Role)
            .join(user_roles, Role.id == user_roles.c.role_id)
            .where(user_roles.c.user_id == user_id)
            .order_by(Role.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
