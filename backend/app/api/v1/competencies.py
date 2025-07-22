from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.stage_competency import Competency, CompetencyCreate, CompetencyUpdate, CompetencyDetail
from ...schemas.common import PaginatedResponse, PaginationParams
from ...services.competency_service import CompetencyService
from ...security.dependencies import require_admin, get_auth_context
from ...security.context import AuthContext
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/competencies", tags=["competencies"])


@router.get("/", response_model=PaginatedResponse[Competency])
async def get_competencies(
    stage_id: Optional[UUID] = Query(None, alias="stageId", description="Filter by stage ID"),
    search: Optional[str] = Query(None, description="Search competencies by name or description"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get competencies list with optional filtering and pagination.
    
    Access Control:
    - All authenticated users can view competencies
    - Filter by stage_id if provided
    - Support search functionality
    """
    try:
        service = CompetencyService(session)
        
        # Prepare stage_ids filter
        stage_ids = [stage_id] if stage_id else None
        
        # Create pagination params
        pagination = PaginationParams(page=page, limit=limit)
        
        # Get competencies with filtering
        result = await service.get_competencies(
            current_user_context=context,
            search_term=search or "",
            stage_ids=stage_ids,
            pagination=pagination
        )
        
        return result
        
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching competencies: {str(e)}"
        )


@router.post("/", response_model=CompetencyDetail, status_code=status.HTTP_201_CREATED)
async def create_competency(
    competency_create: CompetencyCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Create a new competency.
    
    Access Control:
    - Admin only can create competencies
    """
    try:
        service = CompetencyService(session)
        result = await service.create_competency(competency_create, context)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating competency: {str(e)}"
        )


@router.get("/{competency_id}", response_model=CompetencyDetail)
async def get_competency(
    competency_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get competency details by ID.
    
    Access Control:
    - All authenticated users can view competency details
    """
    try:
        service = CompetencyService(session)
        result = await service.get_competency(competency_id, context)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching competency: {str(e)}"
        )


@router.put("/{competency_id}", response_model=CompetencyDetail)
async def update_competency(
    competency_id: UUID,
    competency_update: CompetencyUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Update a competency.
    
    Access Control:
    - Admin only can update competencies
    """
    try:
        service = CompetencyService(session)
        result = await service.update_competency(competency_id, competency_update, context)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating competency: {str(e)}"
        )


@router.delete("/{competency_id}")
async def delete_competency(
    competency_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Delete a competency.
    
    Access Control:
    - Admin only can delete competencies
    """
    try:
        service = CompetencyService(session)
        await service.delete_competency(competency_id, context)
        return {"message": "Competency deleted successfully"}
        
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting competency: {str(e)}"
        )