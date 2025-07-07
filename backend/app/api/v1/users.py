import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict, Any, Optional
from uuid import UUID

from ...dependencies.auth import get_current_user, require_role, require_admin
from ...schemas.user import (
    User, UserCreate, UserUpdate, UserProfile,
    UserCreateResponse, UserUpdateResponse, UserInactivateResponse,
    UserStatus
)
from ...schemas.common import PaginationParams, PaginatedResponse
from ...services.user_service import UserService
from ...core.exceptions import (
    NotFoundError, ConflictError, ValidationError, 
    PermissionDeniedError, BadRequestError
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])

# Initialize service
user_service = UserService()


@router.get(
    "/", 
    response_model=PaginatedResponse[UserProfile],
    summary="List users with filtering and pagination",
    description="""
    Get a paginated list of users based on the current user's role and permissions.
    
    **Role-based Access:**
    - **Admin**: Can view all users
    - **Manager/Supervisor**: Can view subordinates only
    - **Employee**: Can view own profile only
    - **Viewer**: Can view users in same department
    
    **Query Parameters:**
    - `search`: Search by name, email, or employee code
    - `department_id`: Filter by department
    - `role_name`: Filter by role name
    - `status`: Filter by user status (active/inactive)
    - `page`: Page number (default: 1)
    - `size`: Page size (default: 10, max: 100)
    """,
    responses={
        200: {
            "description": "Successfully retrieved users",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                "id": "123e4567-e89b-12d3-a456-426614174000",
                                "clerk_user_id": "user_123",
                                "employee_code": "EMP001",
                                "name": "John Doe",
                                "email": "john.doe@example.com",
                                "status": "active",
                                "job_title": "Software Engineer",
                                "department": {
                                    "id": "456e7890-e89b-12d3-a456-426614174000",
                                    "name": "Engineering"
                                },
                                "stage": {
                                    "id": "789e0123-e89b-12d3-a456-426614174000",
                                    "name": "Senior"
                                },
                                "roles": [
                                    {
                                        "id": 1,
                                        "name": "employee",
                                        "description": "Regular employee"
                                    }
                                ],
                                "last_login_at": "2025-01-03T10:30:00Z"
                            }
                        ],
                        "total": 1,
                        "page": 1,
                        "size": 10,
                        "pages": 1
                    }
                }
            }
        },
        401: {"description": "Unauthorized - Invalid or missing authentication token"},
        403: {"description": "Forbidden - Insufficient permissions to view users"},
        422: {"description": "Validation error - Invalid query parameters"},
        500: {"description": "Internal server error"}
    }
)
async def get_users(
    current_user: Dict[str, Any] = Depends(get_current_user),
    search: Optional[str] = Query(
        None, 
        description="Search term for name, email, or employee code",
        example="john"
    ),
    department_id: Optional[UUID] = Query(
        None, 
        description="Filter by department ID",
        example="456e7890-e89b-12d3-a456-426614174000"
    ),
    role_name: Optional[str] = Query(
        None, 
        description="Filter by role name",
        example="employee"
    ),
    status: Optional[UserStatus] = Query(
        None, 
        description="Filter by user status",
        example="active"
    ),
    page: int = Query(
        1, 
        ge=1, 
        description="Page number",
        example=1
    ),
    size: int = Query(
        10, 
        ge=1, 
        le=100, 
        description="Page size (maximum 100)",
        example=10
    )
):
    """
    Get all users with filtering and pagination.
    
    The response is filtered based on the current user's role and permissions.
    """
    logger.info(f"GET /users/ - User: {current_user.get('sub')}, Role: {current_user.get('role')}")
    
    try:
        # Build filters
        filters = {}
        if department_id:
            filters["department_id"] = department_id
        if role_name:
            filters["role_name"] = role_name
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
        
        logger.info(f"GET /users/ - Success: {len(result.items)} users returned")
        return result
        
    except PermissionDeniedError as e:
        logger.warning(f"GET /users/ - Permission denied: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValidationError as e:
        logger.warning(f"GET /users/ - Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"GET /users/ - Internal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get(
    "/{user_id}", 
    response_model=User,
    summary="Get specific user by ID",
    description="""
    Get detailed information about a specific user by ID.
    
    **Role-based Access:**
    - **Admin**: Can view any user
    - **Manager/Supervisor**: Can view subordinates and own profile
    - **Employee**: Can view own profile only
    - **Viewer**: Can view users in same department
    """,
    responses={
        200: {
            "description": "Successfully retrieved user",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "clerk_user_id": "user_123",
                        "name": "John Doe",
                        "email": "john.doe@example.com",
                        "employee_code": "EMP001",
                        "status": "active",
                        "job_title": "Software Engineer",
                        "department_id": "456e7890-e89b-12d3-a456-426614174000",
                        "stage_id": "789e0123-e89b-12d3-a456-426614174000",
                        "supervisor_id": "abc12345-e89b-12d3-a456-426614174000",
                        "created_at": "2025-01-01T00:00:00Z",
                        "updated_at": "2025-01-03T10:30:00Z",
                        "last_login_at": "2025-01-03T10:30:00Z",
                        "department": {
                            "id": "456e7890-e89b-12d3-a456-426614174000",
                            "name": "Engineering"
                        },
                        "stage": {
                            "id": "789e0123-e89b-12d3-a456-426614174000",
                            "name": "Senior"
                        },
                        "roles": [
                            {
                                "id": 1,
                                "name": "employee",
                                "description": "Regular employee"
                            }
                        ],
                        "supervisor": {
                            "id": "abc12345-e89b-12d3-a456-426614174000",
                            "clerk_user_id": "user_456",
                            "employee_code": "EMP002",
                            "name": "Jane Smith",
                            "email": "jane.smith@example.com",
                            "status": "active",
                            "job_title": "Team Lead",
                            "department": {
                                "id": "456e7890-e89b-12d3-a456-426614174000",
                                "name": "Engineering"
                            },
                            "stage": {
                                "id": "789e0123-e89b-12d3-a456-426614174000",
                                "name": "Senior"
                            },
                            "roles": [
                                {
                                    "id": 2,
                                    "name": "supervisor",
                                    "description": "Team supervisor"
                                }
                            ],
                            "last_login_at": "2025-01-03T09:00:00Z"
                        }
                    }
                }
            }
        },
        401: {"description": "Unauthorized - Invalid or missing authentication token"},
        403: {"description": "Forbidden - Insufficient permissions to view this user"},
        404: {"description": "Not found - User with specified ID does not exist"},
        500: {"description": "Internal server error"}
    }
)
async def get_user(
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get a specific user by ID with permission checks.
    """
    logger.info(f"GET /users/{user_id} - User: {current_user.get('sub')}, Role: {current_user.get('role')}")
    
    try:
        user = await user_service.get_user_by_id(user_id, current_user)
        logger.info(f"GET /users/{user_id} - Success")
        return user
        
    except NotFoundError as e:
        logger.warning(f"GET /users/{user_id} - Not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        logger.warning(f"GET /users/{user_id} - Permission denied: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"GET /users/{user_id} - Internal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post(
    "/", 
    response_model=UserCreateResponse,
    summary="Create a new user",
    description="""
    Create a new user in the system.
    
    **Role-based Access:**
    - **Admin only**: Only administrators can create new users
    
    **Validation Rules:**
    - Employee code must be unique
    - Email must be unique
    - Clerk user ID must be unique
    - Role IDs must be valid
    - Department and stage must exist
    """,
    responses={
        200: {
            "description": "User created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "user": {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "clerk_user_id": "user_123",
                            "name": "John Doe",
                            "email": "john.doe@example.com",
                            "employee_code": "EMP001",
                            "status": "active",
                            "job_title": "Software Engineer",
                            "department_id": "456e7890-e89b-12d3-a456-426614174000",
                            "stage_id": "789e0123-e89b-12d3-a456-426614174000",
                            "supervisor_id": "abc12345-e89b-12d3-a456-426614174000",
                            "created_at": "2025-01-03T10:30:00Z",
                            "updated_at": "2025-01-03T10:30:00Z",
                            "last_login_at": None,
                            "department": {
                                "id": "456e7890-e89b-12d3-a456-426614174000",
                                "name": "Engineering"
                            },
                            "stage": {
                                "id": "789e0123-e89b-12d3-a456-426614174000",
                                "name": "Senior"
                            },
                            "roles": [
                                {
                                    "id": 1,
                                    "name": "employee",
                                    "description": "Regular employee"
                                }
                            ],
                            "supervisor": None
                        },
                        "message": "User created successfully"
                    }
                }
            }
        },
        400: {"description": "Bad request - Invalid request data"},
        401: {"description": "Unauthorized - Invalid or missing authentication token"},
        403: {"description": "Forbidden - Only administrators can create users"},
        409: {"description": "Conflict - User with same email, employee code, or clerk ID already exists"},
        422: {"description": "Validation error - Invalid user data"},
        500: {"description": "Internal server error"}
    }
)
async def create_user(
    user_create: UserCreate,
    current_user: Dict[str, Any] = Depends(require_admin())
):
    """
    Create a new user (admin only).
    """
    logger.info(f"POST /users/ - User: {current_user.get('sub')}, Role: {current_user.get('role')}")
    
    try:
        result = await user_service.create_user(user_create, current_user)
        logger.info(f"POST /users/ - Success: User {result.user.id} created")
        return result
        
    except PermissionDeniedError as e:
        logger.warning(f"POST /users/ - Permission denied: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ConflictError as e:
        logger.warning(f"POST /users/ - Conflict: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        logger.warning(f"POST /users/ - Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"POST /users/ - Internal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put(
    "/{user_id}", 
    response_model=UserUpdateResponse,
    summary="Update user information",
    description="""
    Update user information with permission checks.
    
    **Role-based Access:**
    - **Admin**: Can update any user
    - **Users**: Can update their own profile (limited fields)
    - **Manager/Supervisor**: Can update subordinates (limited fields)
    
    **Updateable Fields:**
    - name, email, employee_code, job_title
    - department_id, stage_id, role_ids
    - supervisor_id, status (admin only)
    """,
    responses={
        200: {
            "description": "User updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "user": {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "clerk_user_id": "user_123",
                            "name": "John Doe Updated",
                            "email": "john.doe.updated@example.com",
                            "employee_code": "EMP001",
                            "status": "active",
                            "job_title": "Senior Software Engineer",
                            "department_id": "456e7890-e89b-12d3-a456-426614174000",
                            "stage_id": "789e0123-e89b-12d3-a456-426614174000",
                            "supervisor_id": "abc12345-e89b-12d3-a456-426614174000",
                            "created_at": "2025-01-01T00:00:00Z",
                            "updated_at": "2025-01-03T10:30:00Z",
                            "last_login_at": "2025-01-03T09:00:00Z",
                            "department": {
                                "id": "456e7890-e89b-12d3-a456-426614174000",
                                "name": "Engineering"
                            },
                            "stage": {
                                "id": "789e0123-e89b-12d3-a456-426614174000",
                                "name": "Senior"
                            },
                            "roles": [
                                {
                                    "id": 1,
                                    "name": "employee",
                                    "description": "Regular employee"
                                }
                            ],
                            "supervisor": None
                        },
                        "message": "User updated successfully"
                    }
                }
            }
        },
        400: {"description": "Bad request - Invalid request data"},
        401: {"description": "Unauthorized - Invalid or missing authentication token"},
        403: {"description": "Forbidden - Insufficient permissions to update this user"},
        404: {"description": "Not found - User with specified ID does not exist"},
        409: {"description": "Conflict - User with same email or employee code already exists"},
        422: {"description": "Validation error - Invalid user data"},
        500: {"description": "Internal server error"}
    }
)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(require_role(["admin", "manager"]))
):
    """
    Update a user with permission checks.
    """
    logger.info(f"PUT /users/{user_id} - User: {current_user.get('sub')}, Role: {current_user.get('role')}")
    
    try:
        result = await user_service.update_user(user_id, user_update, current_user)
        logger.info(f"PUT /users/{user_id} - Success")
        return result
        
    except NotFoundError as e:
        logger.warning(f"PUT /users/{user_id} - Not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        logger.warning(f"PUT /users/{user_id} - Permission denied: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ConflictError as e:
        logger.warning(f"PUT /users/{user_id} - Conflict: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        logger.warning(f"PUT /users/{user_id} - Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"PUT /users/{user_id} - Internal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete(
    "/{user_id}", 
    response_model=UserInactivateResponse,
    summary="Delete (inactivate) a user",
    description="""
    Delete a user by setting their status to inactive.
    
    **Role-based Access:**
    - **Admin only**: Only administrators can delete users
    
    **Business Rules:**
    - Users cannot delete themselves
    - Users with subordinates cannot be deleted
    - User data is preserved but marked as inactive
    """,
    responses={
        200: {
            "description": "User inactivated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "User inactivated successfully"
                    }
                }
            }
        },
        400: {"description": "Bad request - Cannot delete user (has subordinates or is self)"},
        401: {"description": "Unauthorized - Invalid or missing authentication token"},
        403: {"description": "Forbidden - Only administrators can delete users"},
        404: {"description": "Not found - User with specified ID does not exist"},
        500: {"description": "Internal server error"}
    }
)
async def delete_user(
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a user (admin only).
    """
    logger.info(f"DELETE /users/{user_id} - User: {current_user.get('sub')}, Role: {current_user.get('role')}")
    
    try:
        result = await user_service.inactivate_user(user_id, current_user)
        logger.info(f"DELETE /users/{user_id} - Success")
        return result
        
    except NotFoundError as e:
        logger.warning(f"DELETE /users/{user_id} - Not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        logger.warning(f"DELETE /users/{user_id} - Permission denied: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except BadRequestError as e:
        logger.warning(f"DELETE /users/{user_id} - Bad request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"DELETE /users/{user_id} - Internal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get(
    "/{user_id}/profile", 
    response_model=UserProfile,
    summary="Get user profile for display",
    description="""
    Get user profile information optimized for display purposes.
    
    **Role-based Access:**
    - **Admin**: Can view any user profile
    - **Manager/Supervisor**: Can view subordinates and own profile
    - **Employee**: Can view own profile only
    - **Viewer**: Can view users in same department
    
    **Profile Information:**
    - Basic user information
    - Department and stage details
    - Role information
    - Last login timestamp
    """,
    responses={
        200: {
            "description": "Successfully retrieved user profile",
            "content": {
                "application/json": {
                    "example": {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "clerk_user_id": "user_123",
                        "employee_code": "EMP001",
                        "name": "John Doe",
                        "email": "john.doe@example.com",
                        "status": "active",
                        "job_title": "Software Engineer",
                        "department": {
                            "id": "456e7890-e89b-12d3-a456-426614174000",
                            "name": "Engineering"
                        },
                        "stage": {
                            "id": "789e0123-e89b-12d3-a456-426614174000",
                            "name": "Senior"
                        },
                        "roles": [
                            {
                                "id": 1,
                                "name": "employee",
                                "description": "Regular employee"
                            }
                        ],
                        "last_login_at": "2025-01-03T10:30:00Z"
                    }
                }
            }
        },
        401: {"description": "Unauthorized - Invalid or missing authentication token"},
        403: {"description": "Forbidden - Insufficient permissions to view this profile"},
        404: {"description": "Not found - User with specified ID does not exist"},
        500: {"description": "Internal server error"}
    }
)
async def get_user_profile(
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get user profile for display purposes.
    """
    logger.info(f"GET /users/{user_id}/profile - User: {current_user.get('sub')}, Role: {current_user.get('role')}")
    
    try:
        profile = await user_service.get_user_profile(user_id, current_user)
        logger.info(f"GET /users/{user_id}/profile - Success")
        return profile
        
    except NotFoundError as e:
        logger.warning(f"GET /users/{user_id}/profile - Not found: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        logger.warning(f"GET /users/{user_id}/profile - Permission denied: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"GET /users/{user_id}/profile - Internal error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
