from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_db_session
from ..schemas.user import UserDetailResponse
from ..services.auth_service import AuthService
from ..services.user_service import UserService

# Handle exceptions import - create basic one if not available
try:
    from ..core.exceptions import UnauthorizedError
except ImportError:
    class UnauthorizedError(HTTPException):
        def __init__(self, detail: str):
            super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

security = HTTPBearer()

async def get_auth_service(session: AsyncSession = Depends(get_db_session)) -> AuthService:
    """Get AuthService instance with database session."""
    return AuthService(session=session)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> UserDetailResponse:
    """
    Dependency to get the current authenticated user with full database details.
    
    Returns:
        UserDetailResponse: Full user details from database
        
    Raises:
        HTTPException: If token is invalid or user is not authenticated
    """
    try:
        token = credentials.credentials
        
        # Verify token with Clerk
        auth_user = auth_service.get_user_from_token(token)
        
        # Get user from database
        user_service = UserService(session=auth_service.session)
        user_details = await user_service.get_user_by_clerk_id(auth_user.user_id)
        
        if not user_details:
            raise UnauthorizedError("User not found in database")
            
        return user_details
        
    except Exception as e:
        raise UnauthorizedError(f"Invalid authentication credentials: {str(e)}")


# ========================================
# BACKWARD COMPATIBILITY (TODO: Probably not needed)
# ========================================

async def get_current_user_dict(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user from Clerk JWT token.
    Returns dict format for backward compatibility.
    
    Returns:
        Dict containing user information from the JWT token
        
    Raises:
        HTTPException: If token is invalid or user is not authenticated
    """
    try:
        token = credentials.credentials
        auth_user = auth_service.get_user_from_token(token)
        
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
    current_user: UserDetailResponse = Depends(get_current_user)
) -> UserDetailResponse:
    """
    Dependency to ensure the current user has admin privileges.
    
    Returns:
        UserDetailResponse containing admin user information
        
    Raises:
        HTTPException: If user is not an admin
    """
    # Check if user has admin role (assuming roles is a list of role objects)
    user_roles = [role.name for role in current_user.roles] if current_user.roles else []
    
    if "admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


async def get_supervisor_or_admin_user(
    current_user: UserDetailResponse = Depends(get_current_user)
) -> UserDetailResponse:
    """
    Dependency to ensure the current user has supervisor or admin privileges.
    
    Returns:
        UserDetailResponse containing supervisor/admin user information
        
    Raises:
        HTTPException: If user is not a supervisor or admin
    """
    # Check if user has supervisor or admin role
    user_roles = [role.name for role in current_user.roles] if current_user.roles else []
    
    if not any(role in ["supervisor", "admin"] for role in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor or admin privileges required"
        )
    return current_user


# Backward compatibility - keep the dict version for existing endpoints
async def get_admin_user_dict(
    current_user: Dict[str, Any] = Depends(get_current_user_dict)
) -> Dict[str, Any]:
    """
    Dependency to ensure the current user has admin privileges (dict version).
    
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


async def get_supervisor_or_admin_user_dict(
    current_user: Dict[str, Any] = Depends(get_current_user_dict)
) -> Dict[str, Any]:
    """
    Dependency to ensure the current user has supervisor or admin privileges (dict version).
    
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