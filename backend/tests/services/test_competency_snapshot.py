"""
Tests for the competency_snapshot fix: competency display/validation read a frozen
snapshot (captured at goal approval) instead of the user's live stage, so historical
results survive a stage change.

Pattern: async with mocked repos/session — same as test_peer_review_validation.py.
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.goal import Goal as GoalModel
from app.services.goal_service import GoalService
from app.services.self_assessment_service import SelfAssessmentService


def _goal_service() -> GoalService:
    return GoalService(AsyncMock(spec=AsyncSession))


def _competency_goal_model(*, target_data: dict, user_id=None) -> SimpleNamespace:
    """Minimal stand-in for the GoalModel attributes read by _enrich_goal_data."""
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id or uuid4(),
        period_id=uuid4(),
        goal_category="コンピテンシー",
        weight=100,
        status="approved",
        approved_by=None,
        approved_at=None,
        previous_goal_id=None,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
        target_data=target_data,
    )


# ============================================================
# Display: _enrich_goal_data prefers the snapshot (the core bug fix)
# ============================================================

@pytest.mark.asyncio
async def test_enrich_prefers_snapshot_over_live_stage():
    a1, a2 = str(uuid4()), str(uuid4())   # Stage A (snapshot / evaluated)
    b1, b2 = str(uuid4()), str(uuid4())   # Stage B (current/live)
    snapshot = {
        "competency_ids": [a1, a2],
        "competency_names": {a1: "A-one", a2: "A-two"},
        "ideal_action_texts": {a1: {"1": "ta"}, a2: {"1": "tb"}},
        "stage_id": str(uuid4()),
    }
    goal = _competency_goal_model(target_data={"action_plan": "x", "competency_snapshot": snapshot})
    # Live stage data (B) — must be IGNORED because a snapshot exists
    stage_data = {
        str(goal.user_id): {
            "competency_ids": [b1, b2],
            "competency_names": {b1: "B-one", b2: "B-two"},
            "ideal_action_texts": {b1: {"1": "x"}, b2: {"1": "y"}},
        }
    }

    svc = _goal_service()
    result = await svc._enrich_goal_data(
        goal, org_id="org", competency_name_map={}, stage_competency_data=stage_data
    )

    ids = [str(i) for i in result.all_stage_competency_ids]
    assert ids == [a1, a2]                       # from the snapshot, NOT Stage B
    assert set(result.all_stage_competency_names.keys()) == {a1, a2}
    assert set(result.all_stage_ideal_action_texts.keys()) == {a1, a2}


@pytest.mark.asyncio
async def test_enrich_falls_back_to_live_stage_without_snapshot():
    b1, b2 = str(uuid4()), str(uuid4())
    goal = _competency_goal_model(target_data={"action_plan": "x"})  # no snapshot
    stage_data = {
        str(goal.user_id): {
            "competency_ids": [b1, b2],
            "competency_names": {b1: "B-one", b2: "B-two"},
            "ideal_action_texts": {b1: {"1": "x"}, b2: {"1": "y"}},
        }
    }
    svc = _goal_service()
    result = await svc._enrich_goal_data(
        goal, org_id="org", competency_name_map={}, stage_competency_data=stage_data
    )
    assert [str(i) for i in result.all_stage_competency_ids] == [b1, b2]  # live stage fallback


# ============================================================
# Write: snapshot captured on approval
# ============================================================

@pytest.mark.asyncio
async def test_snapshot_written_for_competency_goal_on_approval():
    c1, c2 = uuid4(), uuid4()
    goal = SimpleNamespace(
        id=uuid4(), user_id=uuid4(), goal_category="コンピテンシー",
        target_data={"action_plan": "x"},
    )
    svc = _goal_service()
    svc.user_repo.get_user_stage_id = AsyncMock(return_value=uuid4())
    svc.competency_repo.get_by_stage_id = AsyncMock(return_value=[
        SimpleNamespace(id=c1, name="C-one", description={"1": "t", "2": "t"}),
        SimpleNamespace(id=c2, name="C-two", description={"1": "t"}),
    ])
    svc.session.commit = AsyncMock()

    await svc._snapshot_competency_context(goal, "org")

    snap = goal.target_data["competency_snapshot"]
    assert snap["competency_ids"] == [str(c1), str(c2)]
    assert snap["competency_names"] == {str(c1): "C-one", str(c2): "C-two"}
    assert snap["ideal_action_texts"][str(c1)] == {"1": "t", "2": "t"}
    assert goal.target_data["action_plan"] == "x"  # existing keys preserved
    svc.session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_snapshot_is_idempotent_and_skips_non_competency():
    svc = _goal_service()
    svc.user_repo.get_user_stage_id = AsyncMock()
    svc.competency_repo.get_by_stage_id = AsyncMock()

    # already has a snapshot -> no repo calls, untouched
    existing = {"action_plan": "x", "competency_snapshot": {"competency_ids": ["keep"]}}
    g1 = SimpleNamespace(id=uuid4(), user_id=uuid4(), goal_category="コンピテンシー", target_data=existing)
    await svc._snapshot_competency_context(g1, "org")
    assert g1.target_data["competency_snapshot"] == {"competency_ids": ["keep"]}

    # non-competency goal -> no-op
    g2 = SimpleNamespace(id=uuid4(), user_id=uuid4(), goal_category="業績目標", target_data={"title": "t"})
    await svc._snapshot_competency_context(g2, "org")
    assert "competency_snapshot" not in g2.target_data

    svc.user_repo.get_user_stage_id.assert_not_awaited()
    svc.competency_repo.get_by_stage_id.assert_not_awaited()


# ============================================================
# Submit validation: required actions resolved from the snapshot
# ============================================================

@pytest.mark.asyncio
async def test_required_actions_resolved_from_snapshot():
    cid = str(uuid4())
    goal = SimpleNamespace(
        id=uuid4(), user_id=uuid4(),
        target_data={"competency_snapshot": {"ideal_action_texts": {cid: {"1": "t", "2": "t", "3": "t"}}}},
    )
    svc = SelfAssessmentService(AsyncMock(spec=AsyncSession))
    svc.user_repo.get_user_stage_id = AsyncMock()       # must NOT be used when snapshot present
    svc.competency_repo.get_by_stage_id = AsyncMock()

    required = await svc._get_required_competency_actions_for_goal(goal, "org")

    assert required == {cid: ["1", "2", "3"]}
    svc.user_repo.get_user_stage_id.assert_not_awaited()  # snapshot short-circuits the live stage


# ============================================================
# Safety: target_data allowlist accepts competency_snapshot
# ============================================================

def test_target_data_allowlist_accepts_competency_snapshot():
    g = GoalModel.__new__(GoalModel)  # bypass __init__/validators
    # Should NOT raise "Unknown fields ..."
    g._validate_target_data_schema(
        {"action_plan": "x", "competency_snapshot": {"competency_ids": []}},
        "コンピテンシー",
    )


def test_target_data_allowlist_still_rejects_unknown_key():
    g = GoalModel.__new__(GoalModel)
    with pytest.raises(ValueError):
        g._validate_target_data_schema(
            {"action_plan": "x", "totally_unknown": 1},
            "コンピテンシー",
        )
