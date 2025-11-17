from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context
from ...security.context import AuthContext
from ...schemas.self_assessment_summary import SelfAssessmentContext, SelfAssessmentSummary, SelfAssessmentDraftEntry
from ...services.self_assessment_service import SelfAssessmentService
from ...core.exceptions import BadRequestError, NotFoundError, PermissionDeniedError, ConflictError, ValidationError

router = APIRouter(prefix="/self-assessments", tags=["self-assessments"])


@router.get("/current", response_model=SelfAssessmentContext)
async def get_current_context(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    try:
        service = SelfAssessmentService(session)
        return await service.get_current_context(context)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/draft", response_model=dict)
async def save_draft(
    draft: list[SelfAssessmentDraftEntry],
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    try:
        service = SelfAssessmentService(session)
        saved_at = await service.save_draft(context, draft)
        return {"saved": True, "updatedAt": saved_at}
    except (BadRequestError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/submit", response_model=SelfAssessmentSummary)
async def submit_assessments(
    draft: list[SelfAssessmentDraftEntry],
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    try:
        service = SelfAssessmentService(session)
        return await service.submit(context, draft)
    except (BadRequestError, ValidationError, ConflictError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/summary/{period_id}", response_model=Optional[SelfAssessmentSummary])
async def get_summary(
    period_id: UUID,
    user_id: Optional[UUID] = None,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    try:
        service = SelfAssessmentService(session)
        return await service.get_summary(context, period_id, user_id)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
