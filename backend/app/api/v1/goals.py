from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context, require_supervisor_or_above
from ...security.context import AuthContext
from ...schemas.goal import Goal, GoalDetail, GoalList, GoalCreate, GoalUpdate
from ...schemas.common import PaginationParams, BaseResponse
from ...services.goal_service import GoalService
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError, ValidationError, BadRequestError

router = APIRouter(prefix="/goals", tags=["goals"])

@router.get("/", response_model=GoalList)
async def get_goals(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by user ID (supervisor/admin only)"),
    goal_category: Optional[str] = Query(None, alias="goalCategory", description="Filter by goal category (業績目標, コンピテンシー, コアバリュー)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, pending_approval, approved, rejected)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get goals for the current user or filtered goals for supervisors/admins."""
    try:
        service = GoalService(session)
        
        result = await service.get_goals(
            current_user_context=context,
            user_id=user_id,
            period_id=period_id,
            goal_category=goal_category,
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
            detail=f"Error fetching goals: {str(e)}"
        )

@router.post("/", response_model=Goal)
async def create_goal(
    goal_create: GoalCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Create a new goal."""
    try:
        service = GoalService(session)
        
        result = await service.create_goal(goal_create, context)
        
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
            detail=f"Error creating goal: {str(e)}"
        )

@router.get("/period/{period_id}", response_model=GoalList)
async def get_goals_by_period(
    period_id: UUID,
    pagination: PaginationParams = Depends(),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by user ID (supervisor/admin only)"),
    goal_category: Optional[str] = Query(None, alias="goalCategory", description="Filter by goal category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get goals by evaluation period with optional filters."""
    try:
        service = GoalService(session)
        
        result = await service.get_goals(
            current_user_context=context,
            user_id=user_id,
            period_id=period_id,
            goal_category=goal_category,
            status=status,
            pagination=pagination
        )
        
        return result
        
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching goals by period: {str(e)}")

@router.get("/{goal_id}", response_model=GoalDetail)
async def get_goal(
    goal_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Get detailed goal information by ID."""
    try:
        service = GoalService(session)
        result = await service.get_goal_by_id(goal_id, context)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching goal: {str(e)}")

@router.put("/{goal_id}", response_model=Goal)
async def update_goal(
    goal_id: UUID,
    goal_update: GoalUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Update a goal."""
    try:
        service = GoalService(session)
        result = await service.update_goal(goal_id, goal_update, context)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error updating goal: {str(e)}")

@router.delete("/{goal_id}", response_model=BaseResponse)
async def delete_goal(
    goal_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Delete a goal."""
    try:
        service = GoalService(session)
        success = await service.delete_goal(goal_id, context)
        if success:
            return BaseResponse(message="Goal deleted successfully")
        else:
            raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete goal")
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except BadRequestError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting goal: {str(e)}")

@router.post("/{goal_id}/submit", response_model=Goal)
async def submit_goal(
    goal_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """Submit a goal for approval (goal owner only)."""
    try:
        service = GoalService(session)
        
        # Update goal status to pending_approval
        from ...schemas.goal import GoalUpdate, GoalStatus
        goal_update = GoalUpdate(status=GoalStatus.PENDING_APPROVAL)
        result = await service.update_goal(goal_id, goal_update, context)
        
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error submitting goal: {str(e)}")

# Optional api endpoints
@router.post("/{goal_id}/approve", response_model=Goal)
async def approve_goal(
    goal_id: UUID,
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Approve a goal (supervisor/admin only)."""
    try:
        service = GoalService(session)
        result = await service.approve_goal(goal_id, context)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error approving goal: {str(e)}")

@router.post("/{goal_id}/reject", response_model=Goal)
async def reject_goal(
    goal_id: UUID,
    rejection_reason: str = Query(..., alias="reason", description="Reason for rejection"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Reject a goal (supervisor/admin only)."""
    try:
        service = GoalService(session)
        result = await service.reject_goal(goal_id, rejection_reason, context)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error rejecting goal: {str(e)}")


@router.get("/supervisor/pending", response_model=GoalList)
async def get_pending_approvals(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Get goals pending approval (supervisor/admin only)."""
    try:
        service = GoalService(session)
        result = await service.get_pending_approvals(context, period_id, pagination)
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching pending approvals: {str(e)}")

@router.get("/pending-approval", response_model=GoalList)
async def get_pending_approval_alias(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session)
):
    """Get goals pending approval (supervisor/admin only) - Alias endpoint."""
    return await get_pending_approvals(pagination, period_id, context, session)

