from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.user import ProfileOptionsResponse, UserExistsResponse
from ...services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.get("/dev-keys")
async def get_dev_keys():
    """
    Get development API keys for testing different roles.
    """
    return {
        "dev_keys": {
            "admin": {
                "key": "dev-admin-key",
                "role": "admin",
                "description": "Full access to all endpoints including admin operations"
            },
            "manager": {
                "key": "dev-manager-key", 
                "role": "manager",
                "description": "Access to management operations and team oversight"
            },
            "supervisor": {
                "key": "dev-supervisor-key",
                "role": "supervisor", 
                "description": "Access to supervisor operations and direct reports"
            },
            "employee": {
                "key": "dev-employee-key",
                "role": "employee",
                "description": "Basic employee access to own data and evaluations"
            }
        },
        "instructions": [
            "1. Go to http://localhost:8000/docs",
            "2. Click 'Authorize' button", 
            "3. Enter one of the keys above based on the role you want to test",
            "4. Click 'Authorize'",
            "5. Test endpoints - access will be restricted based on the role"
        ]
    }


@router.get("/user/{clerk_user_id}", response_model=UserExistsResponse)
async def check_user_exists_by_clerk_id(
    clerk_user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    """
    Check if user record exists in Users database by Clerk ID.
    This is used during signup flow to check if user already exists.
    """
    try:
        auth_service = AuthService(session=session)
        return await auth_service.check_user_exists_by_clerk_id(clerk_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking user existence: {str(e)}"
        )


@router.get("/signup/profile-options", response_model=ProfileOptionsResponse)
async def get_signup_profile_options(
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all available options for signup form.
    Returns departments, stages, roles, and active users.
    Used during signup flow before user has organization context.
    """
    try:
        auth_service = AuthService(session=session)
        # No context needed for signup profile options
        return await auth_service.get_profile_options()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve profile options: {str(e)}"
        )


@router.post("/logout")
async def logout():
    """
    Logout endpoint - Clerk handles session management client-side.
    """
    return {
        "success": True,
        "message": "Logout successful. Please clear your client-side session."
    }