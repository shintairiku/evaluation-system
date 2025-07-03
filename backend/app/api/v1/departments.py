from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict, Any, List, Optional
from uuid import UUID

from ...dependencies.auth import get_current_user
from ...schemas.user import Department, DepartmentDetail, DepartmentCreate, DepartmentUpdate
from ...schemas.department import DepartmentCreate as DepartmentCreateSchema, DepartmentUpdate as DepartmentUpdateSchema
from ...services.department_service import DepartmentService
from ...core.exceptions import NotFoundError, ConflictError, PermissionDeniedError, ValidationError

router = APIRouter(prefix="/departments", tags=["departments"])

@router.get("/", response_model=List[Department])
async def get_departments(
    search: Optional[str] = Query(None, description="Search departments by name or description"),
    manager_id: Optional[UUID] = Query(None, description="Filter by manager ID"),
    min_users: Optional[int] = Query(None, description="Minimum number of users in department"),
    max_users: Optional[int] = Query(None, description="Maximum number of users in department"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    sort_by: Optional[str] = Query("name", description="Sort by: name, created_at, user_count"),
    sort_order: Optional[str] = Query("asc", description="Sort order: asc, desc"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get departments accessible to the current user with filtering and pagination."""
    try:
        department_service = DepartmentService()
        
        # Prepare filters
        filters = {}
        if search:
            filters["search"] = search
        if manager_id:
            filters["manager_id"] = manager_id
        if min_users is not None:
            filters["min_users"] = min_users
        if max_users is not None:
            filters["max_users"] = max_users
            
        # Get departments with role-based filtering
        departments = await department_service.get_departments(
            user=current_user,
            filters=filters,
            page=page,
            size=size,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return departments
        
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/", response_model=Department)
async def create_department(
    department_data: DepartmentCreateSchema,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new department (admin only)."""
    try:
        department_service = DepartmentService()
        
        department = await department_service.create_department(
            department_data=department_data,
            user=current_user
        )
        
        return department
        
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{department_id}", response_model=DepartmentDetail)
async def get_department(
    department_id: UUID,
    include_users: bool = Query(False, description="Include paginated list of users"),
    users_page: int = Query(1, ge=1, description="Page number for users list"),
    users_size: int = Query(10, ge=1, le=50, description="Number of users per page"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get department details by ID with optional user list."""
    try:
        department_service = DepartmentService()
        
        department_detail = await department_service.get_department_by_id(
            department_id=department_id,
            user=current_user,
            include_users=include_users,
            users_page=users_page,
            users_size=users_size
        )
        
        return department_detail
        
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
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.put("/{department_id}", response_model=Department)
async def update_department(
    department_id: UUID,
    department_data: DepartmentUpdateSchema,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update department information."""
    try:
        department_service = DepartmentService()
        
        department = await department_service.update_department(
            department_id=department_id,
            department_data=department_data,
            user=current_user
        )
        
        return department
        
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.delete("/{department_id}")
async def delete_department(
    department_id: UUID,
    transfer_to_department_id: Optional[UUID] = Query(None, description="Department ID to transfer users to"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a department (admin only) with optional user transfer."""
    try:
        department_service = DepartmentService()
        
        result = await department_service.delete_department(
            department_id=department_id,
            user=current_user,
            transfer_to_department_id=transfer_to_department_id
        )
        
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Additional endpoints for department management
@router.get("/{department_id}/statistics")
async def get_department_statistics(
    department_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get department statistics (admin and managers only)."""
    try:
        department_service = DepartmentService()
        
        stats = await department_service.get_department_statistics(
            department_id=department_id,
            user=current_user
        )
        
        return stats
        
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


@router.post("/{department_id}/users/{user_id}")
async def assign_user_to_department(
    department_id: UUID,
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Assign a user to a department (admin and managers only)."""
    try:
        department_service = DepartmentService()
        
        result = await department_service.assign_user_to_department(
            department_id=department_id,
            user_id=user_id,
            user=current_user
        )
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/{department_id}/users/{user_id}")
async def remove_user_from_department(
    department_id: UUID,
    user_id: UUID,
    transfer_to_department_id: Optional[UUID] = Query(None, description="Department to transfer user to"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Remove a user from a department (admin and managers only)."""
    try:
        department_service = DepartmentService()
        
        result = await department_service.remove_user_from_department(
            department_id=department_id,
            user_id=user_id,
            user=current_user,
            transfer_to_department_id=transfer_to_department_id
        )
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/{department_id}/manager/{user_id}")
async def assign_department_manager(
    department_id: UUID,
    user_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Assign a manager to a department (admin only)."""
    try:
        department_service = DepartmentService()
        
        result = await department_service.assign_department_manager(
            department_id=department_id,
            manager_id=user_id,
            user=current_user
        )
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )