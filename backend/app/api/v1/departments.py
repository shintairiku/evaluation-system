from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.department import Department, DepartmentDetail, DepartmentCreate, DepartmentUpdate
from ...schemas.common import BaseResponse
from ...services.department_service import DepartmentService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("/", response_model=List[Department])
async def get_departments(
    session: AsyncSession = Depends(get_db_session),
    _: AuthContext = Depends(get_auth_context)  # Ensure user is authenticated
):
    """
    Get all departments for dropdown/selection purposes.
    
    Returns simple department list accessible to all authenticated users.
    For advanced department management with user details, use the specific department endpoint.
    """
    try:
        service = DepartmentService(session)
        result = await service.get_departments_for_dropdown()
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching departments: {str(e)}"
        )


@router.get("/{department_id}", response_model=DepartmentDetail)
async def get_department(
    department_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get detailed department information by ID.
    
    Access rules:
    - **Admin/Manager/Viewer**: Can access any department
    - **Supervisor/Employee**: Can only access their own department
    
    Returns enriched department data including:
    - Basic department information
    - User count and manager details
    - List of users in the department
    """
    try:
        service = DepartmentService(session)
        result = await service.get_department_by_id(department_id, context)
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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/", response_model=Department, status_code=status.HTTP_201_CREATED)
async def create_department(
    department_create: DepartmentCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Create a new department (admin only).
    
    Validates:
    - Department name uniqueness
    - Name length (2-100 characters)
    - User has DEPARTMENT_MANAGE permission
    """
    try:
        service = DepartmentService(session)
        result = await service.create_department(department_create, context)
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


@router.put("/{department_id}", response_model=Department)
async def update_department(
    department_id: UUID,
    department_update: DepartmentUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Update an existing department.
    
    Access rules:
    - **Supervisor and above**: Can update departments
    
    Validates:
    - Department exists
    - Name uniqueness (if changing name)
    - User has appropriate permissions
    """
    try:
        service = DepartmentService(session)
        result = await service.update_department(department_id, department_update, context)
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


@router.delete("/{department_id}", response_model=BaseResponse)
async def delete_department(
    department_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Delete a department (admin only).
    
    Business rules:
    - Cannot delete departments with active users
    - Only admin users can delete departments
    - Validates referential integrity before deletion
    
    Returns success message upon successful deletion.
    """
    try:
        service = DepartmentService(session)
        result = await service.delete_department(department_id, context)
        
        # Service returns a dict with message, convert to BaseResponse
        if isinstance(result, dict) and "message" in result:
            return BaseResponse(message=result["message"])
        else:
            return BaseResponse(message="Department deleted successfully")
        
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