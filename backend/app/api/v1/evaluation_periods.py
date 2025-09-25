from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Dict, Any, Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...security.dependencies import require_admin, get_auth_context
from ...security.context import AuthContext
from ...database.session import get_db_session
from ...services.evaluation_period_service import EvaluationPeriodService
from ...schemas.evaluation import (
    EvaluationPeriod, EvaluationPeriodDetail, EvaluationPeriodList, 
    EvaluationPeriodCreate, EvaluationPeriodUpdate, EvaluationPeriodStatus
)
from ...schemas.goal import GoalList
from ...schemas.self_assessment import SelfAssessment
from ...schemas.supervisor_feedback import SupervisorFeedback
from ...schemas.supervisor_review import SupervisorReview
from ...schemas.common import PaginationParams
from ...core.exceptions import NotFoundError, ConflictError, PermissionDeniedError, BadRequestError

router = APIRouter(prefix="/evaluation-periods", tags=["evaluation-periods"])


@router.get("/", response_model=EvaluationPeriodList)
async def get_evaluation_periods(
    status: Optional[str] = Query("active", description="Filter by status (active, draft, completed, cancelled, all). Defaults to 'active'"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get evaluation periods accessible to the current user.

    Defaults to showing active periods only, similar to GitHub's default "open" filter.
    Use status=all to see all periods, or specify other statuses as needed.

    Currently accessible to all authenticated users.
    TODO: Consider adding user-specific restrictions in the future (may limit non-admin access).
    """
    try:
        service = EvaluationPeriodService(session)
        
        # Parse status filter - default to active if not specified or if "active" is explicitly passed
        status_filter = None
        if status and status.lower() != "all":
            try:
                status_filter = EvaluationPeriodStatus(status)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {status}. Must be one of: draft, active, completed, cancelled, all"
                )
        
        # Create pagination params
        pagination = PaginationParams(page=page, limit=limit)
        
        # Get evaluation periods
        result = await service.get_evaluation_periods(
            current_user_context=context,
            status=status_filter,
            pagination=pagination
        )
        
        return result
        
    except (NotFoundError, ConflictError, PermissionDeniedError, BadRequestError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/", response_model=EvaluationPeriod)
async def create_evaluation_period(
    period_create: EvaluationPeriodCreate,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new evaluation period (admin only)."""
    try:
        service = EvaluationPeriodService(session)
        
        result = await service.create_evaluation_period(
            current_user_context=context,
            period_data=period_create
        )
        
        return result
        
    except (ConflictError, BadRequestError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{period_id}", response_model=EvaluationPeriodDetail)
async def get_evaluation_period(
    period_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get detailed evaluation period information by ID.
    
    Currently accessible to all authenticated users.
    TODO: Consider adding user-specific restrictions in the future (may limit non-admin access).
    """
    try:
        service = EvaluationPeriodService(session)
        
        result = await service.get_evaluation_period_detail(
            current_user_context=context,
            period_id=period_id
        )
        
        return result
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # Add more detailed error logging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_evaluation_period: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.put("/{period_id}", response_model=EvaluationPeriod)
async def update_evaluation_period(
    period_id: UUID,
    period_update: EvaluationPeriodUpdate,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Update an evaluation period (admin only)."""
    try:
        service = EvaluationPeriodService(session)
        
        result = await service.update_evaluation_period(
            current_user_context=context,
            period_id=period_id,
            period_data=period_update
        )
        
        return result
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (ConflictError, BadRequestError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.delete("/{period_id}")
async def delete_evaluation_period(
    period_id: UUID,
    context: AuthContext = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete an evaluation period (admin only)."""
    try:
        service = EvaluationPeriodService(session)
        
        deleted = await service.delete_evaluation_period(
            current_user_context=context,
            period_id=period_id
        )
        
        if deleted:
            return {"message": "Evaluation period deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Evaluation period not found")
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (ConflictError, BadRequestError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# @router.put("/{period_id}/status", response_model=EvaluationPeriod)
# async def update_evaluation_period_status(
#     period_id: UUID,
#     new_status: EvaluationPeriodStatus,
#     context: AuthContext = Depends(require_admin),
#     session: AsyncSession = Depends(get_db_session)
# ):
#     """Update the status of an evaluation period (admin only)."""
#     try:
#         service = EvaluationPeriodService(session)
#         
#         result = await service.update_evaluation_period_status(
#             current_user_context=context,
#             period_id=period_id,
#             status=new_status
#         )
#         
#         return result
#         
#     except NotFoundError as e:
#         raise HTTPException(status_code=404, detail=str(e))
#     except (ConflictError, BadRequestError) as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except PermissionDeniedError as e:
#         raise HTTPException(status_code=403, detail=str(e))
#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Internal server error"
#         )

# @router.get("/{period_id}/goals", response_model=GoalList)
# async def get_period_goals(
#     period_id: UUID,
#     context: AuthContext = Depends(get_auth_context)
# ):
#     """Get all goals for the current user in a specific evaluation period."""
#     # TODO: Implement goal service to fetch user goals for the period
#     # - Filter by current_user ID and period_id
#     return GoalList(goals=[], total=0)

# @router.get("/{period_id}/assessments", response_model=List[SelfAssessment])
# async def get_period_assessments(
#     period_id: UUID,
#     context: AuthContext = Depends(get_auth_context)
# ):
#     """Get all self-assessments for the current user in a specific evaluation period."""
#     # TODO: Implement self-assessment service
#     # - Get all user's self-assessments for goals in this period
#     return []

# @router.get("/{period_id}/feedback", response_model=List[SupervisorFeedback])
# async def get_period_feedback(
#     period_id: UUID,
#     context: AuthContext = Depends(get_auth_context)
# ):
#     """Get all supervisor feedback for the current user in a specific evaluation period."""
#     # TODO: Implement supervisor feedback service
#     # - Get all feedback on user's assessments for this period
#     return []

@router.get("/supervisor/reviews", response_model=List[SupervisorReview])
async def get_supervisor_reviews(
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    context: AuthContext = Depends(get_auth_context)
):
    """Get supervisor reviews that need attention (supervisor/admin only)."""
    
    # TODO: Implement supervisor review service
    # - Get all reviews by current supervisor
    # - Filter by period_id if specified
    # - Return pending and completed reviews
    return []

@router.get("/supervisor/feedback", response_model=List[SupervisorFeedback])
async def get_supervisor_feedback_list(
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    context: AuthContext = Depends(get_auth_context)
):
    """Get supervisor feedback that needs attention (supervisor/admin only)."""
    
    # TODO: Implement supervisor feedback service
    # - Get all feedback by current supervisor
    # - Filter by period_id if specified
    # - Return pending and completed feedback
    return []