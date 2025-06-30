from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict, Any, Optional
from uuid import UUID

from ...dependencies.auth import get_current_user
from ...schemas.user import (
    User, UserCreate, UserUpdate, UserProfile,
    UserCreateResponse, UserUpdateResponse, UserInactivateResponse
)
from ...schemas.common import PaginationParams, PaginatedResponse
from ...services.user_service import UserService
from ...core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)

router = APIRouter(prefix="/users", tags=["users"])

# Initialize service
user_service = UserService()


@router.get("/", response_model=PaginatedResponse[UserProfile])
async def get_users(
    current_user: Dict[str, Any] = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Search term for name, email, or employee code"),
    department_id: Optional[UUID] = Query(None, description="Filter by department ID"),
    status: Optional[str] = Query(None, description="Filter by user status"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Page size")
):
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a specific user by ID."""
    try:
        user = await user_service.get_user_by_id(user_id, current_user)
        return user
        
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
