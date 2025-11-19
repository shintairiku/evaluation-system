from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from ...security.dependencies import require_supervisor_or_above
from ...security.context import AuthContext
from ...database.session import get_db_session
from ...services.supervisor_feedback_service import SupervisorFeedbackService
from ...schemas.self_assessment_review import SelfAssessmentReviewList
from ...schemas.common import PaginationParams
from ...core.exceptions import PermissionDeniedError, BadRequestError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/self-assessments/review", tags=["self-assessments"])


@router.get("/", response_model=SelfAssessmentReviewList)
async def list_pending_reviews(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId"),
    subordinate_id: Optional[UUID] = Query(None, alias="subordinateId"),
    context: AuthContext = Depends(require_supervisor_or_above),
    session: AsyncSession = Depends(get_db_session),
):
    try:
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
        logger.error(f"Error in list_pending_reviews: {e}", exc_info=True)
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
