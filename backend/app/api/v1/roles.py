from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.user import RoleDetail, RoleCreate, RoleUpdate, RoleReorderRequest
from ...schemas.common import BaseResponse
from ...services.role_service import RoleService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/roles", tags=["roles"])


@router.post("/", response_model=RoleDetail, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_create: RoleCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new role (admin only)."""
    try:
        service = RoleService(session)
        result = await service.create_role(role_create, context)
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


@router.get("/", response_model=List[RoleDetail])
async def get_roles(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all roles.
    
    - **Admin**: Can see all roles with full details
    - **Others**: Can see basic role information for user selection
    """
    try:
        service = RoleService(session)
        result = await service.get_all(context)
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


@router.post("/reorder", response_model=BaseResponse)
async def reorder_roles(
    reorder_request: RoleReorderRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Reorder roles based on complete frontend drag-and-drop state (admin only).
    
    **Simple approach:**
    1. Frontend gets all roles via GET /roles
    2. User drags and drops to reorder in the UI
    3. Frontend sends back ALL roles with their new hierarchy_order values
    4. Backend updates all roles in one atomic operation
    
    This handles any number of role position changes simultaneously and
    is much simpler than complex single-role movement logic.
    
    **Request body:**
    ```json
    {
        "roles": [
            {"id": "uuid1", "hierarchy_order": 1},
            {"id": "uuid2", "hierarchy_order": 2},
            {"id": "uuid3", "hierarchy_order": 3}
        ]
    }
    ```
    """
    try:
        service = RoleService(session)
        await service.reorder_roles(reorder_request.roles, context)
        return BaseResponse(
            success=True,
            message="Roles reordered successfully"
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


@router.get("/{role_id}", response_model=RoleDetail)
async def get_role(
    role_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get role details by ID with permissions."""
    try:
        service = RoleService(session)
        result = await service.get_by_id(role_id, context)
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


@router.put("/{role_id}", response_model=RoleDetail)
async def update_role(
    role_id: UUID,
    role_update: RoleUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Update role information (admin only)."""
    try:
        service = RoleService(session)
        result = await service.update_role(role_id, role_update, context)
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


@router.delete("/{role_id}", response_model=BaseResponse)
async def delete_role(
    role_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a role (admin only)."""
    try:
        service = RoleService(session)
        success = await service.delete_role(role_id, context)
        
        if success:
            return BaseResponse(message="Role deleted successfully")
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