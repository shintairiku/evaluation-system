from typing import Optional, Set
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import BadRequestError, PermissionDeniedError
from ...database.session import get_db_session
from ...schemas.common import PaginatedResponse
from ...schemas.user import (
    BulkUserStatusUpdateItem,
    BulkUserStatusUpdateResponse,
    UserDetailResponse,
    UserStatus,
)
from ...schemas.user_page import UserListPageResponse
from ...security import AuthContext, get_auth_context
from ...services.user_service_v2 import UserServiceV2
from ...services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=PaginatedResponse[UserDetailResponse])
async def list_users_v2(
    org_slug: str,  # Path param from parent router; retained for signature parity
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    search: Optional[str] = Query(None, description="Search term for name, employee code, email, or job title"),
    q: Optional[str] = Query(None, description="Alias for search"),
    department_ids: Optional[list[UUID]] = Query(None, description="Filter by department IDs"),
    stage_ids: Optional[list[UUID]] = Query(None, description="Filter by stage IDs"),
    role_ids: Optional[list[UUID]] = Query(None, description="Filter by role IDs"),
    statuses: Optional[list[UserStatus]] = Query(None, description="Filter by user statuses"),
    supervisor_id: Optional[UUID] = Query(None, description="Filter by supervisor ID"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    include: Optional[str] = Query(None, description="Comma-separated list of relations to include"),
    with_count: bool = Query(True, alias="withCount", description="Whether to compute total count"),
    cursor: Optional[str] = Query(None, description="Opaque cursor for keyset pagination"),
    sort: Optional[str] = Query(None, description="Sort definition, e.g., name:asc or created_at:desc"),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = UserServiceV2(session)
        include_parts: Optional[Set[str]] = set(part.strip() for part in include.split(",") if part.strip()) if include else None

        result = await service.list_users(
            context,
            page=page,
            limit=limit,
            cursor=cursor,
            search_term=search or q,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            include=include_parts,
            with_count=with_count,
            sort=sort,
        )

        if result.next_cursor:
            response.headers["X-Next-Cursor"] = result.next_cursor
        response.headers["X-Query-Count"] = str(int(result.metrics.get("query_count", 0)))
        response.headers["X-DB-Time"] = f"{result.metrics.get('db_time_ms', 0.0):.2f}ms"
        response.headers["X-Total-Approximate"] = "true" if result.approximate_total else "false"

        return result.payload

    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users",
        ) from exc


@router.get("/page", response_model=UserListPageResponse)
async def get_user_list_page(
    org_slug: str,
    response: Response,
    context: AuthContext = Depends(get_auth_context),
    search: Optional[str] = Query(None, description="Search term for name, employee code, email, or job title"),
    q: Optional[str] = Query(None, description="Alias for search"),
    department_ids: Optional[list[UUID]] = Query(None, description="Filter by department IDs"),
    stage_ids: Optional[list[UUID]] = Query(None, description="Filter by stage IDs"),
    role_ids: Optional[list[UUID]] = Query(None, description="Filter by role IDs"),
    statuses: Optional[list[UserStatus]] = Query(None, description="Filter by user statuses"),
    supervisor_id: Optional[UUID] = Query(None, description="Filter by supervisor ID"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    include: Optional[str] = Query(None, description="Comma-separated list of relations to include"),
    with_count: bool = Query(True, alias="withCount", description="Whether to compute total count"),
    cursor: Optional[str] = Query(None, description="Opaque cursor for keyset pagination"),
    sort: Optional[str] = Query(None, description="Sort definition, e.g., name:asc or created_at:desc"),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = UserServiceV2(session)
        include_parts: Optional[Set[str]] = set(part.strip() for part in include.split(",") if part.strip()) if include else None

        result = await service.get_user_list_page(
            context,
            page=page,
            limit=limit,
            cursor=cursor,
            search_term=search or q,
            statuses=statuses,
            department_ids=department_ids,
            stage_ids=stage_ids,
            role_ids=role_ids,
            supervisor_id=supervisor_id,
            include=include_parts,
            with_count=with_count,
            sort=sort,
        )

        metrics = service._collect_metrics()
        if result.meta.next_cursor:
            response.headers["X-Next-Cursor"] = result.meta.next_cursor
        response.headers["X-Query-Count"] = str(int(metrics.get("query_count", 0)))
        response.headers["X-DB-Time"] = f"{metrics.get('db_time_ms', 0.0):.2f}ms"
        response.headers["X-Total-Approximate"] = "true" if result.meta.approximate_total else "false"

        return result

    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user list page",
        ) from exc


@router.patch("/bulk-status", response_model=BulkUserStatusUpdateResponse)
async def bulk_update_status(
    org_slug: str,
    items: list[BulkUserStatusUpdateItem],
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        service = UserService(session)
        response = await service.bulk_update_user_statuses(items, context)
        return response
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BadRequestError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update user statuses",
        ) from exc
