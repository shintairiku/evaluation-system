from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import BadRequestError, NotFoundError, PermissionDeniedError
from ...database.session import get_db_session
from ...schemas.comprehensive_evaluation import (
    ComprehensiveEvaluationFinalizeRequest,
    ComprehensiveEvaluationFinalizeResponse,
    ComprehensiveEvaluationListResponse,
    ComprehensiveEvaluationSettings,
    ComprehensiveManualDecisionHistoryResponse,
    ComprehensiveManualDecisionResponse,
    ComprehensiveManualDecisionUpsertRequest,
)
from ...security import AuthContext, get_auth_context
from ...services.comprehensive_evaluation_service import ComprehensiveEvaluationService


router = APIRouter(prefix="/evaluation/comprehensive-evaluation", tags=["evaluation-pages"])


@router.get("", response_model=ComprehensiveEvaluationListResponse)
async def get_comprehensive_evaluation(
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    department_id: Optional[UUID] = Query(None, alias="departmentId", description="Department filter"),
    stage_id: Optional[UUID] = Query(None, alias="stageId", description="Stage filter"),
    employment_type: Optional[str] = Query(None, alias="employmentType", description="employee or parttime"),
    search: Optional[str] = Query(None, alias="search", description="Free text search"),
    processing_status: Optional[str] = Query(
        None,
        alias="processingStatus",
        description="processed or unprocessed",
    ),
    candidate_view: bool = Query(
        False,
        alias="candidateView",
        description="Require eval_admin access for candidate view",
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=200),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.get_comprehensive_evaluation(
            context=context,
            period_id=period_id,
            department_id=department_id,
            stage_id=stage_id,
            employment_type=employment_type,
            search=search,
            processing_status=processing_status,
            candidate_view=candidate_view,
            page=page,
            limit=limit,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comprehensive evaluation",
        ) from exc


@router.get("/stage-options", response_model=List[str])
async def get_comprehensive_evaluation_stage_options(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.get_stage_options(context=context)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comprehensive evaluation stage options",
        ) from exc


@router.get("/settings", response_model=ComprehensiveEvaluationSettings)
async def get_comprehensive_evaluation_settings(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.get_settings(context=context)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comprehensive evaluation settings",
        ) from exc


@router.put("/settings", response_model=ComprehensiveEvaluationSettings)
async def update_comprehensive_evaluation_settings(
    payload: ComprehensiveEvaluationSettings,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.update_settings(context=context, settings=payload)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update comprehensive evaluation settings",
        ) from exc


@router.post("/finalize", response_model=ComprehensiveEvaluationFinalizeResponse)
async def finalize_comprehensive_evaluation_period(
    payload: ComprehensiveEvaluationFinalizeRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.finalize_evaluation_period(
            context=context,
            period_id=payload.period_id,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to finalize evaluation period",
        ) from exc


@router.put("/manual-decisions/{user_id}", response_model=ComprehensiveManualDecisionResponse)
async def upsert_comprehensive_manual_decision(
    user_id: UUID,
    payload: ComprehensiveManualDecisionUpsertRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.upsert_manual_decision(
            context=context,
            user_id=user_id,
            payload=payload,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upsert comprehensive manual decision",
        ) from exc


@router.delete("/manual-decisions/{user_id}")
async def clear_comprehensive_manual_decision(
    user_id: UUID,
    period_id: UUID = Query(..., alias="periodId", description="Evaluation period ID"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        await service.clear_manual_decision(
            context=context,
            user_id=user_id,
            period_id=period_id,
        )
        return {"success": True}
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear comprehensive manual decision",
        ) from exc


@router.get("/manual-decisions/history", response_model=ComprehensiveManualDecisionHistoryResponse)
async def get_comprehensive_manual_decision_history(
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Evaluation period ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ComprehensiveEvaluationService(session)
        return await service.get_manual_decision_history(
            context=context,
            period_id=period_id,
            page=page,
            limit=limit,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch comprehensive manual decision history",
        ) from exc
