from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context
from ...security.context import AuthContext
from ...security.permissions import Permission
from ...schemas.goal import GoalList
from ...schemas.common import PaginationParams
from ...services.goal_service import GoalService
from ...core.exceptions import PermissionDeniedError

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/goals", response_model=GoalList)
async def get_admin_goals(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period ID"),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by specific user ID"),
    department_id: Optional[UUID] = Query(None, alias="departmentId", description="Filter by department ID"),
    goal_category: Optional[str] = Query(None, alias="goalCategory", description="Filter by goal category"),
    status: Optional[List[str]] = Query(None, description="Filter by status (draft, submitted, approved, rejected)"),
    include_reviews: bool = Query(
        True,
        alias="includeReviews",
        description="Include supervisor reviews (default: true for performance)"
    ),
    include_rejection_history: bool = Query(
        False,
        alias="includeRejectionHistory",
        description="Include full rejection history chain"
    ),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all goals for admin visualization (admin-only endpoint).

    This endpoint shows ALL users' goals in the organization, unlike /goals
    which defaults to showing only the admin's own goals (secure by default).

    Permissions: Requires GOAL_READ_ALL (admin role)
    Performance: Uses includeReviews=true by default (batch optimization)
    """
    try:
        # Permission check
        if not context.has_permission(Permission.GOAL_READ_ALL):
            raise PermissionDeniedError("Admin role required to access system-wide goals")

        # Validate parameter combination
        if include_rejection_history and not include_reviews:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="includeRejectionHistory requires includeReviews=true"
            )

        service = GoalService(session)

        result = await service.get_all_goals_for_admin(
            org_id=context.organization_id,
            period_id=period_id,
            user_id=user_id,
            department_id=department_id,
            goal_category=goal_category,
            status=status,
            pagination=pagination,
            include_reviews=include_reviews,
            include_rejection_history=include_rejection_history
        )

        return result

    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching admin goals: {str(e)}"
        )


# Admin endpoints will be added here as needed
# Most endpoints address roll-based access control at backend service level, including admin-only operations.