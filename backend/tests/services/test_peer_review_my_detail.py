"""
Tests for PeerReviewService.get_my_evaluation_detail (reviewee's own results view).

Critical behavior under test:
- The result is scoped to the caller (self-only).
- Peer reviewer identity is NEVER exposed in the comment labels (anonymized),
  even though the underlying assignments carry reviewer names.

Pattern: async with mocked repos — same as test_peer_review_validation.py.
"""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.peer_review_service import PeerReviewService


def _employee_context(*, user_id=None, org_id: str = "org_test") -> AuthContext:
    """AuthContext with ASSESSMENT_READ_SELF permission (employee)."""
    return AuthContext(
        user_id=user_id or uuid4(),
        roles=[RoleInfo(id=2, name="employee", description="Employee role")],
        organization_id=org_id,
        role_permission_overrides={
            "employee": {Permission.ASSESSMENT_READ_SELF}
        },
    )


def _make_service() -> PeerReviewService:
    session = AsyncMock(spec=AsyncSession)
    return PeerReviewService(session)


@pytest.mark.asyncio
async def test_get_my_evaluation_detail_anonymizes_peers_and_is_self_scoped():
    me = uuid4()
    peer1_id = uuid4()
    peer2_id = uuid4()
    def_id = uuid4()
    context = _employee_context(user_id=me)

    service = _make_service()

    # User (self) — no supervisor relations, minimal fields used by the builder
    user = SimpleNamespace(
        id=me,
        name="自分",
        department=None,
        job_title=None,
        supervisor_relations=[],
    )

    # One core value definition
    definition = SimpleNamespace(id=def_id, name="チームワーク")

    # Self core value evaluation + joinloaded supervisor feedback
    feedback = SimpleNamespace(status="submitted", scores={str(def_id): "S"}, comment="上長コメント")
    cv_eval = SimpleNamespace(
        status="submitted",
        scores={str(def_id): "A"},
        comment="自己コメント",
        feedback=feedback,
    )

    # Two submitted peer evaluations with identifiable comments
    peer1_eval = SimpleNamespace(reviewer_id=peer1_id, scores={str(def_id): "A+"}, comment="ピア1のコメント")
    peer2_eval = SimpleNamespace(reviewer_id=peer2_id, scores={str(def_id): "B"}, comment="ピア2のコメント")

    # Assignments carry reviewer names that must NOT leak
    assignment1 = SimpleNamespace(
        reviewer_id=peer1_id,
        reviewer=SimpleNamespace(name="田中太郎"),
        created_at=datetime(2026, 1, 1),
    )
    assignment2 = SimpleNamespace(
        reviewer_id=peer2_id,
        reviewer=SimpleNamespace(name="鈴木花子"),
        created_at=datetime(2026, 1, 2),
    )

    service.user_repo.get_user_by_id_with_details = AsyncMock(return_value=user)
    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(name="2026上期", status="completed"))
    service.cv_definition_repo.get_definitions = AsyncMock(return_value=[definition])
    service.cv_evaluation_repo.get_evaluation = AsyncMock(return_value=cv_eval)
    service.evaluation_repo.get_submitted_evaluations_for_reviewee = AsyncMock(
        return_value=[peer1_eval, peer2_eval]
    )
    service.assignment_repo.get_assignments_for_reviewee = AsyncMock(
        return_value=[assignment1, assignment2]
    )

    result = await service.get_my_evaluation_detail(context, uuid4())

    # Self-scoped: the repos were queried with the caller's own id
    service.user_repo.get_user_by_id_with_details.assert_awaited_once()
    assert service.user_repo.get_user_by_id_with_details.await_args.args[0] == me
    assert result.user_id == me

    # Grid keeps the per-peer ratings (anonymous columns)
    assert len(result.core_values) == 1
    cv = result.core_values[0]
    assert cv.peer1_rating == "A+"
    assert cv.peer2_rating == "B"

    # Peer comment labels NEVER contain reviewer names
    peer_comments = [c for c in result.comments if c.source_type in ("peer1", "peer2")]
    assert len(peer_comments) == 2
    for c in peer_comments:
        assert "田中太郎" not in c.source_label
        assert "鈴木花子" not in c.source_label
    labels = {c.source_type: c.source_label for c in peer_comments}
    assert labels["peer1"] == "同僚評価①"
    assert labels["peer2"] == "同僚評価②"


@pytest.mark.asyncio
async def test_get_my_evaluation_detail_average_excludes_self():
    """平均/総合平均 use the 3 others (peers + supervisor), excluding self."""
    me = uuid4()
    peer1_id = uuid4()
    peer2_id = uuid4()
    def_id = uuid4()
    context = _employee_context(user_id=me)
    service = _make_service()

    user = SimpleNamespace(id=me, name="自分", department=None, job_title=None, supervisor_relations=[])
    definition = SimpleNamespace(id=def_id, name="チームワーク")

    # self=SS(7); the 3 others all C(1). Exclude self → avg 1.0 → C. Include self → 2.5 → B.
    feedback = SimpleNamespace(status="submitted", scores={str(def_id): "C"}, comment="")
    cv_eval = SimpleNamespace(status="submitted", scores={str(def_id): "SS"}, comment="", feedback=feedback)
    peer1_eval = SimpleNamespace(reviewer_id=peer1_id, scores={str(def_id): "C"}, comment="")
    peer2_eval = SimpleNamespace(reviewer_id=peer2_id, scores={str(def_id): "C"}, comment="")
    assignment1 = SimpleNamespace(reviewer_id=peer1_id, reviewer=SimpleNamespace(name="x"), created_at=datetime(2026, 1, 1))
    assignment2 = SimpleNamespace(reviewer_id=peer2_id, reviewer=SimpleNamespace(name="y"), created_at=datetime(2026, 1, 2))

    service.user_repo.get_user_by_id_with_details = AsyncMock(return_value=user)
    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(name="P", status="completed"))
    service.cv_definition_repo.get_definitions = AsyncMock(return_value=[definition])
    service.cv_evaluation_repo.get_evaluation = AsyncMock(return_value=cv_eval)
    service.evaluation_repo.get_submitted_evaluations_for_reviewee = AsyncMock(return_value=[peer1_eval, peer2_eval])
    service.assignment_repo.get_assignments_for_reviewee = AsyncMock(return_value=[assignment1, assignment2])

    result = await service.get_my_evaluation_detail(context, uuid4())

    # Per-row 平均 excludes self → C (not B)
    assert result.core_values[0].average_rating == "C"
    # 総合平均 excludes self → C
    assert result.overall_rating == "C"
    # Self column is still shown for reference (SS)
    assert result.self_avg_rating == "SS"


@pytest.mark.asyncio
async def test_get_my_evaluation_detail_blocked_before_finalization():
    """Detail is withheld (403) until the evaluation period is finalized (completed)."""
    me = uuid4()
    context = _employee_context(user_id=me)
    service = _make_service()
    # Period is still active → must be blocked before building anything.
    service.period_repo.get_by_id = AsyncMock(
        return_value=SimpleNamespace(name="進行中", status="active")
    )

    with pytest.raises(PermissionDeniedError):
        await service.get_my_evaluation_detail(context, uuid4())
