from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.supervisor_feedback_repo import SupervisorFeedbackRepository
from app.schemas.common import RatingCode


@pytest.mark.asyncio
async def test_calculate_supervisor_rating_from_rating_data_returns_average():
    session = AsyncMock(spec=AsyncSession)
    repo = SupervisorFeedbackRepository(session)

    score_map = {
        RatingCode.SS: Decimal("100"),
        RatingCode.A: Decimal("70"),
        RatingCode.B: Decimal("40"),
    }

    async def resolve_score(*, organization_id, rating_code):
        assert organization_id == "org_test"
        return score_map[rating_code]

    repo.score_mapping_repo.get_numeric_value_for_rating_code = AsyncMock(side_effect=resolve_score)

    rating_data = {
        "comp-1": {"1": "SS", "2": "A"},
        "comp-2": {"3": "B"},
    }

    result = await repo._calculate_supervisor_rating_from_rating_data("org_test", rating_data)

    assert result == Decimal("70.00")
    assert repo.score_mapping_repo.get_numeric_value_for_rating_code.await_count == 3


@pytest.mark.asyncio
async def test_calculate_supervisor_rating_from_rating_data_ignores_invalid_entries():
    session = AsyncMock(spec=AsyncSession)
    repo = SupervisorFeedbackRepository(session)
    repo.score_mapping_repo.get_numeric_value_for_rating_code = AsyncMock()

    rating_data = {
        "comp-1": {"1": None, "2": "INVALID"},
        "comp-2": ["unexpected-list"],
    }

    result = await repo._calculate_supervisor_rating_from_rating_data("org_test", rating_data)

    assert result is None
    assert repo.score_mapping_repo.get_numeric_value_for_rating_code.await_count == 0
