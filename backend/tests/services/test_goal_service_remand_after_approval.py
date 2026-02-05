from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.schemas.goal import GoalStatus
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.goal_service import GoalService


def _approver_context(*, user_id, org_id: str) -> AuthContext:
    return AuthContext(
        user_id=user_id,
        roles=[RoleInfo(id=1, name="supervisor", description="Supervisor role")],
        organization_id=org_id,
        role_permission_overrides={"supervisor": {Permission.GOAL_APPROVE}},
    )


@pytest.mark.asyncio
async def test_reject_goal_allows_remand_from_approved(monkeypatch):
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    supervisor_id = uuid4()
    owner_id = uuid4()
    goal_id = uuid4()
    period_id = uuid4()

    context = _approver_context(user_id=supervisor_id, org_id=org_id)

    goal = MagicMock()
    goal.id = goal_id
    goal.user_id = owner_id
    goal.period_id = period_id
    goal.status = GoalStatus.APPROVED.value
    goal.goal_category = "業績目標"
    goal.target_data = {"title": "test"}
    goal.weight = 10.0

    period = MagicMock()
    period.status = "active"

    updated_goal = MagicMock()
    updated_goal.id = goal_id

    monkeypatch.setattr(
        "app.services.goal_service.RBACHelper.can_access_resource",
        AsyncMock(return_value=True),
    )

    service.goal_repo.get_goal_by_id_with_details = AsyncMock(return_value=goal)
    service.evaluation_period_repo.get_by_id = AsyncMock(return_value=period)
    service.self_assessment_repo.get_by_goal = AsyncMock(return_value=None)

    service.goal_repo.update_goal_status = AsyncMock(return_value=updated_goal)

    service.supervisor_review_repo.get_by_unique_keys = AsyncMock(return_value=None)
    service.supervisor_review_repo.create = AsyncMock()

    service.goal_repo.get_replacement_draft_by_previous_goal_id = AsyncMock(return_value=None)
    service.goal_repo.create_goal_from_model = AsyncMock()

    service._build_competency_name_map_for_goal = AsyncMock(return_value={})
    enriched = MagicMock()
    service._enrich_goal_data = AsyncMock(return_value=enriched)

    result = await service.reject_goal(goal_id, "reason", context)

    assert result is enriched
    service.goal_repo.update_goal_status.assert_awaited_once_with(goal_id, GoalStatus.REJECTED, org_id)
    service.goal_repo.create_goal_from_model.assert_awaited_once()
    assert session.commit.await_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("period_status", ["completed", "cancelled"])
async def test_reject_goal_blocks_when_period_is_completed_or_cancelled(monkeypatch, period_status: str):
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    supervisor_id = uuid4()
    owner_id = uuid4()
    goal_id = uuid4()
    period_id = uuid4()

    context = _approver_context(user_id=supervisor_id, org_id=org_id)

    goal = MagicMock()
    goal.id = goal_id
    goal.user_id = owner_id
    goal.period_id = period_id
    goal.status = GoalStatus.APPROVED.value

    period = MagicMock()
    period.status = period_status

    monkeypatch.setattr(
        "app.services.goal_service.RBACHelper.can_access_resource",
        AsyncMock(return_value=True),
    )

    service.goal_repo.get_goal_by_id_with_details = AsyncMock(return_value=goal)
    service.evaluation_period_repo.get_by_id = AsyncMock(return_value=period)
    service.self_assessment_repo.get_by_goal = AsyncMock(return_value=None)

    service.goal_repo.update_goal_status = AsyncMock()

    with pytest.raises(BadRequestError):
        await service.reject_goal(goal_id, "reason", context)

    assert service.goal_repo.update_goal_status.await_count == 0
    assert service.self_assessment_repo.get_by_goal.await_count == 0
    assert session.commit.await_count == 0


@pytest.mark.asyncio
async def test_reject_goal_blocks_when_self_assessment_exists(monkeypatch):
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    supervisor_id = uuid4()
    owner_id = uuid4()
    goal_id = uuid4()
    period_id = uuid4()

    context = _approver_context(user_id=supervisor_id, org_id=org_id)

    goal = MagicMock()
    goal.id = goal_id
    goal.user_id = owner_id
    goal.period_id = period_id
    goal.status = GoalStatus.APPROVED.value

    period = MagicMock()
    period.status = "active"

    existing_assessment = MagicMock()

    monkeypatch.setattr(
        "app.services.goal_service.RBACHelper.can_access_resource",
        AsyncMock(return_value=True),
    )

    service.goal_repo.get_goal_by_id_with_details = AsyncMock(return_value=goal)
    service.evaluation_period_repo.get_by_id = AsyncMock(return_value=period)
    service.self_assessment_repo.get_by_goal = AsyncMock(return_value=existing_assessment)

    service.goal_repo.update_goal_status = AsyncMock()

    with pytest.raises(BadRequestError):
        await service.reject_goal(goal_id, "reason", context)

    assert service.goal_repo.update_goal_status.await_count == 0
    assert session.commit.await_count == 0


@pytest.mark.asyncio
async def test_reject_goal_does_not_duplicate_replacement_draft(monkeypatch):
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    supervisor_id = uuid4()
    owner_id = uuid4()
    goal_id = uuid4()
    period_id = uuid4()

    context = _approver_context(user_id=supervisor_id, org_id=org_id)

    goal = MagicMock()
    goal.id = goal_id
    goal.user_id = owner_id
    goal.period_id = period_id
    goal.status = GoalStatus.APPROVED.value
    goal.goal_category = "業績目標"
    goal.target_data = {"title": "test"}
    goal.weight = 10.0

    period = MagicMock()
    period.status = "active"

    updated_goal = MagicMock()
    updated_goal.id = goal_id

    existing_replacement = MagicMock()

    monkeypatch.setattr(
        "app.services.goal_service.RBACHelper.can_access_resource",
        AsyncMock(return_value=True),
    )

    service.goal_repo.get_goal_by_id_with_details = AsyncMock(return_value=goal)
    service.evaluation_period_repo.get_by_id = AsyncMock(return_value=period)
    service.self_assessment_repo.get_by_goal = AsyncMock(return_value=None)

    service.goal_repo.update_goal_status = AsyncMock(return_value=updated_goal)

    service.supervisor_review_repo.get_by_unique_keys = AsyncMock(return_value=None)
    service.supervisor_review_repo.create = AsyncMock()

    service.goal_repo.get_replacement_draft_by_previous_goal_id = AsyncMock(return_value=existing_replacement)
    service.goal_repo.create_goal_from_model = AsyncMock()

    service._build_competency_name_map_for_goal = AsyncMock(return_value={})
    enriched = MagicMock()
    service._enrich_goal_data = AsyncMock(return_value=enriched)

    result = await service.reject_goal(goal_id, "reason", context)

    assert result is enriched
    assert service.goal_repo.create_goal_from_model.await_count == 0
    assert session.commit.await_count == 1
