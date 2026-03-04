from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context
from ...security.context import AuthContext
from ...schemas.peer_review import (
    PeerReviewAssignReviewersRequest,
    PeerReviewAssignmentResponse,
    PeerReviewAssignmentsByReviewee,
    PeerReviewEvaluationUpdate,
    PeerReviewEvaluationResponse,
    PeerReviewAveragedScores,
    CoreValueSummaryResponse,
)
from ...schemas.common import BaseResponse
from ...services.peer_review_service import PeerReviewService
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/peer-reviews", tags=["peer-reviews"])


# ========================================
# ADMIN - ASSIGNMENTS
# ========================================

@router.get("/assignments", response_model=List[PeerReviewAssignmentsByReviewee])
async def get_assignments(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get all peer review assignments for a period, grouped by reviewee (admin)."""
    try:
        service = PeerReviewService(session)
        return await service.get_assignments_for_period(context, period_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching assignments: {str(e)}")


@router.put("/assignments/{period_id}/reviewee/{reviewee_id}", response_model=List[PeerReviewAssignmentResponse])
async def assign_reviewers(
    period_id: UUID,
    reviewee_id: UUID,
    data: PeerReviewAssignReviewersRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Assign reviewers to a reviewee (admin). Requires exactly 2 reviewers."""
    try:
        service = PeerReviewService(session)
        return await service.assign_reviewers(context, period_id, reviewee_id, data)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error assigning reviewers: {str(e)}")


@router.delete("/assignments/{assignment_id}", response_model=BaseResponse)
async def remove_assignment(
    assignment_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Remove a peer review assignment (admin)."""
    try:
        service = PeerReviewService(session)
        await service.remove_assignment(context, assignment_id)
        return BaseResponse(success=True, message="Assignment removed")
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error removing assignment: {str(e)}")


# ========================================
# REVIEWER - EVALUATIONS
# ========================================

@router.get("/mine", response_model=List[PeerReviewEvaluationResponse])
async def get_my_reviews(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get my pending peer reviews (reviewer view)."""
    try:
        service = PeerReviewService(session)
        return await service.get_my_pending_reviews(context, period_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching reviews: {str(e)}")


@router.put("/evaluations/{eval_id}", response_model=PeerReviewEvaluationResponse)
async def save_evaluation(
    eval_id: UUID,
    data: PeerReviewEvaluationUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Auto-save peer review evaluation scores and comment."""
    try:
        service = PeerReviewService(session)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error saving evaluation: {str(e)}")


@router.post("/evaluations/{eval_id}/submit", response_model=PeerReviewEvaluationResponse)
async def submit_evaluation(
    eval_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit peer review evaluation (requires 9 scores + 1 comment). Definitive."""
    try:
        service = PeerReviewService(session)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting evaluation: {str(e)}")


# ========================================
# REVIEWEE - RESULTS
# ========================================

@router.get("/results/mine", response_model=PeerReviewAveragedScores)
async def get_my_results(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get my averaged peer review results (anonymized)."""
    try:
        service = PeerReviewService(session)
        return await service.get_averaged_peer_review(context, period_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching results: {str(e)}")


@router.get("/results/user", response_model=PeerReviewAveragedScores)
async def get_user_results(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    user_id: UUID = Query(..., alias="userId", description="User ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get averaged peer review results for a specific user (admin)."""
    try:
        service = PeerReviewService(session)
        return await service.get_averaged_peer_review(context, period_id, user_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching user results: {str(e)}")


# ========================================
# ADMIN - 総合評価 (CORE VALUE SUMMARY)
# ========================================

@router.get("/summary/user", response_model=CoreValueSummaryResponse)
async def get_core_value_summary(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    user_id: UUID = Query(..., alias="userId", description="User ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get core value summary (総合評価) combining 4 sources (admin only)."""
    try:
        service = PeerReviewService(session)
        return await service.get_core_value_summary(context, period_id, user_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching core value summary: {str(e)}")
