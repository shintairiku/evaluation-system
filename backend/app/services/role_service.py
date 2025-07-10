"""
Role Service - Business logic layer for Role operations.

This service provides comprehensive role management following the same patterns
as UserService, including validation, permissions, and business rules.
"""

from __future__ import annotations
import logging
from typing import Optional, List

from ..database.repositories.role_repo import RoleRepository
from ..database.repositories.user_repo import UserRepository
from ..database.models.role import Role as RoleModel
from ..schemas.role import (
    RoleCreate, RoleUpdate, Role, RoleDetail, RoleHierarchy
)
from ..schemas.common import PaginationParams, PaginatedResponse
from ..security.context import AuthContext
from ..security.permissions import Permission
from ..core.exceptions import (
    NotFoundError, ConflictError, PermissionDeniedError, BadRequestError
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)



class RoleService:
    """Service layer for role-related business logic and operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.role_repo = RoleRepository(session)
        self.user_repo = UserRepository(session)
    
    async def get_roles(
        self,
        current_user_context: AuthContext,
        search_term: str = "",
        parent_id: Optional[int] = None,
        pagination: Optional[PaginationParams] = None
    ) -> PaginatedResponse[Role]:
        """
        Get roles with optional filtering and pagination.
        Access controlled by user permissions.
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.ROLE_MANAGE)
            
            # Get all roles from repository
            all_roles = await self.role_repo.get_all()
            
            # Filter by search term if provided
            filtered_roles = []
            if search_term:
                search_lower = search_term.lower()
                for role in all_roles:
                    if (search_lower in role.name.lower() or 
                        search_lower in role.code.lower() or
                        search_lower in role.description.lower()):
                        filtered_roles.append(role)
            else:
                filtered_roles = all_roles
            
            # Filter by parent_id if provided
            if parent_id is not None:
                filtered_roles = [role for role in filtered_roles if role.parent_id == parent_id]
            
            # Apply pagination
            if pagination:
                start_idx = (pagination.page - 1) * pagination.limit
                end_idx = start_idx + pagination.limit
                paginated_roles = filtered_roles[start_idx:end_idx]
            else:
                paginated_roles = filtered_roles
            
            # Convert to response schema
            role_responses = []
            for role_model in paginated_roles:
                role_response = await self._enrich_role_data(role_model)
                role_responses.append(role_response)
            
            # Calculate pagination info
            total_count = len(filtered_roles)
            total_pages = (total_count + pagination.limit - 1) // pagination.limit if pagination else 1
            
            result = PaginatedResponse(
                items=role_responses,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(role_responses),
                pages=total_pages
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error in get_roles: {e}")
            raise
    
    async def get_role_by_id(
        self,
        role_id: int,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Get a specific role by ID with detailed information.
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.ROLE_MANAGE)
            
            # Get role from repository
            role = await self.role_repo.get_role_by_id(role_id)
            if not role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Enrich with detailed data
            detailed_role = await self._enrich_detailed_role_data(role)
            return detailed_role
            
        except Exception as e:
            logger.error(f"Error getting role {role_id}: {str(e)}")
            raise
    
    async def create_role(
        self,
        role_data: RoleCreate,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Create a new role with validation and business rules.
        
        Business Logic:
        - Only admin can create roles
        - Validate role code and name uniqueness
        - Validate parent role exists if specified
        - Validate permissions format
        - Prevent circular hierarchy
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.ROLE_MANAGE)
            
            # Validate role creation
            await self._validate_role_creation(role_data)
            
            # Create role through repository
            new_role = await self.role_repo.create_role(
                name=role_data.name,
                code=role_data.code,
                description=role_data.description,
                permissions=role_data.permissions,
                parent_id=role_data.parent_id
            )
            
            # Commit the transaction
            await self.session.commit()
            await self.session.refresh(new_role)
            
            # Enrich role data for detailed response
            enriched_role = await self._enrich_detailed_role_data(new_role)
            
            logger.info(f"Role created successfully: {new_role.id} - {new_role.name}")
            return enriched_role
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating role: {str(e)}")
            raise
    
    async def update_role(
        self,
        role_id: int,
        role_data: RoleUpdate,
        current_user_context: AuthContext
    ) -> RoleDetail:
        """
        Update an existing role with validation and business rules.
        
        Business Logic:
        - Only admin can update roles
        - Validate role exists
        - Validate uniqueness constraints
        - Prevent circular hierarchy
        - Validate permissions format
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.ROLE_MANAGE)
            
            # Check if role exists
            existing_role = await self.role_repo.get_role_by_id(role_id)
            if not existing_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Validate role update
            await self._validate_role_update(role_data, existing_role)
            
            # Update role through repository
            updated_role = await self.role_repo.update_role(
                role_id=role_id,
                name=role_data.name,
                code=role_data.code,
                description=role_data.description,
                permissions=role_data.permissions,
                parent_id=role_data.parent_id
            )
            
            if not updated_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Commit the transaction
            await self.session.commit()
            await self.session.refresh(updated_role)
            
            # Enrich role data for detailed response
            enriched_role = await self._enrich_detailed_role_data(updated_role)
            
            logger.info(f"Role updated successfully: {role_id}")
            return enriched_role
            
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
        Delete a role with business validation.
        
        Business Logic:
        - Only admin can delete roles
        - Cannot delete role if users are assigned to it
        - Cannot delete role if it has child roles
        - Cascade deletion considerations
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.ROLE_MANAGE)
            
            # Check if role exists
            existing_role = await self.role_repo.get_role_by_id(role_id)
            if not existing_role:
                raise NotFoundError(f"Role with ID {role_id} not found")
            
            # Check if role has users assigned
            user_count = await self.role_repo.count_users_with_role(role_id)
            if user_count > 0:
                raise BadRequestError(f"Cannot delete role. {user_count} users are assigned to this role")
            
            # Check if role has child roles
            child_roles = await self.role_repo.get_roles_by_parent_id(role_id)
            if child_roles:
                raise BadRequestError(f"Cannot delete role. It has {len(child_roles)} child roles")
            
            # Delete the role
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
    
    async def get_role_hierarchy(
        self,
        current_user_context: AuthContext,
        parent_id: Optional[int] = None
    ) -> List[RoleHierarchy]:
        """
        Get role hierarchy starting from parent_id (or root if None).
        """
        try:
            # Permission check - only admin can manage roles
            current_user_context.require_permission(Permission.ROLE_MANAGE)
            
            # Get roles at this level
            roles = await self.role_repo.get_roles_by_parent_id(parent_id)
            
            # Build hierarchy
            hierarchy = []
            for role in roles:
                # Get children recursively
                children = await self.get_role_hierarchy(current_user_context, role.id)
                
                # Convert to response schema
                role_response = await self._enrich_role_data(role)
                
                hierarchy.append(RoleHierarchy(
                    role=role_response,
                    children=children
                ))
            
            return hierarchy
            
        except Exception as e:
            logger.error(f"Error getting role hierarchy: {str(e)}")
            raise
    
    async def get_all_roles_flat(
        self,
        current_user_context: AuthContext
    ) -> List[Role]:
        """
        Get all roles in a flat list for dropdowns/selection.
        Used by other services that need role information.
        """
        try:
            # This method can be used by other services for role selection
            # Less restrictive permission check
            if not (current_user_context.has_permission(Permission.ROLE_MANAGE) or
                    current_user_context.has_permission(Permission.USER_MANAGE)):
                raise PermissionDeniedError("Insufficient permissions to access roles")
            
            # Get all roles from repository
            all_roles = await self.role_repo.get_all()
            
            # Convert to response schema
            role_responses = []
            for role_model in all_roles:
                role_response = await self._enrich_role_data(role_model)
                role_responses.append(role_response)
            
            return role_responses
            
        except Exception as e:
            logger.error(f"Error getting all roles: {str(e)}")
            raise
    
    # Private helper methods
    
    async def _validate_role_creation(self, role_data: RoleCreate) -> None:
        """Validate all business rules before creating a role."""
        # Check for duplicate code
        existing_role_code = await self.role_repo.check_role_exists_by_code(role_data.code)
        if existing_role_code:
            raise ConflictError(f"Role with code '{role_data.code}' already exists")
        
        # Check for duplicate name
        existing_role_name = await self.role_repo.check_role_exists_by_name(role_data.name)
        if existing_role_name:
            raise ConflictError(f"Role with name '{role_data.name}' already exists")
        
        # Validate parent role exists if specified
        if role_data.parent_id is not None:
            parent_role = await self.role_repo.get_role_by_id(role_data.parent_id)
            if not parent_role:
                raise BadRequestError(f"Parent role with ID {role_data.parent_id} not found")
        
        # Validate permissions format
        if role_data.permissions:
            await self._validate_permissions_format(role_data.permissions)
    
    async def _validate_role_update(self, role_data: RoleUpdate, existing_role: RoleModel) -> None:
        """Validate role update data."""
        # Check for conflicts if code is being updated
        if role_data.code and role_data.code != existing_role.code:
            existing_role_with_code = await self.role_repo.check_role_exists_by_code(
                role_data.code, exclude_id=existing_role.id
            )
            if existing_role_with_code:
                raise ConflictError(f"Role with code '{role_data.code}' already exists")
        
        # Check for conflicts if name is being updated
        if role_data.name and role_data.name != existing_role.name:
            existing_role_with_name = await self.role_repo.check_role_exists_by_name(
                role_data.name, exclude_id=existing_role.id
            )
            if existing_role_with_name:
                raise ConflictError(f"Role with name '{role_data.name}' already exists")
        
        # Validate parent role exists if specified
        if role_data.parent_id is not None:
            if role_data.parent_id == existing_role.id:
                raise BadRequestError("Role cannot be its own parent")
            
            parent_role = await self.role_repo.get_role_by_id(role_data.parent_id)
            if not parent_role:
                raise BadRequestError(f"Parent role with ID {role_data.parent_id} not found")
            
            # Check for circular hierarchy
            await self._validate_no_circular_hierarchy(existing_role.id, role_data.parent_id)
        
        # Validate permissions format
        if role_data.permissions is not None:
            await self._validate_permissions_format(role_data.permissions)
    
    async def _validate_permissions_format(self, permissions: List[str]) -> None:
        """Validate permissions format and content."""
        # Basic validation - permissions should be non-empty strings
        for permission in permissions:
            if not isinstance(permission, str) or not permission.strip():
                raise BadRequestError("All permissions must be non-empty strings")
            
            # Optional: Validate permission format (e.g., "resource:action:scope")
            if ":" not in permission:
                raise BadRequestError(f"Invalid permission format: {permission}. Expected format: 'resource:action:scope'")
    
    async def _validate_no_circular_hierarchy(self, role_id: int, potential_parent_id: int) -> None:
        """Validate that setting parent_id won't create circular hierarchy."""
        # Check if potential_parent_id is a descendant of role_id
        async def is_descendant(parent_id: int, target_id: int) -> bool:
            children = await self.role_repo.get_roles_by_parent_id(parent_id)
            for child in children:
                if child.id == target_id:
                    return True
                if await is_descendant(child.id, target_id):
                    return True
            return False
        
        if await is_descendant(role_id, potential_parent_id):
            raise BadRequestError("Cannot set parent role: would create circular hierarchy")
    
    async def _enrich_role_data(self, role: RoleModel) -> Role:
        """Enrich basic role data for response."""
        return Role.model_validate(role, from_attributes=True)
    
    async def _enrich_detailed_role_data(self, role: RoleModel) -> RoleDetail:
        """Enrich role data with detailed information."""
        # Get basic role data
        base_role = await self._enrich_role_data(role)
        
        # Get user count
        user_count = await self.role_repo.count_users_with_role(role.id)
        
        # Get parent role
        parent = None
        if role.parent_id:
            parent_role = await self.role_repo.get_role_by_id(role.parent_id)
            if parent_role:
                parent = await self._enrich_role_data(parent_role)
        
        # Get child roles
        child_roles = await self.role_repo.get_roles_by_parent_id(role.id)
        children = []
        for child_role in child_roles:
            child = await self._enrich_role_data(child_role)
            children.append(child)
        
        # Create detailed response
        role_detail_data = base_role.model_dump()
        role_detail_data.update({
            'user_count': user_count,
            'parent': parent,
            'children': children if children else []
        })
        
        return RoleDetail(**role_detail_data)