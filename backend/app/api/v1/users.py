from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from ...dependencies.auth import get_current_user
from ...schemas.user import UserPaginatedResponse, User, UserCreate, UserUpdate, UserDetailResponse
# from ...services.user_service import UserService
from ...database.session import get_db_session

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=UserPaginatedResponse)
async def get_users(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get all users (admin, manager, viewer, supervisor roles)."""
    allowed_roles = ["admin", "manager", "viewer", "supervisor"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Required roles: admin, manager, viewer, or supervisor"
        )
    # TODO: Implement user service to fetch users based on role permissions
    # admin: all users, manager: subordinates only, viewer: department-based access, supervisor: subordinates only
    return UserPaginatedResponse(data=[], total=0, limit=10, offset=0)

@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    """Get user details by ID."""
    # TODO: Implement user service to get user details
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="User service not implemented"
    )

@router.post("/", response_model=User)
async def create_user(
    user_create: UserCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new user (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create users"
        )
    
    # TODO: Implement user service to create user
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="User service not implemented"
    )

@router.put("/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a user."""
    # Users can only update their own profile unless they're admin
    if current_user.get("sub") != user_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
    
    # TODO: Implement user service to update user
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="User service not implemented"
    )

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a user (admin only)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete users"
        )
    
    # TODO: Implement user service to delete user
    return {"message": "User deleted successfully"}
