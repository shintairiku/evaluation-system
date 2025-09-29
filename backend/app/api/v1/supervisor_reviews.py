from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID

from ...security.dependencies import get_auth_context, require_supervisor_or_above
from ...security.context import AuthContext
from ...schemas.supervisor_review import SupervisorReview, SupervisorReviewDetail, SupervisorReviewList, SupervisorReviewCreate, SupervisorReviewUpdate
from ...schemas.common import PaginationParams, BaseResponse
from ...database.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from ...services.supervisor_review_service import SupervisorReviewService
from ...core.exceptions import NotFoundError, PermissionDeniedError, ValidationError, BadRequestError, ConflictError

router = APIRouter(prefix="/supervisor-reviews", tags=["supervisor-reviews"])

@router.get("/goal/{goal_id}", response_model=SupervisorReviewList)
async def get_reviews_for_goal(
    goal_id: UUID,
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    status: Optional[str] = Query(None, description="Filter by status (draft, submitted)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get supervisor reviews for a specific goal (owner, supervisor, or admin)."""
    try:
        service = SupervisorReviewService(session)
        result = await service.get_reviews(
            current_user_context=context,
            period_id=period_id,
            goal_id=goal_id,
            status=status,
            pagination=pagination,
        )
        return SupervisorReviewList(items=result.items, total=result.total, page=result.page, limit=result.limit, pages=result.pages)
    except (PermissionDeniedError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching goal reviews: {str(e)}")

@router.get("/", response_model=SupervisorReviewList)
async def get_supervisor_reviews(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    goal_id: Optional[UUID] = Query(None, alias="goalId", description="Filter by goal ID"),
    status: Optional[str] = Query(None, description="Filter by status (draft, submitted)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get supervisor reviews."""
    try:
        service = SupervisorReviewService(session)
        result = await service.get_reviews(
            current_user_context=context,
            period_id=period_id,
            goal_id=goal_id,
            status=status,
            pagination=pagination,
        )
        # Adapt to SupervisorReviewList schema signature
        return SupervisorReviewList(items=result.items, total=result.total, page=result.page, limit=result.limit, pages=result.pages)
    except (PermissionDeniedError, ValidationError, BadRequestError, ConflictError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching supervisor reviews: {str(e)}")

@router.post("/", response_model=SupervisorReview)
async def create_supervisor_review(
    review_create: SupervisorReviewCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a supervisor review for a goal."""
    try:
        service = SupervisorReviewService(session)
        created = await service.create_review(review_create, context)
        return created
    except (PermissionDeniedError, ValidationError, BadRequestError, ConflictError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error creating supervisor review: {str(e)}")

# Optional api endpoints (must come before /{review_id} to avoid routing conflicts)
@router.get("/pending", response_model=SupervisorReviewList)
async def get_pending_reviews(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Get pending supervisor reviews that need attention (supervisor only)."""
    try:
        service = SupervisorReviewService(session)
        result = await service.get_pending_reviews(
            current_user_context=context, period_id=period_id, pagination=pagination
        )
        return SupervisorReviewList(items=result.items, total=result.total, page=result.page, limit=result.limit, pages=result.pages)
    except (PermissionDeniedError, BadRequestError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching pending supervisor reviews: {str(e)}")

@router.get("/{review_id}", response_model=SupervisorReviewDetail)
async def get_supervisor_review(
    review_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get detailed supervisor review by ID with goal context."""
    try:
        service = SupervisorReviewService(session)
        return await service.get_review(review_id, context)
    except (PermissionDeniedError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching supervisor review: {str(e)}")

@router.put("/{review_id}", response_model=SupervisorReview)
async def update_supervisor_review(
    review_id: UUID,
    review_update: SupervisorReviewUpdate,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a supervisor review."""
    try:
        service = SupervisorReviewService(session)
        updated = await service.update_review(review_id, review_update, context)
        return updated
    except (PermissionDeniedError, ValidationError, BadRequestError, ConflictError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating supervisor review: {str(e)}")

@router.post("/{review_id}/submit", response_model=SupervisorReview)
async def submit_supervisor_review(
    review_id: UUID,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit a supervisor review (set status=submitted and sync goal)."""
    try:
        service = SupervisorReviewService(session)
        updated = await service.submit_review(review_id, context)
        return updated
    except (PermissionDeniedError, ValidationError, BadRequestError, ConflictError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting supervisor review: {str(e)}")

@router.delete("/{review_id}", response_model=BaseResponse)
async def delete_supervisor_review(
    review_id: UUID,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a supervisor review."""
    try:
        service = SupervisorReviewService(session)
        success = await service.delete_review(review_id, context)
        if success:
            return BaseResponse(message="Supervisor review deleted successfully")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete supervisor review")
    except (PermissionDeniedError, BadRequestError, NotFoundError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting supervisor review: {str(e)}")

@router.post("/bulk-submit")
async def bulk_submit_reviews(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    goal_ids: Optional[List[UUID]] = Query(None, alias="goalIds", description="Specific goal IDs"),
    context: AuthContext = Depends(require_supervisor_or_above)
):
    """Submit multiple supervisor reviews at once."""
    
    # TODO: Implement bulk review submission service
    # - Submit all supervisor's draft reviews for the period
    # - Or submit only specified goal reviews
    # - Change status from 'draft' to 'submitted'
    # - Set reviewed_at timestamp
    # - Update goal statuses based on review actions
    return {"message": "Supervisor reviews submitted successfully"}

