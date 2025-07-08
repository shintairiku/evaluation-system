from typing import List, Optional
from uuid import UUID
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
    
    async def get_department_by_id(self, department_id: UUID) -> Optional[Department]:
        """Get department by ID."""
        result = await self.session.execute(
            select(Department).where(Department.id == department_id)
        )
        return result.scalar_one_or_none()