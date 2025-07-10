import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import Department
from ...schemas.department import DepartmentCreate, DepartmentUpdate
from ...schemas.common import PaginationParams

logger = logging.getLogger(__name__)


class DepartmentRepository:
    """Simple repository for department operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
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
        async for session in get_db_session():
            result = await session.execute(
                select(Department).where(Department.name == name)
            )
            return result.scalar_one_or_none()
    
    async def get_by_manager(self, manager_id: UUID) -> List[Department]:
        """Get departments managed by a specific user"""
        # This would need to be implemented when manager relationship is added
        # For now, return empty list as manager relationship is not yet implemented
        logger.info(f"Manager relationship not yet implemented for manager {manager_id}")
        return []
    
    async def get_with_user_count(self) -> List[Dict[str, Any]]:
        """Get departments with user count metadata"""
        async for session in get_db_session():
            # This would need a more complex query with user count
            # For now, return basic department info
            result = await session.execute(
                select(Department).order_by(Department.name)
            )
            departments = result.scalars().all()
            return [dept.to_dict() for dept in departments]
    
    async def create_department(self, dept_data: DepartmentCreate) -> Department:
        """Create new department with validation"""
        async for session in get_db_session():
            # Check if department with same name already exists
            existing = await self.get_by_name(dept_data.name)
            if existing:
                raise ValueError(f"Department with name '{dept_data.name}' already exists")
            
            # Create new department
            new_dept = Department(
                name=dept_data.name,
                description=dept_data.description
            )
            
            session.add(new_dept)
            await session.commit()
            await session.refresh(new_dept)
            
            logger.info(f"Department created: {new_dept.id}")
            return new_dept
    
    async def update_department(self, dept_id: UUID, dept_data: DepartmentUpdate) -> Optional[Department]:
        """Update department with validation"""
        async for session in get_db_session():
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
            
            await session.commit()
            await session.refresh(existing)
            
            logger.info(f"Department updated: {dept_id}")
            return existing
    
    async def delete_department(self, dept_id: UUID) -> bool:
        """Delete department with referential integrity checks"""
        async for session in get_db_session():
            # Check if department has active users
            from ..models.user import User
            user_count_result = await session.execute(
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
            result = await session.execute(
                delete(Department).where(Department.id == dept_id)
            )
            await session.commit()
            
            if result.rowcount > 0:
                logger.info(f"Department deleted: {dept_id}")
                return True
            return False
    
    async def assign_manager(self, dept_id: UUID, manager_id: UUID) -> bool:
        """Assign manager to department"""
        # This would need to be implemented when manager relationship is added
        # For now, this is a placeholder
        logger.info(f"Manager assignment not yet implemented: dept_id={dept_id}, manager_id={manager_id}")
        return True
    
    async def search_departments(
        self, 
        search_term: str = "", 
        filters: Optional[Dict[str, Any]] = None,
        pagination: Optional[PaginationParams] = None
    ) -> List[Department]:
        """Search departments with filtering"""
        async for session in get_db_session():
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
            
            result = await session.execute(query)
            return result.scalars().all()
    
    async def get_department_users(self, dept_id: UUID) -> List[Dict[str, Any]]:
        """Get all users in a department"""
        async for session in get_db_session():
            from ..models.user import User
            result = await session.execute(
                select(User).where(
                    and_(
                        User.department_id == dept_id,
                        User.status == "active"
                    )
                ).order_by(User.name)
            )
            users = result.scalars().all()
            return [user.to_dict() for user in users]
    
    async def count_departments(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count departments with optional filters"""
        async for session in get_db_session():
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
            
            result = await session.execute(query)
            return result.scalar() or 0 
