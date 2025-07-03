from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.auth_service import AuthService
from ...schemas.auth import SignUpOptionsResponse, UserSignUpRequest
from ...database.session import get_db_session

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.get("/signup/profile-options", response_model=SignUpOptionsResponse)
async def get_profile_options(
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all available options for signup form.
    Returns departments, stages, roles, and active users.
    """
    try:
        auth_service = AuthService(session=session)
        return await auth_service.get_profile_options()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve profile options: {str(e)}"
        )

@router.get("/user/{clerk_user_id}")
async def check_user_exists_by_clerk_id(
    clerk_user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    """
    Check if user record exists in Users database by Clerk ID.
    """
    auth_service = AuthService(session=session)
    return await auth_service.check_user_exists_by_clerk_id(clerk_user_id)

@router.post("/signup")
async def signup(
    signup_data: UserSignUpRequest,
    session: AsyncSession = Depends(get_db_session)
):
    """
    Complete user signup with profile data.
    
    Frontend sends clerk_user_id + profile data.
    Creates user in database with pending_approval status.
    """
    try:
        auth_service = AuthService(session=session)
        
        # Create user with signup data (automatically sets PENDING_APPROVAL)
        user_details = await auth_service.complete_signup(signup_data)
        
        return {
            "success": True,
            "message": "User registration successful. Account is pending approval.",
            "user": user_details
        }
        
    except ValueError as e:
        # User already exists
        raise HTTPException(
            status_code=409,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Registration failed: {str(e)}"
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