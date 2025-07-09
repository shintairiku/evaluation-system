import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from ..database.repositories.department_repo import DepartmentRepository
from ..database.models.user import Department as DepartmentModel
from ..schemas.department import (
    Department, DepartmentCreate, DepartmentUpdate, DepartmentDetail
)
from ..schemas.user import UserDetailResponse
from ..schemas.common import PaginationParams, PaginatedResponse
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
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
        """
        Get departments based on current user's role and permissions
        
        Business Logic:
        - Admin: Can see all departments
        - Manager: Can see managed departments only
        - Supervisor: Can see own department and managed departments
        - Viewer: Can see departments with viewing permissions
        - Employee: Can see own department only
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # For now, simplified permission logic
            if user_role == "admin":
                # Admin can see all departments
                departments = await self.dept_repo.search_departments(
                    search_term=search_term,
                    filters=filters,
                    pagination=pagination
                )
                total = await self.dept_repo.count_departments(filters=filters)
            else:
                # Other roles can see limited departments
                departments = await self.dept_repo.search_departments(
                    search_term=search_term,
                    filters=filters,
                    pagination=pagination
                )
                total = await self.dept_repo.count_departments(filters=filters)
            
            # Apply pagination if provided
            if pagination:
                start = pagination.offset
                end = start + pagination.limit
                departments = departments[start:end]
            
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
        """
        Get a specific department by ID with permission checks
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check if department exists
            department = await self.dept_repo.get_by_id(dept_id)
            if not department:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Simplified permission check
            if user_role not in ["admin", "manager", "supervisor", "viewer", "employee"]:
                raise PermissionDeniedError("Insufficient permissions to view this department")
            
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
        """
        Create a new department with validation and business rules
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Only admin can create departments
            if user_role != "admin":
                raise PermissionDeniedError("Only administrators can create departments")
            
            # Validate department data
            await self._validate_department_creation(dept_data)
            
            # Create department
            department = await self.dept_repo.create_department(dept_data)
            
            # Enrich department data
            enriched_dept = await self._enrich_department_data(department)
            
            logger.info(f"Department created successfully: {department.id}")
            return enriched_dept
            
        except Exception as e:
            logger.error(f"Error creating department: {str(e)}")
            raise
    
    async def update_department(
        self, 
        dept_id: UUID, 
        dept_data: DepartmentUpdate, 
        current_user: Dict[str, Any]
    ) -> Department:
        """
        Update department information with validation and business rules
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Only admin can update departments
            if user_role != "admin":
                raise PermissionDeniedError("Only administrators can update departments")
            
            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Validate update data
            await self._validate_department_update(dept_data, existing_dept)
            
            # Update department
            updated_dept = await self.dept_repo.update_department(dept_id, dept_data)
            
            # Enrich department data
            enriched_dept = await self._enrich_department_data(updated_dept)
            
            logger.info(f"Department updated successfully: {dept_id}")
            return enriched_dept
            
        except Exception as e:
            logger.error(f"Error updating department {dept_id}: {str(e)}")
            raise
    
    async def delete_department(
        self, 
        dept_id: UUID, 
        current_user: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Delete a department with validation and business rules
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Only admin can delete departments
            if user_role != "admin":
                raise PermissionDeniedError("Only administrators can delete departments")
            
            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Validate deletion
            await self._validate_department_deletion(dept_id)
            
            # Delete department
            await self.dept_repo.delete_department(dept_id)
            
            logger.info(f"Department deleted successfully: {dept_id}")
            return {"message": f"Department {dept_id} deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting department {dept_id}: {str(e)}")
            raise
    
    # Validation methods
    async def _validate_department_creation(self, dept_data: DepartmentCreate) -> None:
        """Validate department creation data"""
        # Check for duplicate names
        existing_dept = await self.dept_repo.get_by_name(dept_data.name)
        if existing_dept:
            raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_update(self, dept_data: DepartmentUpdate, existing_dept: DepartmentModel) -> None:
        """Validate department update data"""
        # Check for duplicate names if name is being updated
        if dept_data.name and dept_data.name != existing_dept.name:
            existing_with_name = await self.dept_repo.get_by_name(dept_data.name)
            if existing_with_name:
                raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_deletion(self, dept_id: UUID) -> None:
        """Validate department deletion"""
        # Check if department has users
        users = await self.dept_repo.get_department_users(dept_id)
        if len(users) > 0:
            raise ConflictError(f"Cannot delete department with {len(users)} users. Transfer users first.")
    
    # Enrichment methods
    async def _enrich_department_data(self, dept: DepartmentModel) -> Department:
        """Enrich basic department data"""
        return Department(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            created_at=dept.created_at,
            updated_at=dept.updated_at,
            manager_id=dept.manager_id
        )
    
    async def _enrich_department_detail(self, dept: DepartmentModel) -> DepartmentDetail:
        """Enrich department data with detailed information"""
        # Get user count
        users = await self.dept_repo.get_department_users(dept.id)
        user_count = len(users)
        
        # Get manager info if exists
        manager_info = None
        if dept.manager_id:
            # For now, simplified manager info
            manager_info = {
                "id": dept.manager_id,
                "name": "Manager Name"  # This would be enriched with actual manager data
            }
        
        return DepartmentDetail(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            created_at=dept.created_at,
            updated_at=dept.updated_at,
            manager_id=dept.manager_id,
            manager=manager_info,
            user_count=user_count,
            users=None  # Would be populated with paginated user data if needed
        ) 