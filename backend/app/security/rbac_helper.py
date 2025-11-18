"""
RBAC Helper - Standardized Role-Based Access Control Framework

This module provides a unified interface for permission checking and data filtering
across all service functions. It replaces individual permission logic implementations
with standardized, reusable patterns.
"""

import logging
from typing import Optional, List, Dict, Any, Set
from uuid import UUID
from cachetools import TTLCache

from .context import AuthContext
from .permissions import Permission
from .rbac_types import ResourceType, ResourcePermissionMap
from .viewer_visibility import ViewerSubjectType
from ..core.exceptions import PermissionDeniedError

logger = logging.getLogger(__name__)

# Cache for subordinate relationships (100 users, 5-minute TTL)
subordinate_cache = TTLCache(maxsize=100, ttl=300)

# Cache for resource access results (500 items, 2-minute TTL for frequently accessed resources)
resource_access_cache = TTLCache(maxsize=500, ttl=120)


class RBACHelper:
    """
    Unified RBAC helper providing standardized permission checking and data filtering.
    
    This class centralizes role-based access control logic that was previously scattered
    across individual service functions, enabling consistent behavior and easier maintenance.
    """
    
    # Class-level repository reference for when repository is available
    _user_repository = None
    
    @classmethod
    def initialize_with_repository(cls, user_repo):
        """
        Initialize the RBACHelper with a UserRepository instance.
        
        This allows the helper to perform database queries for subordinate relationships
        when used in service layer contexts where repositories are available.
        
        Args:
            user_repo: UserRepository instance
        """
        cls._user_repository = user_repo
    
    @classmethod 
    def get_user_repository(cls):
        """Get the current user repository instance."""
        return cls._user_repository
    
    @staticmethod
    async def get_accessible_user_ids(
        auth_context: AuthContext,
        target_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """
        Get list of user IDs that the current user can access based on their permissions.
        
        Returns:
            None: User can access all users (no filtering needed)
            List[UUID]: Specific user IDs the user can access
            
        Permission Logic:
            - USER_READ_ALL: Returns None (access to all users)
            - USER_READ_SUBORDINATES: Returns list of subordinate user IDs
            - USER_READ_SELF: Returns list containing only current user ID
        """
        cache_key = f"accessible_users_{auth_context.user_id}_{target_user_id}"
        
        # Check cache first
        if cached_result := resource_access_cache.get(cache_key):
            logger.debug(f"Cache hit for accessible user IDs: {auth_context.user_id}")
            return cached_result
        
        base_result: Optional[List[UUID]] = None
        
        if auth_context.has_permission(Permission.USER_READ_ALL):
            # Admin: Can access all users
            base_result = None
        elif auth_context.has_permission(Permission.USER_READ_SUBORDINATES):
            # Manager/Supervisor: Can access subordinates
            subordinate_ids = await RBACHelper._get_subordinate_user_ids(
                auth_context.user_id, RBACHelper.get_user_repository(), auth_context.organization_id
            )
            # Include self in accessible users for managers/supervisors
            base_result = subordinate_ids + ([auth_context.user_id] if auth_context.user_id else [])
        elif auth_context.has_permission(Permission.USER_READ_SELF):
            # Employee: Can only access themselves
            base_result = [auth_context.user_id] if auth_context.user_id else []
        else:
            # No permission to read users
            raise PermissionDeniedError("No permission to read user data")

        final_result = await RBACHelper._apply_viewer_visibility_overrides(
            auth_context,
            ResourceType.USER,
            base_result,
        )

        # Cache the result
        resource_access_cache[cache_key] = final_result
        
        logger.debug(
            f"Computed accessible user IDs for user {auth_context.user_id}: "
            f"{'all' if final_result is None else len(final_result)} users"
        )
        
        return final_result
    
    @staticmethod
    async def get_accessible_resource_ids(
        auth_context: AuthContext,
        resource_type: ResourceType,
        target_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """
        Get list of resource IDs that the current user can access for a specific resource type.
        
        Args:
            auth_context: Current user's authorization context
            resource_type: Type of resource to check access for
            target_user_id: Optional specific user ID to check access for
            
        Returns:
            None: User can access all resources of this type
            List[UUID]: Specific resource IDs the user can access
        """
        cache_key = f"accessible_{resource_type.value}_{auth_context.user_id}_{target_user_id}"
        
        # Check cache first
        if cached_result := resource_access_cache.get(cache_key):
            logger.debug(f"Cache hit for accessible {resource_type.value} IDs: {auth_context.user_id}")
            return cached_result
        
        result = await RBACHelper._compute_resource_access(
            auth_context, resource_type, target_user_id
        )
        
        # Cache the result
        resource_access_cache[cache_key] = result
        
        logger.debug(
            f"Computed accessible {resource_type.value} IDs for user {auth_context.user_id}: "
            f"{'all' if result is None else len(result)} resources"
        )
        
        return result
    
    @staticmethod
    async def can_access_resource(
        auth_context: AuthContext,
        resource_id: UUID,
        resource_type: ResourceType,
        owner_user_id: Optional[UUID] = None
    ) -> bool:
        """
        Check if the current user can access a specific resource.
        
        Args:
            auth_context: Current user's authorization context
            resource_id: ID of the resource to check access for
            resource_type: Type of the resource
            owner_user_id: ID of the user who owns the resource (if applicable)
            
        Returns:
            bool: True if user can access the resource, False otherwise
        """
        cache_key = f"can_access_{resource_type.value}_{resource_id}_{auth_context.user_id}_{owner_user_id}"
        
        # Check cache first
        if cached_result := resource_access_cache.get(cache_key):
            logger.debug(f"Cache hit for resource access check: {cache_key}")
            return cached_result
        
        result = await RBACHelper._check_resource_access(
            auth_context, resource_id, resource_type, owner_user_id
        )
        
        # Cache the result
        resource_access_cache[cache_key] = result
        
        logger.debug(
            f"Resource access check for user {auth_context.user_id} "
            f"on {resource_type.value} {resource_id}: {result}"
        )
        
        return result
    
    @staticmethod
    async def _get_subordinate_user_ids(supervisor_id: UUID, user_repo=None, org_id: str = None) -> List[UUID]:
        """
        Get subordinate user IDs with caching.
        
        This method uses TTL caching to avoid repeated database queries
        for subordinate relationships, which are relatively stable.
        
        Args:
            supervisor_id: The supervisor's user ID
            user_repo: Optional UserRepository instance. If not provided,
                      returns empty list (for backwards compatibility)
            org_id: Organization ID for org-scoped filtering
        """
        cache_key = f"subordinates_{supervisor_id}_{org_id}"
        
        # Check cache first
        if cached_subordinates := subordinate_cache.get(cache_key):
            logger.debug(f"Cache hit for subordinates: {supervisor_id}")
            return cached_subordinates
        
        subordinates = []
        
        if user_repo:
            try:
                # Fetch subordinates from repository with org scope
                if org_id:
                    subordinate_users = await user_repo.get_subordinates(supervisor_id, org_id)
                else:
                    # For backward compatibility, but warn about missing org scope
                    logger.warning(f"No org_id provided for subordinate lookup for user {supervisor_id}. This may cause cross-organization data leaks.")
                    # Try to call without org_id (this will likely fail due to method signature)
                    subordinate_users = await user_repo.get_subordinates(supervisor_id, "")
                
                subordinates = [user.id for user in subordinate_users]
                logger.debug(f"Fetched {len(subordinates)} subordinates for user {supervisor_id} in org {org_id}")
            except Exception as e:
                logger.error(f"Error fetching subordinates for user {supervisor_id} in org {org_id}: {e}")
                subordinates = []
        else:
            logger.warning(
                f"No user repository provided for subordinate lookup for user {supervisor_id}. "
                "Consider using RBACHelper.initialize_with_repository() or passing user_repo parameter."
            )
        
        # Cache the result
        subordinate_cache[cache_key] = subordinates
        
        return subordinates
    
    @staticmethod
    async def _compute_resource_access(
        auth_context: AuthContext,
        resource_type: ResourceType,
        target_user_id: Optional[UUID] = None
    ) -> Optional[List[UUID]]:
        """
        Compute resource access based on resource type and user permissions.
        
        This method implements the core logic for determining which resources
        a user can access based on their role and the resource type.
        """
        resource_permissions = ResourcePermissionMap.get_resource_permissions(resource_type)
        
        # Check for "read_all" permission
        if "read_all" in resource_permissions:
            if auth_context.has_permission(resource_permissions["read_all"]):
                return None  # Access to all resources
        
        # Check for "read_subordinates" permission
        if "read_subordinates" in resource_permissions:
            if auth_context.has_permission(resource_permissions["read_subordinates"]):
                subordinate_ids = await RBACHelper._get_subordinate_user_ids(
                    auth_context.user_id, RBACHelper.get_user_repository(), auth_context.organization_id
                )
                # For resource access, we typically need the user IDs who own the resources
                base_ids = subordinate_ids + ([auth_context.user_id] if auth_context.user_id else [])
                return await RBACHelper._apply_viewer_visibility_overrides(
                    auth_context,
                    resource_type,
                    base_ids,
                )
        
        # Check for "read_self" permission
        if "read_self" in resource_permissions:
            if auth_context.has_permission(resource_permissions["read_self"]):
                base_ids = [auth_context.user_id] if auth_context.user_id else []
                return await RBACHelper._apply_viewer_visibility_overrides(
                    auth_context,
                    resource_type,
                    base_ids,
                )
        
        # Check for general "read" permission (like evaluations)
        if "read" in resource_permissions:
            if auth_context.has_permission(resource_permissions["read"]):
                # For general read permissions, apply same logic as user access
                return await RBACHelper.get_accessible_user_ids(auth_context, target_user_id)

        # No permissions found
        raise PermissionDeniedError(f"No permission to access {resource_type.value} resources")

    @staticmethod
    async def _apply_viewer_visibility_overrides(
        auth_context: AuthContext,
        resource_type: ResourceType,
        base_result: Optional[List[UUID]],
    ) -> Optional[List[UUID]]:
        override_targets = await RBACHelper._get_viewer_visibility_targets(auth_context, resource_type)
        if override_targets is None:
            return base_result
        if base_result is None:
            return None
        combined = set(base_result)
        combined.update(override_targets)
        return list(combined)

    @staticmethod
    async def _get_viewer_visibility_targets(
        auth_context: AuthContext,
        resource_type: ResourceType,
    ) -> Optional[List[UUID]]:
        if not auth_context.has_role("viewer"):
            return None
        overrides = getattr(auth_context, "viewer_visibility_overrides", None)
        if not overrides:
            return None
        resource_map = overrides.get(resource_type)
        if not resource_map:
            return None

        user_repo = RBACHelper.get_user_repository()
        if not user_repo:
            logger.warning(
                "Viewer visibility overrides cannot be resolved because user repository is missing"
            )
            return None
        department_fetcher = getattr(user_repo, "get_users_by_department", None)
        if department_fetcher is None:
            logger.warning(
                "User repository %s does not implement get_users_by_department; "
                "department-based viewer overrides will be ignored",
                type(user_repo).__name__,
            )

        org_id = auth_context.organization_id
        if not org_id or not auth_context.user_id:
            return None

        accessible: Set[UUID] = {auth_context.user_id}
        for subject_type, target_ids in resource_map.items():
            if subject_type == ViewerSubjectType.USER:
                accessible.update(target_ids)
            elif subject_type == ViewerSubjectType.DEPARTMENT:
                for department_id in target_ids:
                    if department_fetcher is None:
                        continue
                    department_users = await department_fetcher(department_id, org_id)
                    accessible.update(user.id for user in department_users)
            elif subject_type == ViewerSubjectType.SUPERVISOR_TEAM:
                for supervisor_id in target_ids:
                    subordinate_ids = await RBACHelper._get_subordinate_user_ids(
                        supervisor_id,
                        user_repo,
                        org_id,
                    )
                    accessible.update(subordinate_ids)
                    accessible.add(supervisor_id)
            else:
                logger.warning("Unknown viewer subject type %s encountered", subject_type)

        return list(accessible)
    
    @staticmethod
    async def _check_resource_access(
        auth_context: AuthContext,
        resource_id: UUID,
        resource_type: ResourceType,
        owner_user_id: Optional[UUID] = None
    ) -> bool:
        """
        Check if user can access a specific resource instance.
        
        This method performs granular access checks for individual resources,
        taking into account ownership and hierarchical relationships.
        """
        try:
            accessible_user_ids = await RBACHelper.get_accessible_resource_ids(
                auth_context, resource_type
            )
            
            # If accessible_user_ids is None, user has access to all resources
            if accessible_user_ids is None:
                return True
            
            # If we have owner information, check if owner is accessible
            if owner_user_id and owner_user_id in accessible_user_ids:
                return True
            
            # TODO: For more complex resource access checks, we would need to:
            # 1. Query the resource to get its owner/associated users
            # 2. Check if any of those users are in accessible_user_ids
            # For now, we'll implement a basic check
            
            return False
            
        except PermissionDeniedError:
            return False
    
    @staticmethod
    def clear_cache(user_id: Optional[UUID] = None):
        """
        Clear RBAC caches for a specific user or all users.
        
        This method should be called when:
        - User permissions change
        - Subordinate relationships are modified
        - Role assignments are updated
        """
        if user_id:
            # Clear specific user's cache entries
            keys_to_remove = [
                key for key in resource_access_cache.keys()
                if str(user_id) in str(key)
            ]
            for key in keys_to_remove:
                resource_access_cache.pop(key, None)
            
            subordinate_cache.pop(f"subordinates_{user_id}", None)
            
            logger.info(f"Cleared RBAC cache for user {user_id}")
        else:
            # Clear all caches
            resource_access_cache.clear()
            subordinate_cache.clear()
            logger.info("Cleared all RBAC caches")
    
    @staticmethod
    def validate_user_update_fields(auth_context: AuthContext, user_data: Dict[str, Any], target_user_id: UUID) -> None:
        """
        Validate that the user can update the specified fields in UserUpdate based on their permissions.
        
        Permission levels:
        - USER_MANAGE: Can update all fields (admin only)
        - USER_MANAGE_PLUS: Can update basic fields + subordinate_ids (manager/supervisor)
        - USER_MANAGE_BASIC: Can update only name, job_title, department_id (employee/parttime)
        
        Args:
            auth_context: Current user's authorization context
            user_data: Dictionary of fields to be updated
            target_user_id: ID of user being updated
            
        Raises:
            PermissionDeniedError: If user lacks permission to update specified fields
        """
        # Remove None values to only check fields that are actually being updated
        updating_fields = {k: v for k, v in user_data.items() if v is not None}
        
        if not updating_fields:
            return  # No fields to update
        
        # Define field permission groups
        basic_fields = {"name", "job_title", "department_id"}
        plus_fields = basic_fields | {"subordinate_ids"}
        # all_fields = plus_fields | {"email", "employee_code", "stage_id", "role_ids", "supervisor_id", "status"}
        
        # Check permission levels
        if auth_context.has_permission(Permission.USER_MANAGE):
            # Admin can update all fields
            return
        elif auth_context.has_permission(Permission.USER_MANAGE_PLUS):
            # Manager/Supervisor can update basic + subordinate_ids
            # But only on subordinates, not on themselves for subordinate_ids
            if "subordinate_ids" in updating_fields and target_user_id == auth_context.user_id:
                raise PermissionDeniedError("Cannot modify your own subordinate relationships")
            
            forbidden_fields = set(updating_fields.keys()) - plus_fields
            if forbidden_fields:
                raise PermissionDeniedError(
                    f"Insufficient permission to update fields: {', '.join(forbidden_fields)}. "
                    f"USER_MANAGE_PLUS allows only: {', '.join(plus_fields)}"
                )
        elif auth_context.has_permission(Permission.USER_MANAGE_BASIC):
            # Employee/Parttime can update only basic fields, and only on themselves
            if target_user_id != auth_context.user_id:
                raise PermissionDeniedError("USER_MANAGE_BASIC permission only allows updating your own profile")
            
            forbidden_fields = set(updating_fields.keys()) - basic_fields
            if forbidden_fields:
                raise PermissionDeniedError(
                    f"Insufficient permission to update fields: {', '.join(forbidden_fields)}. "
                    f"USER_MANAGE_BASIC allows only: {', '.join(basic_fields)}"
                )
        else:
            # No update permission at all
            raise PermissionDeniedError("No permission to update user information")
