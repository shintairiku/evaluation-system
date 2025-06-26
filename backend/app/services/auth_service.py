from typing import Optional, List

from ..core.auth import ClerkAuth, AuthUser
from ..core.clerk_config import ClerkConfig
from ..core.permissions import PermissionManager, Permission, Role


class AuthService:
    """Service layer for authentication operations."""
    
    def __init__(self, config: Optional[ClerkConfig] = None):
        """
        Initialize authentication service.
        
        Args:
            config: Clerk configuration instance
        """
        self.clerk_auth = ClerkAuth(config)
    
    def verify_token(self, token: str) -> AuthUser:
        """
        Verify a JWT token and return user information.
        
        Args:
            token: JWT token string
            
        Returns:
            AuthUser: Authenticated user information
            
        Raises:
            Exception: If token verification fails
        """
        return self.clerk_auth.verify_token(token)
    
    def get_user_permissions(self, user: AuthUser) -> List[str]:
        """
        Get user permissions based on role using centralized permission system.
        
        Args:
            user: Authenticated user
            
        Returns:
            List[str]: User permissions as string values
        """
        permissions_set = PermissionManager.get_role_permissions(user.role)
        return [perm.value for perm in permissions_set]
    
    def has_permission(self, user: AuthUser, permission: str) -> bool:
        """
        Check if user has a specific permission.
        
        Args:
            user: Authenticated user
            permission: Permission string to check
            
        Returns:
            bool: True if user has permission
        """
        try:
            # Convert string permission to Permission enum
            permission_enum = Permission(permission)
            return PermissionManager.has_permission(user.role, permission_enum)
        except ValueError:
            # If permission string doesn't match any enum, return False
            return False
    
    def has_permission_enum(self, user: AuthUser, permission: Permission) -> bool:
        """
        Check if user has a specific permission using Permission enum.
        
        Args:
            user: Authenticated user
            permission: Permission enum to check
            
        Returns:
            bool: True if user has permission
        """
        return PermissionManager.has_permission(user.role, permission)
    
    def has_any_permission(self, user: AuthUser, permissions: List[Permission]) -> bool:
        """
        Check if user has any of the specified permissions.
        
        Args:
            user: Authenticated user
            permissions: List of Permission enums to check
            
        Returns:
            bool: True if user has any of the permissions
        """
        return PermissionManager.has_any_permission(user.role, permissions)
    
    def has_all_permissions(self, user: AuthUser, permissions: List[Permission]) -> bool:
        """
        Check if user has all of the specified permissions.
        
        Args:
            user: Authenticated user
            permissions: List of Permission enums to check
            
        Returns:
            bool: True if user has all permissions
        """
        return PermissionManager.has_all_permissions(user.role, permissions)
    
    def is_admin(self, user: AuthUser) -> bool:
        """
        Check if user is admin.
        
        Args:
            user: Authenticated user
            
        Returns:
            bool: True if user is admin
        """
        return user.role.lower() == Role.ADMIN.value
    
    def is_supervisor_or_above(self, user: AuthUser) -> bool:
        """
        Check if user is supervisor, manager, or admin.
        
        Args:
            user: Authenticated user
            
        Returns:
            bool: True if user is supervisor or above
        """
        return PermissionManager.is_supervisor_or_above(user.role)
    
    def can_manage_users(self, user: AuthUser) -> bool:
        """
        Check if user can manage other users.
        
        Args:
            user: Authenticated user
            
        Returns:
            bool: True if user can manage users
        """
        return PermissionManager.can_manage_users(user.role)
    
    def get_role_description(self, user: AuthUser) -> str:
        """
        Get human-readable description for user's role.
        
        Args:
            user: Authenticated user
            
        Returns:
            str: Role description
        """
        return PermissionManager.get_role_description(user.role)