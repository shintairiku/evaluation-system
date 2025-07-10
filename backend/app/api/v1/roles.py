"""
Role API endpoints for CRUD operations.

Implements Role management functionality as specified in Task #73.
Uses AuthContext for security and RoleRepository for data access.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.role import Role, RoleDetail, RoleCreate, RoleUpdate, RoleHierarchy
from ...schemas.common import BaseResponse, PaginatedResponse, PaginationParams
from ...services.role_service import RoleService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, ConflictError, ValidationError, PermissionDeniedError, BadRequestError

router = APIRouter(prefix="/admin/roles", tags=["roles"])


@router.get("/", response_model=PaginatedResponse[Role])
async def get_roles(
    context: AuthContext = Depends(get_auth_context),
    search: Optional[str] = Query(None, description="Search term for role name, code, or description"),
    parent_id: Optional[int] = Query(None, description="Filter by parent role ID"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db_session)
):
    """Get roles with optional filtering and pagination (admin only)."""
    try:
        pagination = PaginationParams(page=page, limit=limit)
        service = RoleService(session)
        
        result = await service.get_roles(
            current_user_context=context,
            search_term=search or "",
            parent_id=parent_id,
            pagination=pagination
        )
        
        return result
        
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


@router.get("/hierarchy", response_model=List[RoleHierarchy])
async def get_role_hierarchy(
    context: AuthContext = Depends(get_auth_context),
    parent_id: Optional[int] = Query(None, description="Starting parent ID for hierarchy (None for root)"),
    session: AsyncSession = Depends(get_db_session)
):
    """Get role hierarchy (admin only)."""
    try:
        service = RoleService(session)
        hierarchy = await service.get_role_hierarchy(
            current_user_context=context,
            parent_id=parent_id
        )
        return hierarchy
        
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


@router.post("/", response_model=RoleDetail, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_create: RoleCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new role (admin only)."""
    try:
        service = RoleService(session)
        new_role = await service.create_role(
            role_data=role_create,
            current_user_context=context
        )
        return new_role
        
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except BadRequestError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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


@router.get("/{role_id}", response_model=RoleDetail)
async def get_role(
    role_id: int,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get role details by ID with metadata (admin only)."""
    try:
        service = RoleService(session)
        role = await service.get_role_by_id(
            role_id=role_id,
            current_user_context=context
        )
        return role
        
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


@router.put("/{role_id}", response_model=RoleDetail)
async def update_role(
    role_id: int,
    role_update: RoleUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Update role information (admin only)."""
    try:
        service = RoleService(session)
        updated_role = await service.update_role(
            role_id=role_id,
            role_data=role_update,
            current_user_context=context
        )
        return updated_role
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except BadRequestError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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


@router.delete("/{role_id}", response_model=BaseResponse)
async def delete_role(
    role_id: int,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a role (admin only)."""
    try:
        service = RoleService(session)
        success = await service.delete_role(
            role_id=role_id,
            current_user_context=context
        )
        
        if success:
            return BaseResponse(
                message=f"Role with ID {role_id} deleted successfully",
                success=True
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete role"
            )
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except BadRequestError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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


@router.get("/all", response_model=List[Role])
async def get_all_roles_flat(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all roles in a flat list for dropdowns/selection (admin/user manager only)."""
    try:
        service = RoleService(session)
        roles = await service.get_all_roles_flat(
            current_user_context=context
        )
        return roles
        
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
