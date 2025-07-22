from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.stage_competency import (
    Stage, StageDetail, StageCreate, StageUpdate, StageWithUserCount
)
from ...services.stage_service import StageService
from ...security.dependencies import require_admin, get_auth_context
from ...security.context import AuthContext
from ...core.exceptions import NotFoundError, ConflictError, BadRequestError

router = APIRouter(prefix="/stages", tags=["stages"])


@router.get("/", response_model=List[Stage])
async def get_stages(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all stages accessible to the current user."""
    try:
        # Access rules: admin, manager, supervisor, viewer, employee - all can view stages
        allowed_roles = ["admin", "manager", "supervisor", "viewer", "employee"]
        
        stage_service = StageService(session)
        stages = await stage_service.get_all_stages(context)
        return stages
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve stages: {str(e)}"
        )


@router.get("/admin", response_model=List[StageWithUserCount])
async def get_stages_with_user_count(
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all stages with user count for administrative views (admin only)."""
    try:
        stage_service = StageService(session)
        stages = await stage_service.get_stages_with_user_count(context)
        return stages
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve stages with user count: {str(e)}"
        )


@router.post("/", response_model=StageDetail)
async def create_stage(
    stage_create: StageCreate,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new stage (admin only)."""
    try:
        stage_service = StageService(session)
        result = await stage_service.create_stage(context, stage_create)
        return result
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stage: {str(e)}"
        )


@router.get("/{stage_id}", response_model=StageDetail)
async def get_stage(
    stage_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get stage details by ID."""
    try:
        # Access rules: admin, manager, supervisor, viewer, employee - all can view stages
        allowed_roles = ["admin", "manager", "supervisor", "viewer", "employee"]
        
        stage_service = StageService(session)
        stage = await stage_service.get_stage(context, stage_id)
        return stage
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve stage: {str(e)}"
        )

@router.put("/{stage_id}", response_model=StageDetail)
async def update_stage(
    stage_id: UUID,
    stage_update: StageUpdate,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Update stage information (admin only)."""
    try:
        stage_service = StageService(session)
        result = await stage_service.update_stage(context, stage_id, stage_update)
        return result
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stage: {str(e)}"
        )


@router.delete("/{stage_id}")
async def delete_stage(
    stage_id: UUID,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a stage (admin only)."""
    try:
        stage_service = StageService(session)
        result = await stage_service.delete_stage(context, stage_id)
        return result
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete stage: {str(e)}"
        )