import pytest
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

from app.services.user_service import UserService
from app.schemas.user import (
    BulkUserStatusUpdateItem,
    BulkUserStatusUpdateResponse,
    UserStatus,
)
from app.security.context import AuthContext, RoleInfo
from app.core.exceptions import BadRequestError


def make_admin_context(org_id: str = "org-1") -> AuthContext:
    return AuthContext(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        roles=[RoleInfo(id=1, name="admin", description="")],
        organization_id=org_id,
        organization_slug="org",
    )


@pytest.mark.asyncio
async def test_bulk_status_happy_path():
    session = AsyncMock()
    service = UserService(session)

    # Prepare IDs and items
    u1, u2, u3 = uuid4(), uuid4(), uuid4()
    items = [
        BulkUserStatusUpdateItem(userId=u1, newStatus=UserStatus.ACTIVE),  # pending -> active
        BulkUserStatusUpdateItem(userId=u2, newStatus=UserStatus.INACTIVE),  # active -> inactive
        BulkUserStatusUpdateItem(userId=u3, newStatus=UserStatus.ACTIVE),  # inactive -> active
    ]

    # Mock repository behavior
    current_map = {
        u1: UserStatus.PENDING_APPROVAL.value,
        u2: UserStatus.ACTIVE.value,
        u3: UserStatus.INACTIVE.value,
    }
    service.user_repo.get_user_statuses = AsyncMock(return_value=current_map)
    service.user_repo.batch_update_user_statuses = AsyncMock(return_value={u1, u2, u3})

    ctx = make_admin_context()
    resp: BulkUserStatusUpdateResponse = await service.bulk_update_user_statuses(items, ctx)

    assert resp.success_count == 3
    assert resp.failure_count == 0
    assert all(r.success for r in resp.results)


@pytest.mark.asyncio
async def test_bulk_status_invalid_transitions_and_duplicates_and_partial():
    session = AsyncMock()
    service = UserService(session)

    u_ok, u_same, u_invalid, u_cross = uuid4(), uuid4(), uuid4(), uuid4()
    items = [
        BulkUserStatusUpdateItem(userId=u_ok, newStatus=UserStatus.INACTIVE),      # active -> inactive (ok)
        BulkUserStatusUpdateItem(userId=u_same, newStatus=UserStatus.ACTIVE),      # active -> active (same)
        BulkUserStatusUpdateItem(userId=u_invalid, newStatus=UserStatus.PENDING_APPROVAL),  # inactive -> pending (invalid)
        BulkUserStatusUpdateItem(userId=u_cross, newStatus=UserStatus.ACTIVE),     # cross-org (missing in precheck)
        BulkUserStatusUpdateItem(userId=u_ok, newStatus=UserStatus.INACTIVE),      # duplicate of first
    ]

    current_map = {
        u_ok: UserStatus.ACTIVE.value,
        u_same: UserStatus.ACTIVE.value,
        u_invalid: UserStatus.INACTIVE.value,
        # u_cross omitted to simulate out-of-org
    }
    service.user_repo.get_user_statuses = AsyncMock(return_value=current_map)
    # Only u_ok should be updated
    service.user_repo.batch_update_user_statuses = AsyncMock(return_value={u_ok})

    ctx = make_admin_context()
    resp: BulkUserStatusUpdateResponse = await service.bulk_update_user_statuses(items, ctx)

    # Expected: u_ok success; others fail for specific reasons; duplicate flagged
    # Note: dict-by-id would overwrite the duplicate entry. Check via predicates instead.
    assert any(r.user_id == u_ok and r.success for r in resp.results)
    assert any(r.user_id == u_same and (not r.success) and "already" in (r.error or "").lower() for r in resp.results)
    assert any(r.user_id == u_invalid and (not r.success) and "invalid status transition" in (r.error or "").lower() for r in resp.results)
    assert any(r.user_id == u_cross and (not r.success) and "not found" in (r.error or "").lower() for r in resp.results)

    # The duplicate entry should be present as a failure result for the duplicate occurrence
    duplicate_failures = [r for r in resp.results if (r.user_id == u_ok and r.success is False and r.error)]
    assert any("duplicate" in (r.error or "").lower() for r in duplicate_failures)

    assert resp.success_count == 1
    assert resp.failure_count == len(resp.results) - 1


@pytest.mark.asyncio
async def test_bulk_status_more_than_limit_100_raises():
    session = AsyncMock()
    service = UserService(session)

    items = [
        BulkUserStatusUpdateItem(userId=uuid4(), newStatus=UserStatus.ACTIVE)
        for _ in range(101)
    ]

    ctx = make_admin_context()
    with pytest.raises(BadRequestError):
        await service.bulk_update_user_statuses(items, ctx)

