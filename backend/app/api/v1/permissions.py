from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.permission import PermissionCatalogItem
from ...services.permission_service import PermissionService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import PermissionDeniedError


router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("/", response_model=List[PermissionCatalogItem])
async def list_permissions(
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = PermissionService(session)
        return await service.list_catalog(context)
    except PermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )
    except Exception as exc:  # pragma: no cover - fallback safety net
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load permission catalog",
        ) from exc
