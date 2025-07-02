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

@router.get("/me")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get current user information.
    ToDo: Implement the response schema as `UserResponse` on `schemas/users.py
    """
    return {
        "success": True,
        "data": {
            "user": {
                "id": current_user.get("sub"),
                "employeeCode": "EMP001",
                "name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
                "email": current_user.get("email"),
                "status": "active",
                "department": {
                    "id": "uuid",
                    "name": "営業部",
                    "description": "営業部門"
                },
                "stage": {
                    "id": "uuid",
                    "name": "S2", 
                    "description": "中堅社員"
                },
                "roles": [
                    {
                        "id": 1,
                        "name": current_user.get("role", "employee"),
                        "description": "一般従業員"
                    }
                ],
                "permissions": ["create_goal", "submit_evaluation"],
                "supervisor": {
                    "id": "uuid",
                    "name": "田中 部長"
                }
            }
        }
    }

@router.post("/verify", response_model=TokenVerifyResponse)
async def verify_token(current_user: Dict[str, Any] = Depends(get_current_user)):
    """現在のJWTトークンが有効かどうかを検証し、ユーザー情報を返します。"""
    try:
        user_response = UserAuthResponse(
            id=current_user.get("sub"),
            email=current_user.get("email"),
            first_name=current_user.get("first_name"),
            last_name=current_user.get("last_name"),
            role=current_user.get("role", "employee")
        )
        
        return TokenVerifyResponse(
            valid=True,
            user=user_response
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