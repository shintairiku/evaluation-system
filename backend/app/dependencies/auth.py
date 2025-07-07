from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any, List, Optional, Annotated, Callable

from ..core.auth import ClerkAuth
from ..core.clerk_config import ClerkConfig
from ..core.rbac_config import RBACConfig
from ..core.exceptions import UnauthorizedError
from ..core.permissions import PermissionManager

security = HTTPBearer(auto_error=False)
# Initialize with production config (will use actual environment variables)
clerk_auth = ClerkAuth(ClerkConfig())
rbac_config = RBACConfig()

# Engineer admin user for bypass functionality
ENGINEER_ADMIN_USER = {
    "sub": "engineer_bypass_user",
    "email": "engineer@development.local",
    "first_name": "Engineer",
    "last_name": "Developer",
    "role": "admin"
}

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_engineer_access_key: Annotated[Optional[str], Header(alias="X-Engineer-Access-Key")] = None
) -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user from Clerk JWT token.
    Supports engineer bypass in development mode.
    
    Returns:
        Dict containing user information from the JWT token
        
    Raises:
        HTTPException: If token is invalid or user is not authenticated
    """
    try:
        # Check for engineer bypass first (development mode only)
        if (rbac_config.is_development_mode() and 
            x_engineer_access_key and 
            rbac_config.is_valid_engineer_key(x_engineer_access_key)):
            return ENGINEER_ADMIN_USER
        
        # Check if credentials are provided
        if not credentials:
            raise UnauthorizedError("Authentication credentials required")
        
        # Standard JWT token verification
        token = credentials.credentials
        auth_user = clerk_auth.verify_token(token)
        
        # Convert AuthUser to dict for compatibility
        return {
            "sub": auth_user.user_id,
            "email": auth_user.email,
            "first_name": auth_user.first_name,
            "last_name": auth_user.last_name,
            "role": auth_user.role
        }
        
    except Exception as e:
        raise UnauthorizedError(f"Invalid authentication credentials: {str(e)}")


def require_role(allowed_roles: List[str]) -> Callable:
    """
    Dependency factory to require specific roles for accessing endpoints.
    
    Args:
        allowed_roles: List of role names that are allowed to access the endpoint
        
    Returns:
        A dependency function that validates user roles
        
    Example:
        @router.get("/admin-only")
        async def admin_endpoint(user: dict = Depends(require_role(["admin"]))):
            return {"message": "Admin only endpoint"}
            
        @router.get("/supervisor-or-admin")
        async def supervisor_endpoint(user: dict = Depends(require_role(["supervisor", "admin"]))):
            return {"message": "Supervisor or admin endpoint"}
    """
    async def role_checker(
        current_user: Dict[str, Any] = Depends(get_current_user)
    ) -> Dict[str, Any]:
        """
        Check if the current user has one of the required roles.
        Admin users always have access regardless of specific role requirements.
        
        Args:
            current_user: The current authenticated user
            
        Returns:
            Dict containing user information
            
        Raises:
            HTTPException: If user doesn't have required role
        """
        user_role = current_user.get("role", "").lower()
        
        # Admin users always have access
        if user_role == "admin":
            return current_user
        
        # Check if user has one of the required roles
        allowed_roles_lower = [role.lower() for role in allowed_roles]
        if user_role not in allowed_roles_lower:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        
        return current_user
    
    return role_checker


def require_admin() -> Callable:
    """
    Convenience function to require admin role.
    
    Returns:
        A dependency function that validates admin role
    """
    return require_role(["admin"])


def require_supervisor_or_admin() -> Callable:
    """
    Convenience function to require supervisor or admin role.
    
    Returns:
        A dependency function that validates supervisor or admin role
    """
    return require_role(["supervisor", "admin"])


def require_manager_or_admin() -> Callable:
    """
    Convenience function to require manager or admin role.
    
    Returns:
        A dependency function that validates manager or admin role
    """
    return require_role(["manager", "admin"])


# Legacy dependency functions for backwards compatibility
async def get_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency to ensure the current user has admin privileges.
    
    Returns:
        Dict containing admin user information
        
    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


async def get_supervisor_or_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency to ensure the current user has supervisor or admin privileges.
    
    Returns:
        Dict containing supervisor/admin user information
        
    Raises:
        HTTPException: If user is not a supervisor or admin
    """
    if current_user.get("role") not in ["supervisor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor or admin privileges required"
        )
    return current_user


# Optional: Public endpoint dependency for endpoints that don't require authentication
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_engineer_access_key: Annotated[Optional[str], Header(alias="X-Engineer-Access-Key")] = None
) -> Optional[Dict[str, Any]]:
    """
    Dependency to get the current authenticated user, but allow anonymous access.
    Useful for endpoints that behave differently based on authentication status.
    
    Returns:
        Dict containing user information if authenticated, None if not authenticated
    """
    if not credentials:
        return None
    
    try:
        # Check for engineer bypass first (development mode only)
        if (rbac_config.is_development_mode() and 
            x_engineer_access_key and 
            rbac_config.is_valid_engineer_key(x_engineer_access_key)):
            return ENGINEER_ADMIN_USER
        
        # Standard JWT token verification
        token = credentials.credentials
        auth_user = clerk_auth.verify_token(token)
        
        # Convert AuthUser to dict for compatibility
        return {
            "sub": auth_user.user_id,
            "email": auth_user.email,
            "first_name": auth_user.first_name,
            "last_name": auth_user.last_name,
            "role": auth_user.role
        }
        
    except Exception:
        # If authentication fails, return None (anonymous user)
        return None