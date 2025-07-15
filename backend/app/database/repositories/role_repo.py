from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

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
    
    async def get_by_id(self, role_id: int) -> Optional[Role]:
        """Get role by ID."""
        result = await self.session.execute(
            select(Role).where(Role.id == role_id)
        )
        return result.scalar_one_or_none()
    
    async def get_all(self) -> List[Role]:
        """Get all roles."""
        result = await self.session.execute(select(Role))
        return list(result.scalars().all())
    
    async def update_role(self, role_id: int, role_data: RoleUpdate) -> Optional[Role]:
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
    
    async def delete_role(self, role_id: int) -> bool:
        """Delete a role."""
        role = await self.get_by_id(role_id)
        if not role:
            return False
        
        await self.session.delete(role)
        await self.session.flush()
        return True
    
    async def get_user_roles(self, user_id) -> List[Role]:
        """Get user roles by user ID."""
        query = text("""
            SELECT r.id, r.name, r.description 
            FROM roles r
            INNER JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = :user_id
            ORDER BY r.name
        """)
        result = await self.session.execute(query, {"user_id": user_id})
        rows = result.fetchall()
        return [Role(id=row.id, name=row.name, description=row.description) for row in rows]