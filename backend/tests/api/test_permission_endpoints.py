import pytest
from uuid import uuid4
from unittest.mock import AsyncMock

from fastapi import HTTPException

from app.api.v1.permissions import list_permissions
from app.api.v1.roles import (
    get_all_role_permissions,
    clone_role_permissions,
    get_role_permissions,
    get_permission_catalog_grouped,
    patch_role_permissions,
    replace_role_permissions,
)
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.schemas.permission import (
    PermissionCatalogItem,
    PermissionCatalogGroupedResponse,
    RolePermissionResponse,
    RolePermissionCloneRequest,
    RolePermissionPatchRequest,
    RolePermissionUpdateRequest,
)
from app.security.context import AuthContext, RoleInfo


def make_admin_context() -> AuthContext:
    return AuthContext(
        user_id=uuid4(),
        organization_id="org_api_test",
        roles=[RoleInfo(id=uuid4(), name="admin", description="Administrator")],
    )


@pytest.mark.asyncio
async def test_list_permissions_returns_catalog(monkeypatch):
    mock_service = AsyncMock()
    mock_service.list_catalog.return_value = [
        PermissionCatalogItem(code="user:read:all", description="すべてのユーザーを閲覧", permission_group="ユーザー"),
    ]
    monkeypatch.setattr("app.api.v1.permissions.PermissionService", lambda session: mock_service)

    result = await list_permissions(context=make_admin_context(), session=AsyncMock())
    assert result == mock_service.list_catalog.return_value
    mock_service.list_catalog.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_permission_catalog_grouped_returns_catalog(monkeypatch):
    mock_service = AsyncMock()
    grouped = PermissionCatalogGroupedResponse(
        groups=[],
        total_permissions=0,
    )
    mock_service.list_catalog_grouped.return_value = grouped
    monkeypatch.setattr("app.api.v1.roles.PermissionService", lambda session: mock_service)

    result = await get_permission_catalog_grouped(context=make_admin_context(), session=AsyncMock())
    assert result is grouped
    mock_service.list_catalog_grouped.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_role_permissions_not_found(monkeypatch):
    mock_service = AsyncMock()
    mock_service.get_role_permissions.side_effect = NotFoundError("missing role")
    monkeypatch.setattr("app.api.v1.roles.PermissionService", lambda session: mock_service)

    with pytest.raises(HTTPException) as exc:
        await get_role_permissions(
            role_id=uuid4(),
            context=make_admin_context(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 404
    mock_service.get_role_permissions.assert_awaited_once()


@pytest.mark.asyncio
async def test_replace_role_permissions_validation_error(monkeypatch):
    mock_service = AsyncMock()
    mock_service.replace_role_permissions.side_effect = ValueError("bad payload")
    monkeypatch.setattr("app.api.v1.roles.PermissionService", lambda session: mock_service)

    with pytest.raises(HTTPException) as exc:
        await replace_role_permissions(
            role_id=uuid4(),
            payload=RolePermissionUpdateRequest(permissions=[]),
            context=make_admin_context(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 400
    mock_service.replace_role_permissions.assert_awaited_once()


@pytest.mark.asyncio
async def test_patch_role_permissions_permission_denied(monkeypatch):
    mock_service = AsyncMock()
    mock_service.patch_role_permissions.side_effect = PermissionDeniedError("nope")
    monkeypatch.setattr("app.api.v1.roles.PermissionService", lambda session: mock_service)

    with pytest.raises(HTTPException) as exc:
        await patch_role_permissions(
            role_id=uuid4(),
            payload=RolePermissionPatchRequest(add=["user:read:all"]),
            context=make_admin_context(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_clone_role_permissions_success(monkeypatch):
    mock_service = AsyncMock()
    response = AsyncMock()
    mock_service.clone_role_permissions.return_value = response
    monkeypatch.setattr("app.api.v1.roles.PermissionService", lambda session: mock_service)

    result = await clone_role_permissions(
        role_id=uuid4(),
        payload=RolePermissionCloneRequest(from_role_id=uuid4()),
        context=make_admin_context(),
        session=AsyncMock(),
    )

    assert result is response
    mock_service.clone_role_permissions.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_all_role_permissions_success(monkeypatch):
    mock_service = AsyncMock()
    expected = [
        RolePermissionResponse(
            role_id=uuid4(),
            permissions=[
                PermissionCatalogItem(
                    code="user:read:all",
                    description="すべてのユーザーを閲覧",
                    permission_group="ユーザー",
                )
            ],
            version="1",
        )
    ]
    mock_service.list_all_role_permissions.return_value = expected
    monkeypatch.setattr("app.api.v1.roles.PermissionService", lambda session: mock_service)

    result = await get_all_role_permissions(
        context=make_admin_context(),
        session=AsyncMock(),
    )

    assert result is expected
    mock_service.list_all_role_permissions.assert_awaited_once()
