import logging
from typing import List, Dict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database.repositories.department_repo import DepartmentRepository
from ..database.repositories.user_repo import UserRepository
from ..database.models.user import Department as DepartmentModel
from ..schemas.department import (
    Department, DepartmentCreate, DepartmentUpdate, DepartmentDetail
)
from ..schemas.user import Department as DepartmentSchema
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.rbac_helper import RBACHelper
from ..security.rbac_types import ResourceType
from ..security.decorators import require_permission
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError
)

logger = logging.getLogger(__name__)


class DepartmentService:
    """
    Service for department CRUD operations.
    
    Note: For department listing with advanced filtering and department user management,
    use UserService.get_users() with department_ids filter instead.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.dept_repo = DepartmentRepository(session)
        self.user_repo = UserRepository(session)
        
        # Initialize RBAC Helper with user repository for subordinate queries
        RBACHelper.initialize_with_repository(self.user_repo)

    async def get_departments_for_dropdown(self, current_user_context: AuthContext) -> List[DepartmentSchema]:
        """
        Get all departments for dropdown/selection purposes only within the current organization.
        For advanced department listing with filtering, use UserService.get_users() instead.

        Returns:
            List[DepartmentSchema]: Simple department list for UI dropdowns, org-scoped
        """
        # Enforce organization scoping consistently with other services
        org_id = current_user_context.organization_id

        departments = await self.dept_repo.get_all(org_id)

        return [
            DepartmentSchema(
                id=dept.id,
                name=dept.name,
                description=dept.description
            )
            for dept in departments
        ]

    @require_permission(Permission.DEPARTMENT_READ)
    async def get_department_by_id(
        self, 
        dept_id: UUID, 
        current_user_context: AuthContext
    ) -> DepartmentDetail:
        """
        Get a specific department by ID with enriched metadata.
        
        Business Logic:
        - Admin, Manager, Viewer can view any department
        - Supervisor, Employee, Part-time can view their own department only
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Check if department exists
            department = await self.dept_repo.get_by_id(dept_id, current_user_context.organization_id)
            if not department:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Access check using RBACHelper - department access is role-based
            can_access = await RBACHelper.can_access_resource(
                auth_context=current_user_context,
                resource_id=dept_id,
                resource_type=ResourceType.DEPARTMENT,
                owner_user_id=None  # Departments don't have single owners
            )
            if not can_access:
                # For departments, check if user can at least access their own department
                org_id = current_user_context.organization_id
                if not org_id:
                    raise PermissionDeniedError("Organization context required")
                current_user = await self.user_repo.get_user_by_id(current_user_context.user_id, org_id)
                if not current_user or current_user.department_id != dept_id:
                    raise PermissionDeniedError("You can only access your own department")
            
            # Enrich department data with metadata
            enriched_dept = await self._enrich_department_detail(department)
            return enriched_dept
            
        except Exception as e:
            logger.error(f"Error getting department {dept_id}: {str(e)}")
            raise
    
    @require_permission(Permission.DEPARTMENT_MANAGE)
    async def create_department(
        self, 
        dept_data: DepartmentCreate, 
        current_user_context: AuthContext
    ) -> Department:
        """
        Create a new department with validation and business rules
        
        Business Logic:
        - Only admin can create departments
        - Department name must be unique
        - Validate department data
        """
        try:
            # Permission check handled by @require_permission decorator
            
            # Validate department data
            await self._validate_department_creation(dept_data, current_user_context.organization_id)

            # Create department
            new_dept = await self.dept_repo.create_department(dept_data, current_user_context.organization_id)
            
            # Enrich department data
            enriched_dept = await self._enrich_department_data(new_dept)
            
            logger.info(f"Department created: {new_dept.id} by user {current_user_context.user_id}")
            return enriched_dept
            
        except Exception as e:
            logger.error(f"Error creating department: {str(e)}")
            raise

    @require_permission(Permission.DEPARTMENT_MANAGE)
    async def update_department(
        self, 
        dept_id: UUID, 
        dept_data: DepartmentUpdate, 
        current_user_context: AuthContext
    ) -> Department:
        """
        Update department with validation and business rules
        
        Business Logic:
        - Supervisor or above can update departments
        - Department must exist
        - Validate update data
        """
        try:
            # Permission check handled by @require_permission decorator

            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id, current_user_context.organization_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")

            # Validate update data
            await self._validate_department_update(dept_data, existing_dept)

            # Update department
            updated_dept = await self.dept_repo.update_department(dept_id, dept_data, current_user_context.organization_id)
            if not updated_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            # Enrich department data
            enriched_dept = await self._enrich_department_data(updated_dept)
            
            logger.info(f"Department updated: {dept_id} by user {current_user_context.user_id}")
            return enriched_dept
            
        except Exception as e:
            logger.error(f"Error updating department {dept_id}: {str(e)}")
            raise
    
    @require_permission(Permission.DEPARTMENT_MANAGE)
    async def delete_department(
        self, 
        dept_id: UUID, 
        current_user_context: AuthContext
    ) -> Dict[str, str]:
        """
        Delete department with validation and business rules
        
        Business Logic:
        - Only admin can delete departments
        - Department must exist
        - Cannot delete department with active users
        """
        try:
            # Permission check handled by @require_permission decorator

            # Check if department exists
            existing_dept = await self.dept_repo.get_by_id(dept_id, current_user_context.organization_id)
            if not existing_dept:
                raise NotFoundError(f"Department with ID {dept_id} not found")

            # Validate deletion
            await self._validate_department_deletion(dept_id, current_user_context.organization_id)

            # Delete department
            success = await self.dept_repo.delete_department(dept_id, current_user_context.organization_id)
            if not success:
                raise NotFoundError(f"Department with ID {dept_id} not found")
            
            logger.info(f"Department deleted: {dept_id} by user {current_user_context.user_id}")
            return {"message": "Department deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting department {dept_id}: {str(e)}")
            raise
    
    # Private helper methods
    
    async def _validate_department_creation(self, dept_data: DepartmentCreate, org_id: str) -> None:
        """Validate department creation data"""
        if not dept_data.name or not dept_data.name.strip():
            raise ValidationError("Department name is required")

        if len(dept_data.name.strip()) < 2:
            raise ValidationError("Department name must be at least 2 characters long")

        if len(dept_data.name.strip()) > 100:
            raise ValidationError("Department name must be at most 100 characters long")

        # Check if department with same name already exists
        existing = await self.dept_repo.get_by_name(dept_data.name.strip(), org_id)
        if existing:
            raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_update(self, dept_data: DepartmentUpdate, existing_dept: DepartmentModel, org_id: str) -> None:
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
                name_conflict = await self.dept_repo.get_by_name(dept_data.name.strip(), org_id)
                if name_conflict:
                    raise ConflictError(f"Department with name '{dept_data.name}' already exists")
    
    async def _validate_department_deletion(self, dept_id: UUID, org_id: str) -> None:
        """Validate department deletion"""
        # Check if department has active users
        from ..schemas.user import UserStatus
        users = await self.user_repo.search_users(
            department_ids=[dept_id],
            statuses=[UserStatus.ACTIVE],
            org_id=org_id
        )

        if users:
            raise ValidationError(f"Cannot delete department with {len(users)} active users")
    
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
        from ..schemas.user import UserStatus
        from ..services.user_service import UserService

        user_models = await self.user_repo.search_users(
            department_ids=[dept.id], 
            statuses=[UserStatus.ACTIVE]
        )
        user_count = len(user_models)
        
        user_service = UserService(self.session)
        enriched_users = [await user_service._enrich_user_data(u) for u in user_models]

        # Get department manager
        manager_id = None
        manager_name = None
        try:
            manager_users = await self.user_repo.get_users_by_role_names(["manager"])
            for user in manager_users:
                if user.department_id == dept.id:
                    manager_id = user.id
                    manager_name = user.name
                    break  # Take the first manager found
        except Exception as e:
            logger.warning(f"Could not find manager for department {dept.id}: {e}")
        
        return DepartmentDetail(
            id=dept.id,
            name=dept.name,
            description=dept.description,
            manager_id=manager_id,
            manager_name=manager_name,
            user_count=user_count,
            users=enriched_users,
            created_at=dept.created_at,
            updated_at=dept.updated_at
        ) 
