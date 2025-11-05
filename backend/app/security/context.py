"""
AuthContext - Simplified authorization context for authenticated users.

This class represents the authorization state of an authenticated user,
with simplified role-based permission checking.
"""

from __future__ import annotations
from typing import Dict, List, Set, Optional, Union
from uuid import UUID
from dataclasses import dataclass

from .permissions import Permission


@dataclass
class RoleInfo:
    """Information about a user's role."""
    id: Union[int, UUID]
    name: str
    description: str


class AuthContext:
    """
    Simplified authorization context for an authenticated user.
    
    Combines authentication (user identity) with authorization (permissions)
    in a single, simple class that replaces the over-engineered SecurityContext.
    """
    
    def __init__(
        self,
        user_id: Optional[UUID] = None,
        roles: Optional[List[RoleInfo]] = None,
        clerk_user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        organization_slug: Optional[str] = None,
        role_permission_overrides: Optional[Dict[str, Set[Permission]]] = None,
    ):
        self.user_id = user_id
        self.clerk_user_id = clerk_user_id
        self.organization_id = organization_id
        self.organization_slug = organization_slug
        self.roles = roles or []
        self.role_names = [role.name for role in self.roles]
        self.role_ids = [role.id for role in self.roles]
        self._role_permission_overrides = {
            name.lower(): perms for name, perms in (role_permission_overrides or {}).items()
        }
        
        # Compute permissions once at initialization
        self._permissions = self._compute_permissions()
    
    def _compute_permissions(self) -> Set[Permission]:
        """Compute all permissions from user's roles."""
        all_permissions = set()
        for role in self.roles:
            role_permissions = self._role_permission_overrides.get(role.name.lower(), set())
            all_permissions.update(role_permissions)
        return all_permissions
    
    # Core Permission Checking Methods
    
    def has_permission(self, permission: Permission) -> bool:
        """Check if user has a specific permission."""
        return permission in self._permissions
    
    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role by name."""
        return role_name.lower() in [role.lower() for role in self.role_names]
    
    def has_any_role(self, role_names: List[str]) -> bool:
        """Check if user has any of the specified roles."""
        return any(self.has_role(role_name) for role_name in role_names)
    
    # Helper Methods for Permission Checking
    
    def require_permission(self, permission: Permission) -> None:
        """
        Require a specific permission, raise PermissionDeniedError if not granted.
        
        Usage in service methods:
            auth_context.require_permission(Permission.USER_READ_ALL)
        """
        if not self.has_permission(permission):
            from ..core.exceptions import PermissionDeniedError
            raise PermissionDeniedError(f"Permission denied: {permission.value}")
    
    def require_any_permission(self, permissions: List[Permission]) -> None:
        """
        Require any of the specified permissions, raise PermissionDeniedError if none granted.
        
        Usage in service methods:
            auth_context.require_any_permission([Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES])
        """
        if not any(self.has_permission(perm) for perm in permissions):
            from ..core.exceptions import PermissionDeniedError
            permission_names = [perm.value for perm in permissions]
            raise PermissionDeniedError(f"Permission denied: requires any of {permission_names}")
    
    def require_role(self, role_name: str) -> None:
        """
        Require a specific role, raise PermissionDeniedError if not granted.
        
        Usage in service methods:
            auth_context.require_role("admin")
        """
        if not self.has_role(role_name):
            from ..core.exceptions import PermissionDeniedError
            raise PermissionDeniedError(f"Access denied: requires {role_name} role")
    
    # Convenience Methods
    
    def is_admin(self) -> bool:
        """Check if user is an admin."""
        return self.has_role("admin")
    
    def is_manager_or_above(self) -> bool:
        """Check if user is manager or admin."""
        return self.has_any_role(["admin", "manager"])
    
    def is_supervisor_or_above(self) -> bool:
        """Check if user is supervisor, manager, or admin."""
        return self.has_any_role(["admin", "manager", "supervisor"])
    
    def __str__(self) -> str:
        """String representation for debugging."""
        return f"AuthContext(user_id={self.user_id}, organization_id={self.organization_id}, roles={self.role_names})"
    
    def __repr__(self) -> str:
        """Detailed representation for debugging."""
        return (f"AuthContext(user_id={self.user_id}, "
                f"organization_id={self.organization_id}, "
                f"organization_slug={self.organization_slug}, "
                f"roles={[role.name for role in self.roles]}, "
                f"permissions={len(self._permissions)})")


# Alias for backward compatibility during transition
SecurityContext = AuthContext
