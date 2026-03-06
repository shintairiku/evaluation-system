from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context
from ...security.context import AuthContext
from ...schemas.core_value import (
    CoreValueDefinitionResponse,
    CoreValueEvaluationUpdate,
    CoreValueEvaluationResponse,
    CoreValueFeedbackUpdate,
    CoreValueFeedbackSubmit,
    CoreValueFeedbackReturn,
    CoreValueFeedbackResponse,
    CoreValueSubordinateDataResponse,
)
from ...schemas.common import BaseResponse
from ...services.core_value_service import CoreValueService
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/core-values", tags=["core-values"])


# ========================================
# DEFINITIONS
# ========================================

@router.get("/definitions", response_model=List[CoreValueDefinitionResponse])
async def get_definitions(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get core value definitions for the current organization."""
    try:
        service = CoreValueService(session)
        return await service.get_definitions(context)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching core value definitions: {str(e)}")


@router.post("/definitions/seed", response_model=BaseResponse)
async def seed_definitions(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Seed default core value definitions for the organization (admin)."""
    try:
        service = CoreValueService(session)
        inserted = await service.seed_definitions(context)
        return BaseResponse(success=True, message=f"Seeded {inserted} core value definitions")
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error seeding core value definitions: {str(e)}")


# ========================================
# EVALUATIONS (employee)
# ========================================

@router.get("/evaluations/mine", response_model=Optional[CoreValueEvaluationResponse])
async def get_my_evaluation(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get my core value evaluation for a period."""
    try:
        service = CoreValueService(session)
        return await service.get_my_evaluation(context, period_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching core value evaluation: {str(e)}")


@router.put("/evaluations/{eval_id}", response_model=CoreValueEvaluationResponse)
async def save_evaluation(
    eval_id: UUID,
    data: CoreValueEvaluationUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Save (auto-save) core value evaluation scores and comment."""
    try:
        service = CoreValueService(session)
        return await service.save_evaluation(context, eval_id, data)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error saving core value evaluation: {str(e)}")


@router.post("/evaluations/{eval_id}/submit", response_model=CoreValueEvaluationResponse)
async def submit_evaluation(
    eval_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit core value evaluation (requires all 9 scores)."""
    try:
        service = CoreValueService(session)
        return await service.submit_evaluation(context, eval_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting core value evaluation: {str(e)}")


@router.post("/evaluations/{eval_id}/reopen", response_model=CoreValueEvaluationResponse)
async def reopen_evaluation(
    eval_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Reopen a submitted evaluation (not if approved)."""
    try:
        service = CoreValueService(session)
        return await service.reopen_evaluation(context, eval_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error reopening core value evaluation: {str(e)}")


# ========================================
# SUBORDINATE DATA (supervisor)
# ========================================

@router.get("/subordinate", response_model=CoreValueSubordinateDataResponse)
async def get_subordinate_data(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    subordinate_id: UUID = Query(..., alias="subordinateId", description="Subordinate user ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get core value evaluation and feedback for a subordinate."""
    try:
        service = CoreValueService(session)
        return await service.get_subordinate_data(context, period_id, subordinate_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching subordinate core value data: {str(e)}")


# ========================================
# FEEDBACK
# ========================================

@router.get("/feedback/mine", response_model=Optional[CoreValueFeedbackResponse])
async def get_my_feedback(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get my core value feedback for a period (employee view)."""
    try:
        service = CoreValueService(session)
        return await service.get_my_feedback(context, period_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching core value feedback: {str(e)}")


@router.get("/feedback/pending-count")
async def get_pending_feedback_count(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Count pending core value feedbacks for the current supervisor."""
    try:
        service = CoreValueService(session)
        count = await service.count_pending_feedback(context, period_id)
        return {"count": count}
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error counting pending feedback: {str(e)}")


@router.put("/feedback/{feedback_id}", response_model=CoreValueFeedbackResponse)
async def save_feedback(
    feedback_id: UUID,
    data: CoreValueFeedbackUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Save (auto-save) core value feedback scores and comment."""
    try:
        service = CoreValueService(session)
        return await service.save_feedback(context, feedback_id, data)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error saving core value feedback: {str(e)}")


@router.post("/feedback/{feedback_id}/submit", response_model=CoreValueFeedbackResponse)
async def submit_feedback(
    feedback_id: UUID,
    data: CoreValueFeedbackSubmit,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit/approve core value feedback."""
    try:
        service = CoreValueService(session)
        return await service.submit_feedback(context, feedback_id, data)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting core value feedback: {str(e)}")


@router.post("/feedback/{feedback_id}/return", response_model=CoreValueFeedbackResponse)
async def return_feedback(
    feedback_id: UUID,
    data: CoreValueFeedbackReturn,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Return feedback for correction (差し戻し)."""
    try:
        service = CoreValueService(session)
        return await service.return_feedback(context, feedback_id, data)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error returning core value feedback: {str(e)}")
