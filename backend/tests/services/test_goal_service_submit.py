from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.schemas.goal import GoalStatus
from app.schemas.user import UserStatus
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
@pytest.mark.parametrize(
    "user_status",
    [UserStatus.PENDING_APPROVAL.value, UserStatus.INACTIVE.value],
)
async def test_submit_denied_for_non_active_users(user_status: str):
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

    current_user = MagicMock()
    current_user.status = user_status

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.user_repo.get_user_by_id = AsyncMock(return_value=current_user)
    service.goal_repo.update_goal_status = AsyncMock()

    with pytest.raises(BadRequestError):
        await service.submit_goal(goal_id, "submitted", context)

    assert service.goal_repo.update_goal_status.await_count == 0


@pytest.mark.asyncio
async def test_submit_allows_active_user():
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

    current_user = MagicMock()
    current_user.status = UserStatus.ACTIVE.value

    updated_goal = MagicMock()
    updated_goal.id = goal_id

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.user_repo.get_user_by_id = AsyncMock(return_value=current_user)
    service.goal_repo.update_goal_status = AsyncMock(return_value=updated_goal)
    service._create_related_assessment_records = AsyncMock(return_value=None)
    service._build_competency_name_map_for_goal = AsyncMock(return_value={})
    enriched = MagicMock()
    service._enrich_goal_data = AsyncMock(return_value=enriched)

    result = await service.submit_goal(goal_id, "submitted", context)

    assert result is enriched
    service.goal_repo.update_goal_status.assert_awaited_once_with(goal_id, GoalStatus.SUBMITTED, org_id)
    assert session.commit.await_count == 2

