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
    try:
        # Build filters
        filters = {}
        if department_id:
            filters["department_id"] = department_id
        if status:
            filters["status"] = status
        
        # Build pagination
        pagination = PaginationParams(
            page=page,
            size=size,
            limit=size,
            offset=(page - 1) * size
        )
        
        # Get users through service layer
        result = await user_service.get_users(
            current_user=current_user,
            search_term=search or "",
            filters=filters,
            pagination=pagination
        )
        
        return result
        
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
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


@router.post("/", response_model=UserCreateResponse)
async def create_user(
    user_create: UserCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new user (admin only)."""
    try:
        result = await user_service.create_user(user_create, current_user)
        return result
        
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/{user_id}", response_model=UserUpdateResponse)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a user."""
    try:
        result = await user_service.update_user(user_id, user_update, current_user)
        return result
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{user_id}", response_model=UserInactivateResponse)
async def delete_user(
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a user (admin only)."""
    try:
        result = await user_service.inactivate_user(user_id, current_user)
        return result
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except BadRequestError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{user_id}/profile", response_model=UserProfile)
async def get_user_profile(
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user profile for display purposes."""
    try:
        profile = await user_service.get_user_profile(user_id, current_user)
        return profile
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
