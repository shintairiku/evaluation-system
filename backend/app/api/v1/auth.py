from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.auth_service import AuthService
from ...schemas.auth import SignUpOptionsResponse
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

        )
    except Exception as e:
        return TokenVerifyResponse(
            valid=False,
            error=str(e)
        )

@router.post("/logout") 
async def logout():
    """
    Placeholder for logout endpoint.
    Full implementation requires session/token management (separate issue).
    """
    raise HTTPException(
        status_code=501, 
        detail="Logout endpoint implementation requires session management - tracked in separate issue"
    )