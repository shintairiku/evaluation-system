import logging
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.repositories.role_repo import RoleRepository
from ..database.repositories.permission_repo import PermissionRepository
from ..database.repositories.user_repo import UserRepository
from ..database.models.user import Role as RoleModel
from ..schemas.user import (
    RoleCreate, RoleUpdate, Role, RoleDetail, RoleReorderItem
)
from ..schemas.common import Permission as PermissionSchema
from ..core.exceptions import (
    NotFoundError, ConflictError, ValidationError, BadRequestError
)
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..security.decorators import require_permission

logger = logging.getLogger(__name__)


class RoleService:
    """Service layer for role-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.role_repo = RoleRepository(session)
        self.user_repo = UserRepository(session)
        self.permission_repo = PermissionRepository(session)
    
    @require_permission(Permission.ROLE_MANAGE)
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
        - Set hierarchy_order (specified or max+1)
        """
        try:
            logger.info(f"Starting role creation for name: {role_data.name}")
            
            # Permission check handled by @require_permission decorator
            
            # Business validation
            await self._validate_role_creation(role_data, current_user_context.organization_id)

            # Create role through repository with optional hierarchy_order
            created_role = await self.role_repo.create_role(role_data, current_user_context.organization_id)
            
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
    
    @require_permission(Permission.ROLE_MANAGE)
    async def reorder_roles(
        self,
        role_orders: List[RoleReorderItem],
        current_user_context: AuthContext
    ) -> List[Role]:
        """
        Reorder roles based on complete hierarchy list from frontend drag-and-drop.
        
        Simple approach: Frontend sends back ALL roles with their new hierarchy_order.
        This handles any number of role position changes in one atomic operation.
        
        Business Logic:
        - Only admin can reorder roles
        - Validate all roles exist and are included
        - Update all hierarchy_orders based on frontend state
        """
        try:
            logger.info("Reordering all roles based on frontend drag-and-drop state")
            
            # Permission check handled by @require_permission decorator

            # Validate role reorder
            await self._validate_role_reorder(role_orders, current_user_context.organization_id)

            # Execute reorder through repository
            updated_roles = await self.role_repo.reorder_roles(role_orders)
            
            # Commit the transaction
            await self.session.commit()
            logger.info(f"Successfully reordered {len(updated_roles)} roles")
            
            return updated_roles
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error reordering roles: {str(e)}")
            raise
    
    @require_permission(Permission.ROLE_READ_ALL)
    async def get_by_id(
        self,
        role_id: UUID,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Get a specific role by ID
        """
        try:
            # Permission check handled by @require_permission decorator

            # Get role from repository
            role = await self.role_repo.get_by_id(role_id, current_user_context.organization_id)
            if not role:
                raise NotFoundError(f"Role with ID {role_id} not found")

            # Convert to response schema
            role_detail = await self._enrich_role_data(role)
            return role_detail

        except Exception as e:
            logger.error(f"Error getting role {role_id}: {str(e)}")
            raise
    
    @require_permission(Permission.ROLE_READ_ALL)
    async def get_all(
        self,
        current_user_context: AuthContext
    ) -> List[RoleDetail]:
        """
        Get all roles ordered by hierarchy
        """
        try:
            # Permission check handled by @require_permission decorator

            # Get all roles from repository (ordered by hierarchy_order)
            roles = await self.role_repo.get_all(current_user_context.organization_id)

            # Convert to response schemas
            role_details = []
            for role in roles:
                role_detail = await self._enrich_role_data(role)
                role_details.append(role_detail)

            return role_details

        except Exception as e:
            logger.error(f"Error getting all roles: {str(e)}")
            raise
    
    @require_permission(Permission.ROLE_MANAGE)
    async def update_role(
        self,
        role_id: UUID,
        role_data: RoleUpdate,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Update role information (name/description only, not hierarchy_order)
        
        Business Logic:
        - Only admin can update roles
        - Validate role name uniqueness if being updated
        - Check role exists
        """
        try:
            # Permission check handled by @require_permission decorator

            # Check if role exists
            existing_role = await self.role_repo.get_by_id(role_id, current_user_context.organization_id)
            if not existing_role:
                raise NotFoundError(f"Role with ID {role_id} not found")

            # Business validation
            await self._validate_role_update(role_data, existing_role, current_user_context.organization_id)

            # Update role through repository
            updated_role = await self.role_repo.update_role(role_id, role_data, current_user_context.organization_id)
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
    
    @require_permission(Permission.ROLE_MANAGE)
    async def delete_role(
        self,
        role_id: UUID,
        current_user_context: AuthContext
    ) -> bool:
        """
        Delete a role with business validation
        
        Business Logic:
        - Only admin can delete roles
        - Cannot delete role if assigned to users
        - Prevent deletion of system roles
        - Automatically adjust hierarchy_order of remaining roles
        """
        try:
            # Permission check handled by @require_permission decorator

            # Check if role exists
            existing_role = await self.role_repo.get_by_id(role_id, current_user_context.organization_id)
            if not existing_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Business validation before deletion
            await self._validate_role_deletion(existing_role, current_user_context.organization_id)
            
            # Delete role through repository (handles hierarchy_order adjustment)
            success = await self.role_repo.delete_role(role_id, current_user_context.organization_id)
            
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
    
    async def _validate_role_creation(self, role_data: RoleCreate, org_id: str) -> None:
        """Validate all business rules before creating a role."""
        # Check if role name already exists - use efficient lookup
        existing_role = await self.role_repo.get_by_name(role_data.name, org_id)
        if existing_role:
            raise ConflictError(f"Role with name '{role_data.name}' already exists")

        # Additional business validation can be added here
        if not role_data.name.strip():
            raise ValidationError("Role name cannot be empty")

        if not role_data.description.strip():
            raise ValidationError("Role description cannot be empty")

        # Validate hierarchy_order if specified
        if role_data.hierarchy_order is not None:
            if role_data.hierarchy_order < 1:
                raise ValidationError("Hierarchy order must be 1 or greater")

            # Check if hierarchy_order already exists
            existing_role_with_order = await self.role_repo.get_by_hierarchy_order(role_data.hierarchy_order, org_id)
            if existing_role_with_order:
                # This is okay - the repository will shift existing roles to make space
                pass
    
    async def _validate_role_reorder(self, role_orders: List[RoleReorderItem], org_id: str) -> None:
        """Validate role reorder request"""
        # Check that all roles exist
        for item in role_orders:
            role = await self.role_repo.get_by_id(item.id, org_id)
            if not role:
                raise NotFoundError(f"Role with ID {item.id} not found")
        
        # Check that hierarchy_orders are unique
        orders = [item.hierarchy_order for item in role_orders]
        if len(set(orders)) != len(orders):
            raise ValidationError("Duplicate hierarchy_order values detected")
        
        # Check that hierarchy_orders start from 1 and are sequential
        sorted_orders = sorted(orders)
        expected_orders = list(range(1, len(orders) + 1))
        if sorted_orders != expected_orders:
            raise ValidationError("Hierarchy orders must be sequential starting from 1")
    
    async def _validate_role_update(self, role_data: RoleUpdate, existing_role: RoleModel, org_id: str) -> None:
        """Validate role update data"""
        # Check for name conflicts if name is being updated
        if role_data.name and role_data.name.lower() != existing_role.name.lower():
            existing_role_with_name = await self.role_repo.get_by_name(role_data.name, org_id)
            if existing_role_with_name and existing_role_with_name.id != existing_role.id:
                raise ConflictError(f"Role with name '{role_data.name}' already exists")
        
        # Validate field contents
        if role_data.name is not None and not role_data.name.strip():
            raise ValidationError("Role name cannot be empty")
        
        if role_data.description is not None and not role_data.description.strip():
            raise ValidationError("Role description cannot be empty")
    
    async def _validate_role_deletion(self, role: RoleModel, org_id: str) -> None:
        """Validate role deletion business rules"""
        # Prevent deletion of system roles (admin, supervisor, employee)
        system_roles = ['admin', 'supervisor', 'employee']
        if role.name.lower() in system_roles:
            raise BadRequestError(f"Cannot delete system role '{role.name}'")
        
        # Check if role is assigned to users
        user_count = await self.user_repo.count_users_with_role(role.id, org_id)
        if user_count > 0:
            raise BadRequestError(f"Cannot delete role '{role.name}' because it is assigned to {user_count} user(s)")
    
    async def _enrich_role_data(self, role: RoleModel) -> RoleDetail:
        """Convert role model to RoleDetail schema with additional metadata"""
        # Count users with this role (simplified - could be optimized)
        user_count = 0
        try:
            # This would require a method to count users with this role
            # For now, we'll set it to None
            user_count = None
        except Exception as e:
            logger.warning(f"Could not get user count for role {role.id}: {e}")
        
        # Convert basic role data
        role_detail = RoleDetail(
            id=role.id,
            name=role.name,
            description=role.description,
            hierarchy_order=role.hierarchy_order,
            created_at=role.created_at.isoformat() if role.created_at else "",
            updated_at=role.updated_at.isoformat() if role.updated_at else "",
            user_count=user_count
        )

        role_permissions = await self.permission_repo.list_for_role(role.id, role.organization_id)

        if role_permissions:
            role_detail.permissions = [
                PermissionSchema(name=permission.code, description=permission.description or permission.code)
                for permission in role_permissions
            ]
        else:
            role_detail.permissions = []

        return role_detail
