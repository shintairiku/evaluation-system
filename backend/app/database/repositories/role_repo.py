from typing import List, Optional
from uuid import UUID
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
    
    async def get_role_by_id(self, role_id: UUID) -> Optional[Role]:
        """Get role by ID."""
        result = await self.session.execute(
            select(Role).where(Role.id == role_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_roles(self, user_id: UUID) -> List[Role]:
        """Get user roles by user ID."""
        from sqlalchemy import text
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