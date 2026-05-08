"""
Tests for `_create_draft_from_rejected_goal` in SupervisorReviewService.

Covers the rejection-side replacement-draft creation that the frontend exercises
via POST /supervisor-reviews/{id}/submit (action=REJECTED). Specifically:

(a) Creates a replacement draft when none exists.
(b) Idempotent: when a replacement already exists for the same `previous_goal_id`,
    the create call is skipped (no duplicate).
(c) Graceful swallow: when the underlying create call fails, the exception is
    not propagated — preserves the supervisor's ability to reject even if the
    follow-up draft creation hits a transient error.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.goal import GoalStatus
from app.services.supervisor_review_service import SupervisorReviewService


def _make_rejected_goal(*, goal_id, owner_id, period_id, category="業績目標", weight=50.0):
    goal = MagicMock()
    goal.id = goal_id
    goal.user_id = owner_id
    goal.period_id = period_id
    goal.status = GoalStatus.REJECTED.value
    goal.goal_category = category
    goal.target_data = {
        "title": "test",
        "performance_goal_type": "quantitative",
        "specific_goal_text": "spec",
        "achievement_criteria_text": "crit",
        "means_methods_text": "means",
    }
    goal.weight = weight
    return goal


@pytest.mark.asyncio
async def test_create_draft_from_rejected_goal_creates_replacement_when_none_exists():
    session = AsyncMock(spec=AsyncSession)
    service = SupervisorReviewService(session)

    org_id = "org_test"
    rejected_goal_id = uuid4()
    owner_id = uuid4()
    period_id = uuid4()
    rejected_goal = _make_rejected_goal(
        goal_id=rejected_goal_id, owner_id=owner_id, period_id=period_id
    )

    new_draft = MagicMock()
    new_draft.id = uuid4()

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=rejected_goal)
    service.goal_repo.get_replacement_draft_by_previous_goal_id = AsyncMock(return_value=None)
    service.goal_repo.create_goal_from_model = AsyncMock(return_value=new_draft)

    await service._create_draft_from_rejected_goal(rejected_goal_id, org_id)

    service.goal_repo.get_replacement_draft_by_previous_goal_id.assert_awaited_once_with(
        rejected_goal_id, org_id
    )
    service.goal_repo.create_goal_from_model.assert_awaited_once()
    create_kwargs = service.goal_repo.create_goal_from_model.await_args.kwargs
    assert create_kwargs["previous_goal_id"] == rejected_goal_id
    assert create_kwargs["status"] == GoalStatus.DRAFT
    assert create_kwargs["user_id"] == owner_id
    assert create_kwargs["period_id"] == period_id


@pytest.mark.asyncio
async def test_create_draft_from_rejected_goal_is_idempotent_when_replacement_exists():
    """Regression: prevent the orphan-draft bug from going the other way (duplicate replacements on retry)."""
    session = AsyncMock(spec=AsyncSession)
    service = SupervisorReviewService(session)

    org_id = "org_test"
    rejected_goal_id = uuid4()
    rejected_goal = _make_rejected_goal(
        goal_id=rejected_goal_id, owner_id=uuid4(), period_id=uuid4()
    )

    existing_replacement = MagicMock()
    existing_replacement.id = uuid4()

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=rejected_goal)
    service.goal_repo.get_replacement_draft_by_previous_goal_id = AsyncMock(
        return_value=existing_replacement
    )
    service.goal_repo.create_goal_from_model = AsyncMock()

    await service._create_draft_from_rejected_goal(rejected_goal_id, org_id)

    service.goal_repo.get_replacement_draft_by_previous_goal_id.assert_awaited_once_with(
        rejected_goal_id, org_id
    )
    assert service.goal_repo.create_goal_from_model.await_count == 0


@pytest.mark.asyncio
async def test_create_draft_from_rejected_goal_swallows_errors_gracefully():
    """The supervisor's rejection must succeed even if replacement-draft creation raises."""
    session = AsyncMock(spec=AsyncSession)
    service = SupervisorReviewService(session)

    org_id = "org_test"
    rejected_goal_id = uuid4()
    rejected_goal = _make_rejected_goal(
        goal_id=rejected_goal_id, owner_id=uuid4(), period_id=uuid4()
    )

    service.goal_repo.get_goal_by_id = AsyncMock(return_value=rejected_goal)
    service.goal_repo.get_replacement_draft_by_previous_goal_id = AsyncMock(return_value=None)
    service.goal_repo.create_goal_from_model = AsyncMock(side_effect=RuntimeError("simulated failure"))

    # Should NOT raise.
    await service._create_draft_from_rejected_goal(rejected_goal_id, org_id)

    service.goal_repo.create_goal_from_model.assert_awaited_once()
