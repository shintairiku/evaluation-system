import pytest
from unittest.mock import AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.core_value_evaluation_repo import CoreValueEvaluationRepository


@pytest.mark.asyncio
async def test_get_evaluation_status_by_users_empty_user_ids_returns_empty_without_query():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    repo = CoreValueEvaluationRepository(session)

    result = await repo.get_evaluation_status_by_users(user_ids=[], period_id="period-1", org_id="org_test")

    assert result == {}
    assert session.execute.await_count == 0
