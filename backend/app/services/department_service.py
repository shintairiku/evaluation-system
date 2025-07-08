import logging
from typing import Optional, List, Dict, Any
from uuid import UUID

from ..database.repositories.department_repo import DepartmentRepository
from ..schemas.department import (
    Department, DepartmentCreate, DepartmentUpdate, DepartmentDetail
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError
)

logger = logging.getLogger(__name__)


class DepartmentService:
    """Service layer for department-related business logic and operations"""
    
    def __init__(self):
        self.dept_repo = DepartmentRepository()
    
    async def get_departments(
        self,
        current_user: Dict[str, Any],
        search_term: str = "",
        filters: Optional[Dict[str, Any]] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Department]:
        """Get departments based on current user's role and permissions"""
        try:
            # For now, return basic implementation
            # TODO: Implement full role-based access control
            departments = await self.dept_repo.search_departments(
                search_term=search_term,
                filters=filters or {},
                pagination=pagination
            )
            total = await self.dept_repo.count_departments(filters=filters or {})
            
            # Convert to Department schema objects
            dept_schemas = []
            for dept in departments:
                dept_schema = await self._enrich_department_data(dept)
                dept_schemas.append(dept_schema)
            
            # Create pagination params if not provided
            if pagination is None:
                pagination = PaginationParams(page=1, limit=len(dept_schemas))
            
            return PaginatedResponse.create(
                items=dept_schemas,
                total=total,
                pagination=pagination
            )
            
        except Exception as e:
            logger.error(f"Error getting departments: {str(e)}")
            raise
    
    async def get_department_by_id(
        self, 
        dept_id: UUID, 
        current_user: Dict[str, Any]
    ) -> DepartmentDetail:
        """Get a specific department by ID with permission checks"""
        try:
            # Check if department exists
            department = await self.dept_repo.get_by_id(dept_id)
            if not department:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Enrich department data with relationships
            enriched_dept = await self._enrich_department_detail(department)
            return enriched_dept
            
        except Exception as e:
            logger.error(f"Error getting department {dept_id}: {str(e)}")
            raise
    
    async def create_department(
        self, 
        dept_data: DepartmentCreate, 
        current_user: Dict[str, Any]
    ) -> Department:
        """Create a new department with validation and business rules"""
        try:
            # Validate department data
            await self._validate_department_creation(dept_data)
            
            # Create department
            new_department = await self.dept_repo.create_department(dept_data)
            
            # Return enriched department data
            return await self._enrich_department_data(new_department)
            
        except Exception as e:
            logger.error(f"Error creating department: {str(e)}")
            raise
    
    async def update_department(
        self, 
        dept_id: UUID, 
        dept_data: DepartmentUpdate, 
        current_user: Dict[str, Any]
    ) -> Department:
        """Update department information with permission checks"""
        try:
            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Validate update data
            await self._validate_department_update(dept_data, existing_dept)
            
            # Update department
            updated_department = await self.dept_repo.update_department(dept_id, dept_data)
            if not updated_department:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Return enriched department data
            return await self._enrich_department_data(updated_department)
            
        except Exception as e:
            logger.error(f"Error updating department {dept_id}: {str(e)}")
            raise
    
    async def delete_department(
        self, 
        dept_id: UUID, 
        current_user: Dict[str, Any]
    ) -> Dict[str, str]:
        """Delete a department with referential integrity checks"""
        try:
            # Validate deletion
            await self._validate_department_deletion(dept_id)
            
            # Delete department
            success = await self.dept_repo.delete_department(dept_id)
            if not success:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            return {"message": "Department deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting department {dept_id}: {str(e)}")
            raise
    
    async def _validate_department_creation(self, dept_data: DepartmentCreate) -> None:
        """Validate department creation data"""
        if not dept_data.name or not dept_data.name.strip():
            raise ValidationError("Department name is required")
        
        if len(dept_data.name.strip()) < 2:
            raise ValidationError("Department name must be at least 2 characters long")
        
        # Check if department with same name already exists
        existing = await self.dept_repo.get_by_name(dept_data.name.strip())
        if existing:
            raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_update(self, dept_data: DepartmentUpdate, existing_dept) -> None:
        """Validate department update data"""
        if dept_data.name is not None:
            if not dept_data.name.strip():
                raise ValidationError("Department name cannot be empty")
            
            if len(dept_data.name.strip()) < 2:
                raise ValidationError("Department name must be at least 2 characters long")
            
            # Check if new name conflicts with existing department
            if dept_data.name.strip() != existing_dept.name:
                name_conflict = await self.dept_repo.get_by_name(dept_data.name.strip())
                if name_conflict:
                    raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_deletion(self, dept_id: UUID) -> None:
        """Validate department deletion - simplified for now"""
        # TODO: Add comprehensive validation
        pass
    
    async def _enrich_department_data(self, dept) -> Department:
        """Enrich department data with additional information"""
        return Department(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            created_at=dept.created_at,
            updated_at=dept.updated_at
        )
    
    async def _enrich_department_detail(self, dept) -> DepartmentDetail:
        """Enrich department data with detailed information"""
        return DepartmentDetail(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            manager=None,  # TODO: Implement when manager relationship is added
            user_count=0,  # TODO: Implement user count
            created_at=dept.created_at,
            updated_at=dept.updated_at
        )
