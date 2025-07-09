from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.models.user import Department
from ..schemas.user import Department as DepartmentSchema


class DepartmentService:
    """Service for department operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_all_departments(self) -> List[DepartmentSchema]:
        """
        Get all departments for user selection.
        
        Returns:
            List[DepartmentSchema]: All available departments
        """
        result = await self.session.execute(select(Department))
        departments = result.scalars().all()
        
        return [
            DepartmentSchema(
                id=dept.id,
                name=dept.name,
                description=dept.description
            )
            for dept in departments
        ]