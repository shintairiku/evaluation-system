from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, PermissionDeniedError
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
async def test_withdraw_deletes_untouched_supervisor_review_and_sets_goal_to_draft():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()
    period_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"
    existing_goal.period_id = period_id

    review = MagicMock()
    review.id = uuid4()
    review.status = "draft"
    review.comment = "   "

    updated_goal = MagicMock()
    updated_goal.id = goal_id
    updated_goal.user_id = owner_id
    updated_goal.status = "draft"
    updated_goal.period_id = period_id

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.supervisor_review_repo.get_by_goal = AsyncMock(return_value=[review])
    service.supervisor_review_repo.delete = AsyncMock(return_value=True)
    service.goal_repo.update_goal_status = AsyncMock(return_value=updated_goal)
    service._build_competency_name_map_for_goal = AsyncMock(return_value={})
    enriched = MagicMock()
    service._enrich_goal_data = AsyncMock(return_value=enriched)

    result = await service.submit_goal(goal_id, "draft", context)

    assert result is enriched
    service.supervisor_review_repo.delete.assert_awaited_once_with(review.id, org_id)
    service.goal_repo.update_goal_status.assert_awaited_once_with(goal_id, GoalStatus.DRAFT, org_id)
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_withdraw_denied_when_supervisor_comment_is_not_empty():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"

    review = MagicMock()
    review.id = uuid4()
    review.status = "draft"
    review.comment = "review started"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.supervisor_review_repo.get_by_goal = AsyncMock(return_value=[review])
    service.supervisor_review_repo.delete = AsyncMock(return_value=True)
    service.goal_repo.update_goal_status = AsyncMock()

    with pytest.raises(BadRequestError):
        await service.submit_goal(goal_id, "draft", context)

    assert service.supervisor_review_repo.delete.await_count == 0
    assert service.goal_repo.update_goal_status.await_count == 0


@pytest.mark.asyncio
async def test_withdraw_denied_when_supervisor_review_status_is_not_draft():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"

    review = MagicMock()
    review.id = uuid4()
    review.status = "submitted"
    review.comment = ""

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.supervisor_review_repo.get_by_goal = AsyncMock(return_value=[review])
    service.supervisor_review_repo.delete = AsyncMock(return_value=True)
    service.goal_repo.update_goal_status = AsyncMock()

    with pytest.raises(BadRequestError):
        await service.submit_goal(goal_id, "draft", context)

    assert service.supervisor_review_repo.delete.await_count == 0
    assert service.goal_repo.update_goal_status.await_count == 0


@pytest.mark.asyncio
async def test_withdraw_denied_when_goal_is_not_submitted():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "draft"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)

    with pytest.raises(BadRequestError):
        await service.submit_goal(goal_id, "draft", context)


@pytest.mark.asyncio
async def test_withdraw_allows_when_review_record_is_missing():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()
    period_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"
    existing_goal.period_id = period_id

    updated_goal = MagicMock()
    updated_goal.id = goal_id
    updated_goal.user_id = owner_id
    updated_goal.status = "draft"
    updated_goal.period_id = period_id

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.supervisor_review_repo.get_by_goal = AsyncMock(return_value=[])
    service.supervisor_review_repo.delete = AsyncMock(return_value=True)
    service.goal_repo.update_goal_status = AsyncMock(return_value=updated_goal)
    service._build_competency_name_map_for_goal = AsyncMock(return_value={})
    enriched = MagicMock()
    service._enrich_goal_data = AsyncMock(return_value=enriched)

    result = await service.submit_goal(goal_id, "draft", context)

    assert result is enriched
    assert service.supervisor_review_repo.delete.await_count == 0
    service.goal_repo.update_goal_status.assert_awaited_once_with(goal_id, GoalStatus.DRAFT, org_id)
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_withdraw_denied_when_user_is_not_goal_owner():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    other_user_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=other_user_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)

    with pytest.raises(PermissionDeniedError):
        await service.submit_goal(goal_id, "draft", context)


@pytest.mark.asyncio
async def test_update_goal_denied_when_goal_is_not_draft():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)

    with pytest.raises(BadRequestError):
        await service.update_goal(goal_id, MagicMock(), context)


@pytest.mark.asyncio
async def test_update_goal_denied_when_user_is_not_owner():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    other_user_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=other_user_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "draft"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)

    with pytest.raises(PermissionDeniedError):
        await service.update_goal(goal_id, MagicMock(), context)


@pytest.mark.asyncio
async def test_delete_goal_denied_when_goal_is_not_draft():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "submitted"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)

    with pytest.raises(BadRequestError):
        await service.delete_goal(goal_id, context)


@pytest.mark.asyncio
async def test_delete_goal_denied_when_user_is_not_owner():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    other_user_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=other_user_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "draft"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)

    with pytest.raises(PermissionDeniedError):
        await service.delete_goal(goal_id, context)


@pytest.mark.asyncio
async def test_delete_goal_allows_owner_when_goal_is_draft():
    session = AsyncMock(spec=AsyncSession)
    service = GoalService(session)

    org_id = "org_test"
    owner_id = uuid4()
    goal_id = uuid4()

    context = _employee_context(user_id=owner_id, org_id=org_id)

    existing_goal = MagicMock()
    existing_goal.id = goal_id
    existing_goal.user_id = owner_id
    existing_goal.status = "draft"

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=existing_goal)
    service.supervisor_review_repo.get_by_goal = AsyncMock(return_value=[])
    service.goal_repo.delete_goal = AsyncMock(return_value=True)

    success = await service.delete_goal(goal_id, context)

    assert success is True
    service.goal_repo.delete_goal.assert_awaited_once_with(goal_id, org_id)
    session.commit.assert_awaited_once()
