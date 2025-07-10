"""
Simplified security module exports.
"""

from .context import AuthContext, SecurityContext, RoleInfo
from .dependencies import get_auth_context, require_role, require_permission
from .permissions import PermissionManager, Role
from ..core.permissions import Permission

__all__ = [
    "AuthContext", 
    "SecurityContext",  # Backward compatibility alias
    "RoleInfo",
    "get_auth_context",
    "require_role",
    "require_permission",
    "Permission",
    "PermissionManager", 
    "Role"
]