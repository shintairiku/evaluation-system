from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...schemas.support_document import (
    SupportDocumentCreate,
    SupportDocumentUpdate,
    SupportDocumentResponse,
    SupportDocumentListResponse,
)
from ...schemas.common import BaseResponse
from ...services.support_document_service import SupportDocumentService
from ...security import AuthContext, get_auth_context
from ...core.exceptions import NotFoundError, PermissionDeniedError, ValidationError

router = APIRouter(prefix="/support-documents", tags=["support-documents"])


@router.get("/", response_model=SupportDocumentListResponse)
async def get_support_documents(
    category: Optional[str] = Query(None, description="Filter by category"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Get support documents for the current organization + system-wide docs."""
    try:
        service = SupportDocumentService(session)
        return await service.list_documents(context, category=category)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.post("/", response_model=SupportDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_support_document(
    data: SupportDocumentCreate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Create a new support document (admin only)."""
    try:
        service = SupportDocumentService(session)
        return await service.create_document(data, context)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.put("/{document_id}", response_model=SupportDocumentResponse)
async def update_support_document(
    document_id: UUID,
    data: SupportDocumentUpdate,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Update a support document (admin only)."""
    try:
        service = SupportDocumentService(session)
        return await service.update_document(document_id, data, context)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )


@router.delete("/{document_id}", response_model=BaseResponse)
async def delete_support_document(
    document_id: UUID,
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a support document (admin only)."""
    try:
        service = SupportDocumentService(session)
        await service.delete_document(document_id, context)
        return BaseResponse(message="Support document deleted successfully")
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )
