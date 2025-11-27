from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.viewer_visibility import (
    ViewerVisibilityPatchRequest,
    ViewerVisibilityResponse,
    ViewerVisibilityUpdateRequest,
)
from ...services.viewer_visibility_service import ViewerVisibilityService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, PermissionDeniedError, ConflictError

router = APIRouter(prefix="/viewers", tags=["viewers"])


@router.get("/{viewer_id}/visibility", response_model=ViewerVisibilityResponse)
async def get_viewer_visibility(
    viewer_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ViewerVisibilityService(session)
        return await service.get_viewer_visibility(viewer_id, context)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load viewer visibility overrides",
        ) from exc


@router.put("/{viewer_id}/visibility", response_model=ViewerVisibilityResponse)
async def replace_viewer_visibility(
    viewer_id: UUID,
    payload: ViewerVisibilityUpdateRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ViewerVisibilityService(session)
        return await service.replace_viewer_visibility(viewer_id, payload, context)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to replace viewer visibility overrides",
        ) from exc


@router.patch("/{viewer_id}/visibility", response_model=ViewerVisibilityResponse)
async def patch_viewer_visibility(
    viewer_id: UUID,
    payload: ViewerVisibilityPatchRequest,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = ViewerVisibilityService(session)
        return await service.patch_viewer_visibility(viewer_id, payload, context)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to patch viewer visibility overrides",
        ) from exc
