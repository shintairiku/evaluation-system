from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any

from ..core.auth import ClerkAuth
from ..core.clerk_config import ClerkConfig
from ..core.exceptions import UnauthorizedError

security = HTTPBearer()
# Initialize with production config (will use actual environment variables)
clerk_auth = ClerkAuth(ClerkConfig())

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user from Clerk JWT token.
    
    Returns:
        Dict containing user information from the JWT token
        
    Raises:
        HTTPException: If token is invalid or user is not authenticated
    """
    try:
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