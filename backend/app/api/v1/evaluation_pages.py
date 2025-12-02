from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.goal_page import GoalListPageResponse
from ...security import AuthContext, get_auth_context
from ...services.goal_service import GoalService


router = APIRouter(prefix="/evaluation", tags=["evaluation-pages"])


@router.get("/goal-list-page", response_model=GoalListPageResponse)
async def get_goal_list_page(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period"),
    status: Optional[List[str]] = Query(None, alias="status", description="Filter by goal statuses"),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by user (must be accessible)"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
) -> GoalListPageResponse:
    """Page-level read endpoint that returns everything the goal list UI needs in one call."""
    service = GoalService(session)
    return await service.get_goal_list_page(
        current_user_context=context,
        period_id=period_id,
        status=status,
        user_id=user_id,
        page=page,
        limit=limit,
    )

