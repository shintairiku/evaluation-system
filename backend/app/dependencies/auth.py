from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.session import get_db_session
from ..schemas.user import UserExistsResponse
from ..services.auth_service import AuthService

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
) -> UserExistsResponse:
    """
    Dependency to get the current authenticated user with minimal database info.
    TODO: ideally get the user role from clerk and use this function for all endpoints for role-based access control.
    
    Returns:
        UserExistsResponse: Basic user info from database
        
    Raises:
        HTTPException: If token is invalid or user is not authenticated
    """
    try:
        token = credentials.credentials
        
        # Verify token with Clerk
        auth_user = auth_service.get_user_from_token(token)
        
        # Check user exists in database with minimal info
        user_exists_response = await auth_service.check_user_exists_by_clerk_id(auth_user.clerk_id)
        
        if not user_exists_response.exists:
            raise UnauthorizedError("User not found in database")
            
        return user_exists_response
        
    except Exception as e:
        raise UnauthorizedError(f"Invalid authentication credentials: {str(e)}")
