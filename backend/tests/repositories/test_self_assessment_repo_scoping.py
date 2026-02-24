import pytest
from unittest.mock import AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.self_assessment_repo import SelfAssessmentRepository


@pytest.mark.asyncio
async def test_search_assessments_empty_user_ids_returns_empty_without_query():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    repo = SelfAssessmentRepository(session)

    result = await repo.search_assessments(org_id="org_test", user_ids=[])

    assert result == []
    assert session.execute.await_count == 0


@pytest.mark.asyncio
async def test_count_assessments_empty_user_ids_returns_zero_without_query():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    repo = SelfAssessmentRepository(session)

    result = await repo.count_assessments(org_id="org_test", user_ids=[])

    assert result == 0
    assert session.execute.await_count == 0
