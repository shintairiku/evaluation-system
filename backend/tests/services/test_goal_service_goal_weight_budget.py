import pytest
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import UUID

from app.services.goal_service import GoalService
from app.core.exceptions import BadRequestError


class TestGoalServiceGoalWeightBudget:
    @pytest.mark.asyncio
    async def test_get_stage_budget_for_user_uses_effective_weights(self):
        session = AsyncMock()
        service = GoalService(session)
        service.user_repo = AsyncMock()

        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        org_id = "org_123"
        service.user_repo.get_user_stage_with_weights = AsyncMock(return_value={
            "stage_id": UUID("87654321-4321-4321-4321-987654321def"),
            "quantitative_weight": 65,
            "qualitative_weight": 25,
            "competency_weight": 10,
            "source": "user",
        })

        result = await service._get_stage_budget_for_user(user_id, org_id)

        assert result["quantitative"] == Decimal("65")
        assert result["qualitative"] == Decimal("25")
        assert result["competency"] == Decimal("10")

    @pytest.mark.asyncio
    async def test_get_stage_budget_for_user_requires_stage(self):
        session = AsyncMock()
        service = GoalService(session)
        service.user_repo = AsyncMock()

        user_id = UUID("12345678-1234-1234-1234-123456789abc")
        org_id = "org_123"
        service.user_repo.get_user_stage_with_weights = AsyncMock(return_value={
            "stage_id": None,
            "quantitative_weight": 70,
            "qualitative_weight": 20,
            "competency_weight": 10,
        })

        with pytest.raises(BadRequestError):
            await service._get_stage_budget_for_user(user_id, org_id)
