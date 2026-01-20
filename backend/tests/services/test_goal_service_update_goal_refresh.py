from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.goal import GoalStatus
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.goal_service import GoalService


def _employee_context(*, user_id, org_id: str) -> AuthContext:
    return AuthContext(
        user_id=user_id,
        roles=[RoleInfo(id=1, name="employee", description="Employee role")],
        organization_id=org_id,
        role_permission_overrides={"employee": {Permission.GOAL_MANAGE_SELF}},
    )


@pytest.mark.asyncio
async def test_update_goal_refreshes_after_commit():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = GoalStatus.DRAFT.value
    existing_goal.period_id = uuid4()
    existing_goal.goal_category = "業績目標"
    existing_goal.target_data = {"performance_goal_type": "quantitative"}
    existing_goal.weight = Decimal("0")

    updated_goal = MagicMock()
    updated_goal.id = goal_id

    goal_update = MagicMock()
    goal_update.weight = 100.0
    goal_update.performance_goal_type = None

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service._validate_goal_update = AsyncMock(return_value=None)
    service._get_stage_budget_for_user = AsyncMock(
        return_value={
            "stage_id": uuid4(),
            "quantitative": Decimal("100"),
            "qualitative": Decimal("0"),
            "competency": Decimal("10"),
        }
    )
    service._validate_stage_weight_budget = AsyncMock(return_value=None)
    service.goal_repo.update_goal = AsyncMock(return_value=updated_goal)
    service._build_competency_name_map_for_goal = AsyncMock(return_value={})
    enriched_goal = MagicMock()
    service._enrich_goal_data = AsyncMock(return_value=enriched_goal)

    result = await service.update_goal(goal_id, goal_update, context)

    assert result is enriched_goal
    session.refresh.assert_awaited_once_with(updated_goal)

