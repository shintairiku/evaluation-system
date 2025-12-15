import pytest
from uuid import uuid4
from unittest.mock import AsyncMock

from app.api.v2.users import get_current_user_v2
from app.security.context import AuthContext


@pytest.mark.asyncio
async def test_get_current_user_v2_returns_none_when_no_db_user(monkeypatch):
    ctx = AuthContext(
        user_id=None,
        clerk_user_id="clerk_missing",
        organization_id="org_test",
        organization_slug="test-org",
        roles=[],
    )

    monkeypatch.setattr(
        "app.api.v2.users.UserServiceV2",
        lambda session: (_ for _ in ()).throw(AssertionError("service should not be constructed")),
    )

    result = await get_current_user_v2(
        org_slug="test-org",
        context=ctx,
        include=None,
        session=AsyncMock(),
    )

    assert result is None


@pytest.mark.asyncio
async def test_get_current_user_v2_calls_service_with_minimal_default_includes(monkeypatch):
    user_id = uuid4()
    ctx = AuthContext(
        user_id=user_id,
        clerk_user_id="clerk_ok",
        organization_id="org_test",
        organization_slug="test-org",
        roles=[],
    )

    mock_service = AsyncMock()
    expected_user = {"id": str(user_id)}
    mock_service.get_user_detail.return_value = expected_user

    monkeypatch.setattr("app.api.v2.users.UserServiceV2", lambda session: mock_service)

    result = await get_current_user_v2(
        org_slug="test-org",
        context=ctx,
        include=None,
        session=AsyncMock(),
    )

    assert result is expected_user
    mock_service.get_user_detail.assert_awaited_once_with(
        ctx,
        user_id,
        include={"department", "stage", "roles"},
    )
