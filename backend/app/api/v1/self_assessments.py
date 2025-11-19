from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context, require_supervisor_or_above
from ...security.context import AuthContext
from ...schemas.self_assessment import SelfAssessment, SelfAssessmentDetail, SelfAssessmentList, SelfAssessmentCreate, SelfAssessmentUpdate
from ...schemas.self_assessment_review import SelfAssessmentReviewList
from ...schemas.common import PaginationParams, BaseResponse
from ...services.self_assessment_service import SelfAssessmentService
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/self-assessments", tags=["self-assessments"])


@router.get("/", response_model=SelfAssessmentList)
async def get_self_assessments(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by user ID (supervisor/admin only)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, submitted)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get self-assessments for the current user or filtered assessments for supervisors/admins."""
    try:
        service = SelfAssessmentService(session)
        
        result = await service.get_assessments(
            current_user_context=context,
            user_id=user_id,
            period_id=period_id,
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
            detail=f"Error fetching self-assessments: {str(e)}"
        )


@router.post("/", response_model=SelfAssessment)
async def create_self_assessment(
    assessment_create: SelfAssessmentCreate,
    goal_id: UUID = Query(..., alias="goalId", description="Goal ID for the self-assessment"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a self-assessment for a goal."""
    try:
        service = SelfAssessmentService(session)
        
        result = await service.create_assessment(goal_id, assessment_create, context)
        
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
            detail=f"Error creating self-assessment: {str(e)}"
        )


@router.get("/period/{period_id}", response_model=SelfAssessmentList)
async def get_self_assessments_by_period(
    period_id: UUID,
    pagination: PaginationParams = Depends(),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by user ID (supervisor/admin only)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, submitted)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get self-assessments by evaluation period with optional filters."""
    try:
        service = SelfAssessmentService(session)
        
        result = await service.get_assessments_by_period(
            period_id=period_id,
            current_user_context=context,
            user_id=user_id,
            status=status,
            pagination=pagination
        )
        
        return result
        
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching self-assessments by period: {str(e)}")


@router.get("/goal/{goal_id}", response_model=Optional[SelfAssessment])
async def get_self_assessment_for_goal(
    goal_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get self-assessment for a specific goal."""
    try:
        service = SelfAssessmentService(session)
        result = await service.get_assessment_for_goal(goal_id, context)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching self-assessment for goal: {str(e)}")


# NOTE: This route MUST come before /{assessment_id} to avoid route conflicts where "review" would be interpreted as an assessment_id
@router.get("/review", response_model=SelfAssessmentReviewList)
async def list_pending_self_assessment_reviews(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId"),
    subordinate_id: Optional[UUID] = Query(None, alias="subordinateId"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session),
):
    """List pending self-assessment reviews for supervisors."""
    try:
        from ...services.supervisor_feedback_service import SupervisorFeedbackService
        service = SupervisorFeedbackService(session)
        return await service.get_pending_self_assessment_reviews(
            current_user_context=context,
            period_id=period_id,
            subordinate_id=subordinate_id,
            pagination=pagination,
        )
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{assessment_id}", response_model=SelfAssessmentDetail)
async def get_self_assessment(
    assessment_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get detailed self-assessment information by ID."""
    try:
        service = SelfAssessmentService(session)
        result = await service.get_assessment_by_id(assessment_id, context)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching self-assessment: {str(e)}")


@router.put("/{assessment_id}", response_model=SelfAssessment)
async def update_self_assessment(
    assessment_id: UUID,
    assessment_update: SelfAssessmentUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a self-assessment."""
    try:
        service = SelfAssessmentService(session)
        result = await service.update_assessment(assessment_id, assessment_update, context)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating self-assessment: {str(e)}")


@router.post("/{assessment_id}/submit", response_model=SelfAssessment)
async def submit_self_assessment(
    assessment_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit a self-assessment (assessment owner only)."""
    try:
        service = SelfAssessmentService(session)
        
        # Submit assessment using dedicated method
        result = await service.submit_assessment(assessment_id, context)
        
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting self-assessment: {str(e)}")


@router.delete("/{assessment_id}", response_model=BaseResponse)
async def delete_self_assessment(
    assessment_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a self-assessment."""
    try:
        service = SelfAssessmentService(session)
        success = await service.delete_assessment(assessment_id, context)
        if success:
            return BaseResponse(message="Self-assessment deleted successfully")
        else:
            raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete self-assessment")
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting self-assessment: {str(e)}")