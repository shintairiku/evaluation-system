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
from ..core.permissions import PermissionManager, Permission

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
            user_id = current_user.get("sub")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check permissions using PermissionManager
            if PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_ALL):
                # Admin can see all departments
                departments = await self.dept_repo.search_departments(
                    search_term=search_term,
                    filters=filters or {},
                    pagination=pagination
                )
                total = await self.dept_repo.count_departments(filters=filters or {})
            elif PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_MANAGED):
                # Manager can see managed departments
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                # Get departments managed by current user
                managed_departments = await self.dept_repo.get_by_manager(user_id)
                
                # Apply search and filters to managed departments
                filtered_departments = self._filter_departments_by_criteria(
                    managed_departments, search_term, filters
                )
                
                # Apply pagination
                if pagination:
                    start = pagination.offset
                    end = start + pagination.limit
                    departments = filtered_departments[start:end]
                else:
                    departments = filtered_departments
                
                total = len(filtered_departments)
            elif PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_OWN):
                # Employee/Viewer can see their own department
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                # Get user's department
                from ..database.repositories.user_repo import UserRepository
                user_repo = UserRepository()
                current_user_obj = await user_repo.get_by_clerk_id(user_id)
                if not current_user_obj or not current_user_obj.department_id:
                    raise NotFoundError("User department not found")
                
                # Get user's department
                user_dept = await self.dept_repo.get_by_id(current_user_obj.department_id)
                if not user_dept:
                    raise NotFoundError("User department not found")
                
                departments = [user_dept]
                total = 1
            else:
                raise PermissionDeniedError("Insufficient permissions to view departments")
            
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
        
        Business Logic:
        - Admin can view any department
        - Manager can view managed departments
        - Supervisor can view own department or managed departments
        - Employee can view their own department only
        """
        try:
            user_role = current_user.get("role")
            user_id = current_user.get("sub")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check if department exists
            department = await self.dept_repo.get_by_id(dept_id)
            if not department:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Permission checks using PermissionManager
            if PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_ALL):
                # Admin can view any department
                pass
            elif PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_MANAGED):
                # Check if user manages this department
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                managed_departments = await self.dept_repo.get_by_manager(user_id)
                if dept_id not in [dept.id for dept in managed_departments]:
                    raise PermissionDeniedError("You can only view departments you manage")
            elif PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_OWN):
                # Check if user is in this department
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                from ..database.repositories.user_repo import UserRepository
                user_repo = UserRepository()
                current_user_obj = await user_repo.get_by_clerk_id(user_id)
                if not current_user_obj or current_user_obj.department_id != dept_id:
                    raise PermissionDeniedError("You can only view your own department")
            else:
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
        
        Business Logic:
        - Only admin can create departments
        - Department name must be unique
        - Validate department data
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check permissions using PermissionManager
            if not PermissionManager.has_permission(user_role, Permission.DEPARTMENT_CREATE):
                raise PermissionDeniedError("Only administrators can create departments")
            
            # Validate department data
            await self._validate_department_creation(dept_data)
            
            # Create department
            new_dept = await self.dept_repo.create_department(dept_data)
            
            # Enrich department data
            enriched_dept = await self._enrich_department_data(new_dept)
            
            logger.info(f"Department created: {new_dept.id} by user {current_user.get('sub')}")
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
        Update department with validation and business rules
        
        Business Logic:
        - Only admin can update departments
        - Department must exist
        - Validate update data
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check permissions using PermissionManager
            if not PermissionManager.has_permission(user_role, Permission.DEPARTMENT_UPDATE):
                raise PermissionDeniedError("Only administrators can update departments")
            
            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Validate update data
            await self._validate_department_update(dept_data, existing_dept)
            
            # Update department
            updated_dept = await self.dept_repo.update_department(dept_id, dept_data)
            if not updated_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Enrich department data
            enriched_dept = await self._enrich_department_data(updated_dept)
            
            logger.info(f"Department updated: {dept_id} by user {current_user.get('sub')}")
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
        Delete department with validation and business rules
        
        Business Logic:
        - Only admin can delete departments
        - Department must exist
        - Cannot delete department with active users
        """
        try:
            user_role = current_user.get("role")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check permissions using PermissionManager
            if not PermissionManager.has_permission(user_role, Permission.DEPARTMENT_DELETE):
                raise PermissionDeniedError("Only administrators can delete departments")
            
            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Validate deletion
            await self._validate_department_deletion(dept_id)
            
            # Delete department
            success = await self.dept_repo.delete_department(dept_id)
            if not success:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            logger.info(f"Department deleted: {dept_id} by user {current_user.get('sub')}")
            return {"message": "Department deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting department {dept_id}: {str(e)}")
            raise
    
    async def get_department_users(
        self,
        dept_id: UUID,
        current_user: Dict[str, Any],
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[UserDetailResponse]:
        """
        Get users in a specific department with permission checks
        
        Business Logic:
        - Admin can view users in any department
        - Manager can view users in managed departments
        - Employee can view users in their own department
        """
        try:
            user_role = current_user.get("role")
            user_id = current_user.get("sub")
            
            # Validate user_role is present
            if not user_role:
                raise PermissionDeniedError("User role not found in token")
            
            # Check if department exists
            department = await self.dept_repo.get_by_id(dept_id)
            if not department:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Permission checks
            if PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_ALL):
                # Admin can view users in any department
                pass
            elif PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_MANAGED):
                # Check if user manages this department
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                managed_departments = await self.dept_repo.get_by_manager(user_id)
                if dept_id not in [dept.id for dept in managed_departments]:
                    raise PermissionDeniedError("You can only view users in departments you manage")
            elif PermissionManager.has_permission(user_role, Permission.DEPARTMENT_READ_OWN):
                # Check if user is in this department
                if not user_id:
                    raise PermissionDeniedError("User ID not found in token")
                
                from ..database.repositories.user_repo import UserRepository
                user_repo = UserRepository()
                current_user_obj = await user_repo.get_by_clerk_id(user_id)
                if not current_user_obj or current_user_obj.department_id != dept_id:
                    raise PermissionDeniedError("You can only view users in your own department")
            else:
                raise PermissionDeniedError("Insufficient permissions to view department users")
            
            # Get department users
            from ..database.repositories.user_repo import UserRepository
            user_repo = UserRepository()
            
            # Add department filter
            filters = {"department_id": dept_id}
            
            users = await user_repo.search_users(
                search_term="",
                filters=filters,
                pagination=pagination
            )
            total = await user_repo.count_users(filters=filters)
            
            # Convert to UserProfile objects
            user_profiles = []
            for user in users:
                profile = await self._enrich_user_profile(user)
                user_profiles.append(profile)
            
            # Create pagination params if not provided
            if pagination is None:
                pagination = PaginationParams(page=1, limit=len(user_profiles))
            
            return PaginatedResponse.create(
                items=user_profiles,
                total=total,
                pagination=pagination
            )
            
        except Exception as e:
            logger.error(f"Error getting department users for {dept_id}: {str(e)}")
            raise
    
    async def _validate_department_creation(self, dept_data: DepartmentCreate) -> None:
        """Validate department creation data"""
        if not dept_data.name or not dept_data.name.strip():
            raise ValidationError("Department name is required")
        
        if len(dept_data.name.strip()) < 2:
            raise ValidationError("Department name must be at least 2 characters long")
        
        if len(dept_data.name.strip()) > 100:
            raise ValidationError("Department name must be at most 100 characters long")
        
        # Check if department with same name already exists
        existing = await self.dept_repo.get_by_name(dept_data.name.strip())
        if existing:
            raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_update(self, dept_data: DepartmentUpdate, existing_dept: DepartmentModel) -> None:
        """Validate department update data"""
        if dept_data.name is not None:
            if not dept_data.name.strip():
                raise ValidationError("Department name cannot be empty")
            
            if len(dept_data.name.strip()) < 2:
                raise ValidationError("Department name must be at least 2 characters long")
            
            if len(dept_data.name.strip()) > 100:
                raise ValidationError("Department name must be at most 100 characters long")
            
            # Check if new name conflicts with existing department
            if dept_data.name.strip() != existing_dept.name:
                name_conflict = await self.dept_repo.get_by_name(dept_data.name.strip())
                if name_conflict:
                    raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_deletion(self, dept_id: UUID) -> None:
        """Validate department deletion"""
        # Check if department has active users
        from ..database.repositories.user_repo import UserRepository
        user_repo = UserRepository()
        
        filters = {"department_id": dept_id, "status": "active"}
        user_count = await user_repo.count_users(filters=filters)
        
        if user_count > 0:
            raise ValidationError(f"Cannot delete department with {user_count} active users")
    
    async def _enrich_department_data(self, dept: DepartmentModel) -> Department:
        """Enrich department data with additional information"""
        return Department(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            created_at=dept.created_at,
            updated_at=dept.updated_at
        )
    
    async def _enrich_department_detail(self, dept: DepartmentModel) -> DepartmentDetail:
        """Enrich department data with detailed information"""
        # Get department users count
        from ..database.repositories.user_repo import UserRepository
        user_repo = UserRepository()
        
        filters = {"department_id": dept.id, "status": "active"}
        user_count = await user_repo.count_users(filters=filters)
        
        # Get department manager (placeholder for now)
        manager = None  # TODO: Implement when manager relationship is added
        
        return DepartmentDetail(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            manager=manager,
            user_count=user_count,
            created_at=dept.created_at,
            updated_at=dept.updated_at
        )
    
    async def _enrich_user_profile(self, user) -> UserProfile:
        """Enrich user data with profile information"""
        from ..services.user_service import UserService
        user_service = UserService()
        return await user_service._enrich_user_profile(user)
    
    def _filter_departments_by_criteria(
        self, 
        departments: List[DepartmentModel], 
        search_term: str, 
        filters: Optional[Dict[str, Any]]
    ) -> List[DepartmentModel]:
        """Filter departments by search term and filters"""
        filtered = departments
        
        # Apply search term
        if search_term:
            search_lower = search_term.lower()
            filtered = [
                dept for dept in filtered
                if search_lower in dept.name.lower() or 
                   (dept.description and search_lower in dept.description.lower())
            ]
        
        # Apply filters
        if filters:
            if "name" in filters:
                name_filter = filters["name"].lower()
                filtered = [
                    dept for dept in filtered
                    if name_filter in dept.name.lower()
                ]
        
        return filtered
