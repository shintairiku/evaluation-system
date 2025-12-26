import pytest
from unittest.mock import AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.goal_repo import GoalRepository


@pytest.mark.asyncio
async def test_search_goals_empty_user_ids_returns_empty_without_query():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    repo = GoalRepository(session)

    result = await repo.search_goals(org_id="org_test", user_ids=[])

    assert result == []
    assert session.execute.await_count == 0


@pytest.mark.asyncio
async def test_count_goals_empty_user_ids_returns_zero_without_query():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    repo = GoalRepository(session)

    result = await repo.count_goals(org_id="org_test", user_ids=[])

    assert result == 0
    assert session.execute.await_count == 0


@pytest.mark.asyncio
async def test_goal_list_page_empty_user_ids_returns_empty_without_query():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    repo = GoalRepository(session)

    rows, total = await repo.get_goal_list_page(
        org_id="org_test",
        user_ids=[],
        period_id=None,
        status=None,
        pagination=None,
    )

    assert rows == []
    assert total == 0
    assert session.execute.await_count == 0

