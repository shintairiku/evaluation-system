import pytest

from app.database.repositories.user_repository_v2 import UserRepositoryV2
from app.schemas.user import UserStatus


@pytest.mark.asyncio
async def test_list_users_keyset_paginates(test_session, seeded_user_data):
    repo = UserRepositoryV2(test_session)
    org_id = seeded_user_data["org"].id

    page_one, cursor = await repo.list_users_keyset(
        org_id,
        limit=2,
        sort="name:asc",
    )

    assert len(page_one) == 2
    assert [user.name for user in page_one] == sorted([user.name for user in page_one])
    assert cursor is not None

    page_two, cursor_two = await repo.list_users_keyset(
        org_id,
        limit=2,
        page=2,
        sort="name:asc",
    )

    assert len(page_two) == 2
    names = [user.name for user in page_one + page_two]
    assert sorted(names) == names
    assert cursor_two is None


@pytest.mark.asyncio
async def test_list_users_keyset_respects_filters(test_session, seeded_user_data):
    repo = UserRepositoryV2(test_session)
    org_id = seeded_user_data["org"].id
    manager_role_id = seeded_user_data["roles"]["manager"].id

    managers, next_cursor = await repo.list_users_keyset(
        org_id,
        limit=10,
        role_ids=[manager_role_id],
        statuses=[UserStatus.ACTIVE],
    )

    assert next_cursor is None
    assert len(managers) == 2  # manager and supervisor share manager role
    assert all(user.status == UserStatus.ACTIVE.value for user in managers)
    assert all(user.clerk_organization_id == org_id for user in managers)


@pytest.mark.asyncio
async def test_count_users_matches_seed(test_session, seeded_user_data):
    repo = UserRepositoryV2(test_session)
    org_id = seeded_user_data["org"].id

    total = await repo.count_users(
        org_id,
        statuses=[UserStatus.ACTIVE],
    )

    assert total == 4
