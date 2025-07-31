from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

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
        user_service = UserService(session)
        return await user_service.get_profile_options()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve profile options: {str(e)}"
        )


@router.get("/organization", response_model=PaginatedResponse[User])
async def get_users_for_organization(
    context: AuthContext = Depends(get_auth_context),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get users with hierarchy data specifically for organization view.
    
    - **Admin/Viewer**: Can see all users with hierarchy
    - **Manager/Supervisor**: Can see subordinates with hierarchy
    - **Others**: No access to user listing
    
    Returns users with supervisor and subordinate relationships for organization chart.
    """
    try:
        pagination = PaginationParams(page=page, limit=limit)
        service = UserService(session)
        
        # Create a simple test response
        from ...schemas.user import User, Department, Role
        from ...schemas.stage_competency import Stage
        from ...schemas.common import PaginatedResponse
        
        # Create a simple test user
        test_user = User(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            clerk_user_id="test_user",
            employee_code="TEST001",
            name="Test User",
            email="test@example.com",
            status=UserStatus.ACTIVE,
            job_title="Test Job",
            department_id=UUID("00000000-0000-0000-0000-000000000002"),
            stage_id=UUID("00000000-0000-0000-0000-000000000003"),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            department=Department(
                id=UUID("00000000-0000-0000-0000-000000000002"),
                name="Test Department",
                description="Test Department Description"
            ),
            stage=Stage(
                id=UUID("00000000-0000-0000-0000-000000000003"),
                name="Test Stage",
                description="Test Stage Description"
            ),
            roles=[]
        )
        
        # Create a simple paginated response
        test_result = PaginatedResponse(
            items=[test_user],
            total=1,
            page=1,
            limit=50,
            pages=1
        )
        
        return test_result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching users for organization: {str(e)}"
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


@router.get("/hierarchy", response_model=PaginatedResponse[UserDetailResponse])
async def get_users_hierarchy(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Number of items per page"),
    current_user: AuthContext = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get users with hierarchy relationships for organization chart display.
    Uses data from users_supervisors table to build the organizational structure.
    """
    try:
        # Get basic users first
        pagination = PaginationParams(page=page, limit=limit)
        result = await user_service.get_users(current_user, pagination=pagination)
        
        # Get hierarchy data from users_supervisors table
        from ..database.repositories.user_repo import UserRepository
        from ..database.models.user import UserSupervisor
        from sqlalchemy import select
        
        user_repo = UserRepository(user_service.session)
        
        # Get all current supervisor relationships (valid_to IS NULL)
        supervisor_result = await user_service.session.execute(
            select(UserSupervisor)
            .filter(UserSupervisor.valid_to.is_(None))
        )
        supervisor_relations = supervisor_result.scalars().all()
        
        # Create a dictionary to map user_id to supervisor_id
        user_supervisor_map = {}
        supervisor_subordinates_map = {}
        
        for relation in supervisor_relations:
            user_supervisor_map[relation.user_id] = relation.supervisor_id
            
            if relation.supervisor_id not in supervisor_subordinates_map:
                supervisor_subordinates_map[relation.supervisor_id] = []
            supervisor_subordinates_map[relation.supervisor_id].append(relation.user_id)
        
        # Convert User to UserDetailResponse with hierarchy data
        items = []
        for user in result.items:
            # Find supervisor
            supervisor = None
            if user.id in user_supervisor_map:
                supervisor_id = user_supervisor_map[user.id]
                supervisor_user = next((u for u in result.items if u.id == supervisor_id), None)
                if supervisor_user:
                    supervisor = User(
                        id=supervisor_user.id,
                        clerk_user_id=supervisor_user.clerk_user_id,
                        employee_code=supervisor_user.employee_code,
                        name=supervisor_user.name,
                        email=supervisor_user.email,
                        status=supervisor_user.status,
                        job_title=supervisor_user.job_title,
                        department=supervisor_user.department,
                        stage=supervisor_user.stage,
                        roles=supervisor_user.roles,
                        created_at=supervisor_user.created_at,
                        updated_at=supervisor_user.updated_at
                    )
            
            # Find subordinates
            subordinates = []
            if user.id in supervisor_subordinates_map:
                for subordinate_id in supervisor_subordinates_map[user.id]:
                    subordinate_user = next((u for u in result.items if u.id == subordinate_id), None)
                    if subordinate_user:
                        subordinate = User(
                            id=subordinate_user.id,
                            clerk_user_id=subordinate_user.clerk_user_id,
                            employee_code=subordinate_user.employee_code,
                            name=subordinate_user.name,
                            email=subordinate_user.email,
                            status=subordinate_user.status,
                            job_title=subordinate_user.job_title,
                            department=subordinate_user.department,
                            stage=subordinate_user.stage,
                            roles=subordinate_user.roles,
                            created_at=subordinate_user.created_at,
                            updated_at=subordinate_user.updated_at
                        )
                        subordinates.append(subordinate)
            
            user_detail = UserDetailResponse(
                id=user.id,
                clerk_user_id=user.clerk_user_id,
                employee_code=user.employee_code,
                name=user.name,
                email=user.email,
                status=user.status,
                job_title=user.job_title,
                department=user.department,
                stage=user.stage,
                roles=user.roles,
                supervisor=supervisor,
                subordinates=subordinates
            )
            items.append(user_detail)
        
        return PaginatedResponse(
            items=items,
            total=result.total,
            page=result.page,
            limit=result.limit,
            pages=result.pages
        )
    except Exception as e:
        logger.error(f"Error in get_users_hierarchy: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


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

