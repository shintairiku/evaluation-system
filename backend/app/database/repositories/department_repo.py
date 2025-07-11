import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User, Department
from ...schemas.department import DepartmentCreate, DepartmentUpdate
from ...schemas.common import PaginationParams

logger = logging.getLogger(__name__)


class DepartmentRepository:
    """Simple repository for department operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session

    # ========================================
    # CREATE OPERATIONS
    # ========================================
    
    async def create_department(self, dept_data: DepartmentCreate) -> Department:
        """Create new department with validation"""
        # Check if department with same name already exists
        existing = await self.get_by_name(dept_data.name)
        if existing:
            raise ValueError(f"Department with name '{dept_data.name}' already exists")
        
        # Create new department
        new_dept = Department(
            name=dept_data.name,
            description=dept_data.description
        )
        
        self.session.add(new_dept)
        await self.session.flush()  # Flush to get the ID without committing
        
        logger.info(f"Department created: {new_dept.id}")
        return new_dept

    # ========================================
    # READ OPERATIONS
    # ========================================
    
    async def get_all(self) -> List[Department]:
        """Get all departments."""
        result = await self.session.execute(select(Department))
        return result.scalars().all()
    
    async def get_by_id(self, department_id: UUID) -> Optional[Department]:
        """Get department by ID."""
        result = await self.session.execute(
            select(Department).where(Department.id == department_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_name(self, name: str) -> Optional[Department]:
        """Get department by name for uniqueness validation"""
        result = await self.session.execute(
            select(Department).where(Department.name == name)
        )
        return result.scalar_one_or_none()

    async def get_department_users(self, dept_id: UUID) -> List[User]:
        """Get all users in a department"""
        result = await self.session.execute(
            select(User).where(
                and_(
                    User.department_id == dept_id,
                    User.status == "active"
                )
            ).order_by(User.name)
        )
        return result.scalars().all()

    async def search_departments(
        self, 
        search_term: str = "", 
        filters: Optional[Dict[str, Any]] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[Department]:
        """Search departments with filtering"""
        query = select(Department)
        
        # Add search term
        if search_term:
            query = query.where(
                or_(
                    Department.name.ilike(f"%{search_term}%"),
                    Department.description.ilike(f"%{search_term}%")
                )
            )
        
        # Add filters
        if filters:
            if "name" in filters:
                query = query.where(Department.name.ilike(f"%{filters['name']}%"))
            
            if "has_users" in filters and filters["has_users"]:
                from ..models.user import User
                query = query.where(
                    Department.id.in_(
                        select(User.department_id).where(User.status == "active")
                    )
                )
        
        # Add ordering
        query = query.order_by(Department.name)
        
        # Add pagination
        if pagination:
            query = query.limit(pagination.limit).offset(pagination.offset)
        
        result = await self.session.execute(query)
        return result.scalars().all()

    async def autocomplete_departments(self, partial_name: str, limit: int = 10) -> List[Department]:
        """
        Autocomplete search for departments - optimized for real-time UI suggestions.
        Returns departments that match the partial name with smart ordering.
        """
        if not partial_name or len(partial_name.strip()) == 0:
            # Return top departments if no search term
            query = select(Department).order_by(Department.name).limit(limit)
        else:
            partial_name = partial_name.strip().lower()
            
            # Smart ordering: exact matches first, then starts-with, then contains
            query = select(Department).where(
                Department.name.ilike(f"%{partial_name}%")
            ).order_by(
                # Exact match first (case-insensitive)
                func.lower(Department.name) == partial_name,
                # Then starts with
                func.lower(Department.name).like(f"{partial_name}%").desc(),
                # Then alphabetical
                Department.name
            ).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()

    # ========================================
    # UPDATE OPERATIONS
    # ========================================
    
    async def update_department(self, dept_id: UUID, dept_data: DepartmentUpdate) -> Optional[Department]:
        """Update department with validation"""
        # Check if department exists
        existing = await self.get_by_id(dept_id)
        if not existing:
            return None
        
        # Check if new name conflicts with existing department
        if dept_data.name and dept_data.name != existing.name:
            name_conflict = await self.get_by_name(dept_data.name)
            if name_conflict:
                raise ValueError(f"Department with name '{dept_data.name}' already exists")
        
        # Update fields
        if dept_data.name is not None:
            existing.name = dept_data.name
        if dept_data.description is not None:
            existing.description = dept_data.description
        
        existing.updated_at = datetime.utcnow()
        await self.session.flush()  # Flush to update without committing
        
        logger.info(f"Department updated: {dept_id}")
        return existing

    # ========================================
    # DELETE OPERATIONS
    # ========================================
    
    async def delete_department(self, dept_id: UUID) -> bool:
        """Delete department with referential integrity checks"""
        # Check if department has active users
        from ..models.user import User
        user_count_result = await self.session.execute(
            select(func.count(User.id)).where(
                and_(
                    User.department_id == dept_id,
                    User.status == "active"
                )
            )
        )
        user_count = user_count_result.scalar()
        
        if user_count > 0:
            raise ValueError(f"Cannot delete department with {user_count} active users")
        
        # Delete department
        result = await self.session.execute(
            delete(Department).where(Department.id == dept_id)
        )
        
        if result.rowcount > 0:
            logger.info(f"Department deleted: {dept_id}")
            return True
        return False

    async def count_departments(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count departments with optional filters"""
        query = select(func.count(Department.id))
        
        if filters:
            if "name" in filters:
                query = query.where(Department.name.ilike(f"%{filters['name']}%"))
            
            if "has_users" in filters and filters["has_users"]:
                from ..models.user import User
                query = query.where(
                    Department.id.in_(
                        select(User.department_id).where(User.status == "active")
                    )
                )
        
        result = await self.session.execute(query)
        return result.scalar() or 0 
