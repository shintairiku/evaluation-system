from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.user import User, UserCreate, UserUpdate, UserDetailResponse, UserStatus
from ...schemas.common import PaginatedResponse, PaginationParams, BaseResponse
from ...services.user_service import UserService
from ...dependencies.role import UserRole, get_current_user_with_roles, get_current_user
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=PaginatedResponse[User])
async def get_users(
    user_roles: UserRole = Depends(get_current_user_with_roles),
    search: Optional[str] = Query(None, description="Search term for name, employee code, or job title"),
    department_ids: Optional[list[UUID]] = Query(None, alias="department_ids", description="Filter by department IDs (multi-select)"),
    stage_ids: Optional[list[UUID]] = Query(None, alias="stage_ids", description="Filter by stage IDs (multi-select)"),
    role_ids: Optional[list[UUID]] = Query(None, alias="role_ids", description="Filter by role IDs (multi-select)"),
    statuses: Optional[list[UserStatus]] = Query(None, alias="statuses", description="Filter by user statuses (multi-select)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get users with multi-select filters and role-based access control.
    
    - **Admin/Viewer**: Can see all users
    - **Manager/Supervisor**: Can see subordinates only
    - **Others**: No access to user listing
    
    Supports filtering by:
    - Search term (employee code, name, job title)
    - Department IDs (multi-select)
    - Stage IDs (multi-select) 
    - Role IDs (multi-select)
    - User statuses (multi-select)
    """
    try:
        pagination = PaginationParams(page=page, limit=limit)
        service = UserService(session)
        
        result = await service.get_users(
            current_user_roles=user_roles,
            search_term=search or "",
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            pagination=pagination
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching users: {str(e)}"
        )


@router.get("/{user_id}", response_model=UserDetailResponse)
async def get_user(
    user_id: UUID,
    user_roles: UserRole = Depends(get_current_user_with_roles),
    session: AsyncSession = Depends(get_db_session)
):
    """Get a specific user by ID."""
    try:
        service = UserService(session)
        user = await service.get_user_by_id(user_id, user_roles)
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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    user_roles: UserRole = Depends(get_current_user_with_roles),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new user (admin only)."""
    try:
        service = UserService(session)
        result = await service.create_user(user_create, user_roles)
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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/{user_id}", response_model=UserDetailResponse)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    user_roles: UserRole = Depends(get_current_user_with_roles),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a user."""
    try:
        service = UserService(session)
        result = await service.update_user(user_id, user_update, user_roles)
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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{user_id}", response_model=BaseResponse)
async def delete_user(
    user_id: UUID,
    user_roles: UserRole = Depends(get_current_user_with_roles),
    mode: str = Query("soft", regex="^(soft|hard)$", description="Delete mode: 'soft' (inactivate) or 'hard' (permanent)"),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a user (admin only). Supports both soft delete (inactivation) and hard delete (permanent removal)."""
    try:
        service = UserService(session)
        success = await service.delete_user(
            user_id=user_id, 
            current_user_roles=user_roles,
            mode=mode
        )
        
        if success:
            if mode == "soft":
                return BaseResponse(message="User inactivated successfully")
            else:
                return BaseResponse(message="User permanently deleted successfully")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user"
            )
        
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
    except Exception:
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
