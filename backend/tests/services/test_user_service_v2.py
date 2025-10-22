import pytest

from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Role as RoleEnum
from app.services.user_service_v2 import UserServiceV2


def build_admin_context(user, organization_id: str) -> AuthContext:
    admin_role = RoleInfo(id=1, name=RoleEnum.ADMIN.value, description="Admin")
    return AuthContext(
        user_id=user.id,
        roles=[admin_role],
        clerk_user_id=user.clerk_user_id,
        organization_id=organization_id,
        organization_slug="test-org",
    )


@pytest.mark.asyncio
async def test_service_list_users_returns_enriched_payload(test_session, seeded_user_data):
    service = UserServiceV2(test_session)
    org_id = seeded_user_data["org"].id
    ctx = build_admin_context(seeded_user_data["users"]["admin"], org_id)

    result = await service.list_users(
        ctx,
        page=1,
        limit=10,
        with_count=True,
    )

    assert result.payload.total == 4
    assert result.payload.page == 1
    assert result.payload.limit == 10
    assert result.payload.pages == 1
    assert len(result.payload.items) == 4
    assert result.next_cursor is None
    assert result.metrics["query_count"] >= 4
    assert result.metrics["db_time_ms"] >= 0.0
    staff = next(item for item in result.payload.items if item.name == "Dana Staff")
    assert staff.department is not None
    assert staff.stage is not None
    assert staff.roles
    assert staff.supervisor is not None
    assert staff.supervisor.name == "Bob Manager"
    assert staff.subordinates is None


@pytest.mark.asyncio
async def test_service_list_users_without_count_flags_approximate(test_session, seeded_user_data):
    service = UserServiceV2(test_session)
    org_id = seeded_user_data["org"].id
    ctx = build_admin_context(seeded_user_data["users"]["admin"], org_id)

    result = await service.list_users(
        ctx,
        page=1,
        limit=2,
        with_count=False,
    )

    assert result.approximate_total is True
    assert result.payload.total == 2
    assert len(result.payload.items) == 2
