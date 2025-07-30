from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.user import User, UserCreate, UserUpdate, UserDetailResponse, UserStatus, UserExistsResponse, ProfileOptionsResponse
from ...schemas.common import PaginatedResponse, PaginationParams, BaseResponse
from ...services.user_service import UserService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/exists/{clerk_user_id}", response_model=UserExistsResponse)
async def check_user_exists_by_clerk_id(
    clerk_user_id: str,
    session: AsyncSession = Depends(get_db_session)
):
    """
    Check if user record exists in Users database by Clerk ID.
    This is a user lookup operation, equivalent to GET /auth/user/{clerk_user_id}
    """
    try:
        user_service = UserService(session=session)
        return await user_service.check_user_exists_by_clerk_id(clerk_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking user existence: {str(e)}"
        )


@router.get("/profile-options", response_model=ProfileOptionsResponse)
async def get_profile_options(
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all available options for signup form.
    Returns departments, stages, roles, and active users.
    This is equivalent to GET /auth/signup/profile-options
    No authentication required as this is needed for signup flow.
    """
    try:
        user_service = UserService(session=session)
        return await user_service.get_profile_options()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve profile options: {str(e)}"
        )




@router.get("/", response_model=PaginatedResponse[User])
async def get_users(
    context: AuthContext = Depends(get_auth_context),
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
            current_user_context=context,
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
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get a specific user by ID."""
    try:
        service = UserService(session)
        user = await service.get_user_by_id(user_id, context)
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
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Create a new user.
    
    Uses UserService.create_user with authentication context.
    Service layer handles permission logic.
    """
    try:
        user_service = UserService(session=session)
        result = await user_service.create_user(user_create, context)
        return result
        
    except ValueError as e:
        # User already exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User creation failed: {str(e)}"
        )


@router.put("/{user_id}", response_model=UserDetailResponse)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a user."""
    try:
        service = UserService(session)
        result = await service.update_user(user_id, user_update, context)
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
    context: AuthContext = Depends(get_auth_context),
    mode: str = Query("soft", regex="^(soft|hard)$", description="Delete mode: 'soft' (inactivate) or 'hard' (permanent)"),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a user (admin only). Supports both soft delete (inactivation) and hard delete (permanent removal)."""
    try:
        service = UserService(session)
        success = await service.delete_user(
            user_id=user_id, 
            current_user_context=context,
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

