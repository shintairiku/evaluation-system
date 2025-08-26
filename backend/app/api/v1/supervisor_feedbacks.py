from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context, require_supervisor_or_above
from ...security.context import AuthContext
from ...schemas.supervisor_feedback import SupervisorFeedback, SupervisorFeedbackDetail, SupervisorFeedbackList, SupervisorFeedbackCreate, SupervisorFeedbackUpdate
from ...schemas.common import PaginationParams, BaseResponse
from ...services.supervisor_feedback_service import SupervisorFeedbackService
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/supervisor-feedbacks", tags=["supervisor-feedbacks"])


@router.get("/", response_model=SupervisorFeedbackList)
async def get_supervisor_feedbacks(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    supervisor_id: Optional[UUID] = Query(None, alias="supervisorId", description="Filter by supervisor ID (feedback creator)"),
    subordinate_id: Optional[UUID] = Query(None, alias="subordinateId", description="Filter by subordinate ID (feedback recipient)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, submitted)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get supervisor feedbacks based on current user's permissions and filters.
    
    Supports filtering by:
    - supervisorId: Get feedbacks created by a specific supervisor
    - subordinateId: Get feedbacks received by a specific subordinate/employee
    - userId: Legacy parameter (deprecated, use subordinateId instead)
    - periodId: Filter by evaluation period
    - status: Filter by feedback status (draft/submitted)
    
    Role-based default behavior when no supervisorId/subordinateId specified:
    - Admin: Shows all feedbacks
    - Manager/Supervisor: Shows feedbacks they created (supervisorId=self)
    - Employee/Part-time: Shows feedbacks they received (subordinateId=self)
    
    Role-based filtering restrictions:
    - Admin: Can filter by any supervisorId or subordinateId
    - Manager/Supervisor: Can only use their own supervisorId, subordinateId limited to their subordinates
    - Employee/Part-time: Cannot use supervisorId, can only use their own subordinateId
    """
    try:
        service = SupervisorFeedbackService(session)
        
        result = await service.get_feedbacks(
            current_user_context=context,
            period_id=period_id,
            supervisor_id=supervisor_id,
            subordinate_id=subordinate_id,
            status=status,
            pagination=pagination
        )
        
        return result
        
    except NotFoundError as e:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching supervisor feedbacks: {str(e)}"
        )


@router.post("/", response_model=SupervisorFeedback)
async def create_supervisor_feedback(
    feedback_create: SupervisorFeedbackCreate,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Create supervisor feedback on a self-assessment."""
    try:
        service = SupervisorFeedbackService(session)
        
        result = await service.create_feedback(feedback_create, context)
        
        return result
        
    except ValidationError as e:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except BadRequestError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating supervisor feedback: {str(e)}"
        )


@router.get("/assessment/{self_assessment_id}", response_model=Optional[SupervisorFeedback])
async def get_feedback_for_assessment(
    self_assessment_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get supervisor feedback for a specific self-assessment."""
    try:
        service = SupervisorFeedbackService(session)
        result = await service.get_feedback_for_assessment(self_assessment_id, context)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching feedback for assessment: {str(e)}")


@router.get("/pending", response_model=SupervisorFeedbackList)
async def get_pending_feedbacks(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Get pending supervisor feedbacks that need attention (supervisor only)."""
    try:
        service = SupervisorFeedbackService(session)
        result = await service.get_pending_feedbacks(
            current_user_context=context, 
            period_id=period_id, 
            pagination=pagination
        )
        return result
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching pending feedbacks: {str(e)}")


@router.get("/{feedback_id}", response_model=SupervisorFeedbackDetail)
async def get_supervisor_feedback(
    feedback_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get detailed supervisor feedback information by ID."""
    try:
        service = SupervisorFeedbackService(session)
        result = await service.get_feedback_by_id(feedback_id, context)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching supervisor feedback: {str(e)}")


@router.put("/{feedback_id}", response_model=SupervisorFeedback)
async def update_supervisor_feedback(
    feedback_id: UUID,
    feedback_update: SupervisorFeedbackUpdate,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Update supervisor feedback."""
    try:
        service = SupervisorFeedbackService(session)
        result = await service.update_feedback(feedback_id, feedback_update, context)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating supervisor feedback: {str(e)}")


@router.post("/{feedback_id}/submit", response_model=SupervisorFeedback)
async def submit_supervisor_feedback(
    feedback_id: UUID,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit supervisor feedback (feedback creator only)."""
    try:
        service = SupervisorFeedbackService(session)
        
        # Submit feedback using dedicated method
        result = await service.submit_feedback(feedback_id, context)
        
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting supervisor feedback: {str(e)}")


@router.post("/{feedback_id}/draft", response_model=SupervisorFeedback)
async def draft_supervisor_feedback(
    feedback_id: UUID,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Change supervisor feedback status to draft (feedback creator only)."""
    try:
        service = SupervisorFeedbackService(session)
        
        # Change feedback to draft using dedicated method
        result = await service.draft_feedback(feedback_id, context)
        
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error changing supervisor feedback to draft: {str(e)}")


@router.delete("/{feedback_id}", response_model=BaseResponse)
async def delete_supervisor_feedback(
    feedback_id: UUID,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete supervisor feedback."""
    try:
        service = SupervisorFeedbackService(session)
        success = await service.delete_feedback(feedback_id, context)
        if success:
            return BaseResponse(message="Supervisor feedback deleted successfully")
        else:
            raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete supervisor feedback")
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting supervisor feedback: {str(e)}")