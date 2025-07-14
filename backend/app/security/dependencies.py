"""
Simplified FastAPI dependencies for authentication and authorization.

This module provides clean, simple dependencies for RBAC without over-engineering.
"""

from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_db_session
from ..database.repositories.role_repo import RoleRepository
from ..services.auth_service import AuthService
from .permissions import Permission
from .context import AuthContext, RoleInfo

security = HTTPBearer()


async def get_auth_context(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_db_session)
) -> AuthContext:
    """
    Main dependency to get authenticated user's authorization context.
    
    This replaces the complex SecurityContext with a simple, unified approach.
    Use this in any endpoint that needs authentication + authorization.
    
    Returns:
        AuthContext: Complete user auth context with roles and permissions
        
    Raises:
        HTTPException: If authentication fails or user not found
    """
    try:
        # Get token from request
        token = credentials.credentials
        
        # Verify with Clerk and get user info
        auth_service = AuthService(session)
        auth_user = auth_service.get_user_from_token(token)
        
        user_exists = await auth_service.check_user_exists_by_clerk_id(auth_user.clerk_id)
        
        # Get user roles
        role_repo = RoleRepository(session)
        user_roles = await role_repo.get_user_roles(user_exists.user_id)
        
        # Convert to RoleInfo objects
        role_infos = [
            RoleInfo(id=role.id, name=role.name, description=role.description)
            for role in user_roles
        ]
        
        # Create and return AuthContext
        return AuthContext(user_id=user_exists.clerk_id, roles=role_infos)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


def require_role(required_roles: List[str]):
    """
    Simple dependency factory that requires specific roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            auth: AuthContext = Depends(require_role(["admin"]))
        ):
            # Only admins can access this endpoint
            pass
    
    Args:
        required_roles: List of role names required to access the endpoint
        
    Returns:
        FastAPI dependency function that enforces role requirements
    """
    async def check_roles(
        auth_context: AuthContext = Depends(get_auth_context)
    ) -> AuthContext:
        if not auth_context.has_any_role(required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(required_roles)}"
            )
        return auth_context
    
    return check_roles


def require_permission(required_permissions: List[Permission]):
    """
    Simple dependency factory that requires specific permissions.
    
    Usage:
        @router.get("/user-management")
        async def user_endpoint(
            auth: AuthContext = Depends(require_permission([Permission.USER_READ_ALL]))
        ):
            # Only users with USER_READ_ALL permission can access
            pass
    
    Args:
        required_permissions: List of permissions required to access the endpoint
        
    Returns:
        FastAPI dependency function that enforces permission requirements
    """
    async def check_permissions(
        auth_context: AuthContext = Depends(get_auth_context)
    ) -> AuthContext:
        if not any(auth_context.has_permission(perm) for perm in required_permissions):
            permission_names = [perm.value for perm in required_permissions]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required permissions: {', '.join(permission_names)}"
            )
        return auth_context
    
    return check_permissions


# Convenience dependencies for common roles
require_admin = require_role(["admin"])
require_manager_or_admin = require_role(["admin", "manager"])
require_supervisor_or_above = require_role(["admin", "manager", "supervisor"])


# Backward compatibility alias
get_security_context = get_auth_context