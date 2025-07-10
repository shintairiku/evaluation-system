"""
Role API endpoints for CRUD operations.

Implements Role management API endpoints as specified in Task #75.
Delegates all business logic to RoleService and handles HTTP requests/responses.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.role import Role, RoleDetail, RoleCreate, RoleUpdate
from ...schemas.common import BaseResponse
from ...services.role_service import RoleService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, ConflictError, ValidationError, PermissionDeniedError, BadRequestError

router = APIRouter(prefix="/roles", tags=["roles"])


@router.post("/", response_model=RoleDetail, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_create: RoleCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new role."""
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


@router.get("/", response_model=List[Role])
async def get_roles(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """List all roles."""
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


@router.get("/{role_id}", response_model=RoleDetail)
async def get_role(
    role_id: int,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Retrieve a specific role."""
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
    """Update an existing role."""
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
    """Delete a role."""
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