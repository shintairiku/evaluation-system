import pytest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.core_value_feedback_repo import CoreValueFeedbackRepository


@pytest.mark.asyncio
async def test_count_pending_feedback_returns_count_via_query():
    """Verify count_pending_feedback calls session.execute (basic smoke test)."""
    session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar.return_value = 3
    session.execute = AsyncMock(return_value=mock_result)
    repo = CoreValueFeedbackRepository(session)

    result = await repo.count_pending_feedback(
        period_id="period-1",
        supervisor_id="supervisor-1",
        org_id="org_test"
    )

    assert result == 3
    assert session.execute.await_count == 1
