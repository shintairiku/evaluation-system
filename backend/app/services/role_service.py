import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.role_repo import RoleRepository
from ..database.models.user import Role as RoleModel
from ..schemas.user import (

    RoleCreate, RoleUpdate, Role, RoleDetail
)
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, BadRequestError
)
from ..security.context import AuthContext
from ..security.permissions import Permission

logger = logging.getLogger(__name__)


class RoleService:
    """Service layer for role-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.role_repo = RoleRepository(session)
    
    async def create_role(
        self,
        role_data: RoleCreate,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Create a new role with validation and business rules
        
        Business Logic:
        - Only admin can create roles
        - Validate role name uniqueness
        - Set default timestamps
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.USER_MANAGE)
            
            # Business validation
            await self._validate_role_creation(role_data)
            
            # Create role through repository
            created_role = await self.role_repo.create_role(role_data)
            
            # Commit the transaction (Service controls the Unit of Work)
            await self.session.commit()
            await self.session.refresh(created_role)
            
            # Convert to response schema
            role_detail = await self._enrich_role_data(created_role)
            
            logger.info(f"Role created successfully: {created_role.id}")
            return role_detail
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating role: {str(e)}")
            raise
    
    async def get_by_id(
        self,
        role_id: UUID,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Get a specific role by ID
        """
        try:
            # Permission check - require read access
            # Current RBAC is not set; all users can read all roles
            
            # Get role from repository
            role = await self.role_repo.get_by_id(role_id)
            if not role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Convert to response schema
            role_detail = await self._enrich_role_data(role)
            return role_detail
            
        except Exception as e:
            logger.error(f"Error getting role {role_id}: {str(e)}")
            raise
    
    async def get_all(
        self,
        current_user_context: AuthContext
    ) -> List[RoleDetail]:
        """
        Get all roles
        """
        try:
            # Permission check - require read access
            # Current RBAC is not set; all users can read all roles
            
            # Get all roles from repository
            roles = await self.role_repo.get_all()
            
            # Convert to response schemas
            role_details = []
            for role in roles:
                role_detail = await self._enrich_role_data(role)
                role_details.append(role_detail)
            
            return role_details
            
        except Exception as e:
            logger.error(f"Error getting all roles: {str(e)}")
            raise
    
    async def update_role(
        self,
        role_id: int,
        role_data: RoleUpdate,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Update role information with permission checks
        
        Business Logic:
        - Only admin can update roles
        - Validate role name uniqueness if being updated
        - Check role exists
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.USER_MANAGE)
            
            # Check if role exists
            existing_role = await self.role_repo.get_by_id(role_id)
            if not existing_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Business validation
            await self._validate_role_update(role_data, existing_role)
            
            # Update role through repository
            updated_role = await self.role_repo.update_role(role_id, role_data)
            if not updated_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Commit the transaction
            await self.session.commit()
            await self.session.refresh(updated_role)
            
            # Convert to response schema
            role_detail = await self._enrich_role_data(updated_role)
            
            logger.info(f"Role updated successfully: {role_id}")
            return role_detail
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating role {role_id}: {str(e)}")
            raise
    
    async def delete_role(
        self,
        role_id: int,
        current_user_context: AuthContext
    ) -> bool:
        """
        Delete a role with business validation
        
        Business Logic:
        - Only admin can delete roles
        - Cannot delete role if assigned to users
        - Prevent deletion of system roles
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.USER_MANAGE)
            
            # Check if role exists
            existing_role = await self.role_repo.get_by_id(role_id)
            if not existing_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Business validation before deletion
            await self._validate_role_deletion(existing_role)
            
            # Delete role through repository
            success = await self.role_repo.delete_role(role_id)
            
            if success:
                await self.session.commit()
                logger.info(f"Role {role_id} deleted successfully")
            else:
                logger.warning(f"Failed to delete role {role_id}")
            
            return success
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting role {role_id}: {str(e)}")
            raise
    
    # Private helper methods
    
    async def _validate_role_creation(self, role_data: RoleCreate) -> None:
        """Validate all business rules before creating a role."""
        # Check if role name already exists
        existing_roles = await self.role_repo.get_all()
        existing_names = [role.name.lower() for role in existing_roles]
        
        if role_data.name.lower() in existing_names:
            raise ConflictError(f"Role with name '{role_data.name}' already exists")
        
        # Additional business validation can be added here
        if not role_data.name.strip():
            raise ValidationError("Role name cannot be empty")
        
        if not role_data.description.strip():
            raise ValidationError("Role description cannot be empty")
    
    async def _validate_role_update(self, role_data: RoleUpdate, existing_role: RoleModel) -> None:
        """Validate role update data"""
        # Check for name conflicts if name is being updated
        if role_data.name and role_data.name.lower() != existing_role.name.lower():
            all_roles = await self.role_repo.get_all()
            existing_names = [role.name.lower() for role in all_roles if role.id != existing_role.id]
            
            if role_data.name.lower() in existing_names:
                raise ConflictError(f"Role with name '{role_data.name}' already exists")
        
        # Validate field contents
        if role_data.name is not None and not role_data.name.strip():
            raise ValidationError("Role name cannot be empty")
        
        if role_data.description is not None and not role_data.description.strip():
            raise ValidationError("Role description cannot be empty")
    
    async def _validate_role_deletion(self, role: RoleModel) -> None:
        """Validate role deletion business rules"""
        # Prevent deletion of system roles (admin, supervisor, employee)
        system_roles = ['admin', 'supervisor', 'employee']
        if role.name.lower() in system_roles:
            raise BadRequestError(f"Cannot delete system role '{role.name}'")
        
        # Check if role is assigned to users
        # Note: This would require a method in role_repo to count users with this role
        # For now, we'll add a basic check - this can be enhanced later
        try:
            # Get role by name to see if it has users (simplified check)
            # In a real implementation, you'd want a dedicated method for this
            all_roles = await self.role_repo.get_all()
            role_to_delete = next((r for r in all_roles if r.id == role.id), None)
            
            if role_to_delete:
                # Add logic here to check if role has users assigned
                # This would typically involve checking the user_roles junction table
                pass
                
        except Exception as e:
            logger.warning(f"Could not validate role usage: {e}")
    
    async def _enrich_role_data(self, role: RoleModel) -> RoleDetail:
        """Convert role model to RoleDetail schema with additional metadata"""
        # Convert basic role data
        role_detail = RoleDetail(
            id=role.id,
            name=role.name,
            description=role.description,
            permissions=[],  # Permissions are defined in backend files, not in DB
            user_count=None  # Could be populated with actual count if needed
        )
       
        return role_detail