"""
Tests for PeerReviewService validation rules (assign_reviewers, submit_evaluation).
Pattern: async with mocked repos — same as test_goal_service_submit.py.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError, NotFoundError, PermissionDeniedError
from app.schemas.peer_review import PeerReviewAssignReviewersRequest
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.peer_review_service import PeerReviewService


# ============================================================
# Helpers
# ============================================================

def _admin_context(*, user_id=None, org_id: str = "org_test") -> AuthContext:
    """AuthContext with GOAL_READ_ALL + ASSESSMENT_MANAGE_SELF permissions (admin)."""
    return AuthContext(
        user_id=user_id or uuid4(),
        roles=[RoleInfo(id=1, name="admin", description="Admin role")],
        organization_id=org_id,
        role_permission_overrides={
            "admin": {
                Permission.GOAL_READ_ALL,
                Permission.ASSESSMENT_MANAGE_SELF,
                Permission.ASSESSMENT_READ_ALL,
            }
        },
    )


def _reviewer_context(*, user_id=None, org_id: str = "org_test") -> AuthContext:
    """AuthContext with ASSESSMENT_MANAGE_SELF permission (reviewer/employee)."""
    return AuthContext(
        user_id=user_id or uuid4(),
        roles=[RoleInfo(id=2, name="employee", description="Employee role")],
        organization_id=org_id,
        role_permission_overrides={
            "employee": {Permission.ASSESSMENT_MANAGE_SELF}
        },
    )


def _make_service() -> PeerReviewService:
    session = AsyncMock(spec=AsyncSession)
    return PeerReviewService(session)


# ============================================================
# assign_reviewers validation
# ============================================================

class TestAssignReviewersValidation:

    @pytest.mark.asyncio
    async def test_rejects_zero_reviewers(self):
        service = _make_service()
        reviewee_id = uuid4()
        data = PeerReviewAssignReviewersRequest(reviewer_ids=[])
        context = _admin_context()

        with pytest.raises(ValidationError, match="Exactly 2"):
            await service.assign_reviewers(context, uuid4(), reviewee_id, data)

    @pytest.mark.asyncio
    async def test_rejects_one_reviewer(self):
        service = _make_service()
        reviewee_id = uuid4()
        data = PeerReviewAssignReviewersRequest(reviewer_ids=[uuid4()])
        context = _admin_context()

        with pytest.raises(ValidationError, match="Exactly 2"):
            await service.assign_reviewers(context, uuid4(), reviewee_id, data)

    @pytest.mark.asyncio
    async def test_rejects_three_reviewers(self):
        service = _make_service()
        reviewee_id = uuid4()
        data = PeerReviewAssignReviewersRequest(reviewer_ids=[uuid4(), uuid4(), uuid4()])
        context = _admin_context()

        with pytest.raises(ValidationError, match="Exactly 2"):
            await service.assign_reviewers(context, uuid4(), reviewee_id, data)

    @pytest.mark.asyncio
    async def test_rejects_duplicate_reviewer_ids(self):
        service = _make_service()
        reviewee_id = uuid4()
        dup_id = uuid4()
        data = PeerReviewAssignReviewersRequest(reviewer_ids=[dup_id, dup_id])
        context = _admin_context()

        with pytest.raises(ValidationError, match="Duplicate"):
            await service.assign_reviewers(context, uuid4(), reviewee_id, data)

    @pytest.mark.asyncio
    async def test_rejects_self_assign(self):
        service = _make_service()
        reviewee_id = uuid4()
        data = PeerReviewAssignReviewersRequest(reviewer_ids=[reviewee_id, uuid4()])
        context = _admin_context()

        with pytest.raises(ValidationError, match="cannot review themselves"):
            await service.assign_reviewers(context, uuid4(), reviewee_id, data)

    @pytest.mark.asyncio
    async def test_valid_assignment_reaches_repo_calls(self):
        """Valid 2 unique non-self reviewers should pass validation and reach repo delete."""
        service = _make_service()
        reviewee_id = uuid4()
        reviewer1 = uuid4()
        reviewer2 = uuid4()
        period_id = uuid4()
        data = PeerReviewAssignReviewersRequest(reviewer_ids=[reviewer1, reviewer2])
        context = _admin_context()

        # Mock only delete — it's called after all validation passes
        service.assignment_repo.delete_assignments_for_reviewee = AsyncMock()
        # create_assignment will raise to stop execution after validation
        service.assignment_repo.create_assignment = AsyncMock(
            side_effect=Exception("stop after validation")
        )

        with pytest.raises(Exception, match="stop after validation"):
            await service.assign_reviewers(context, period_id, reviewee_id, data)

        # Confirms validation passed: delete was called, then create was attempted
        assert service.assignment_repo.delete_assignments_for_reviewee.await_count == 1
        assert service.assignment_repo.create_assignment.await_count == 1


# ============================================================
# submit_evaluation validation
# ============================================================

class TestSubmitEvaluationValidation:

    def _make_9_definitions(self):
        """Create 9 mock core value definitions."""
        defs = []
        for i in range(9):
            d = MagicMock()
            d.id = uuid4()
            defs.append(d)
        return defs

    def _make_existing_eval(self, *, reviewer_id, scores=None, comment=None):
        """Create a mock existing evaluation with proper attributes for Pydantic."""
        from datetime import datetime, timezone

        ev = MagicMock()
        ev.id = uuid4()
        ev.assignment_id = uuid4()
        ev.period_id = uuid4()
        ev.reviewee_id = uuid4()
        ev.reviewee_name = "Test Reviewee"
        ev.reviewer_id = reviewer_id
        ev.scores = scores
        ev.comment = comment
        ev.status = "draft"
        ev.submitted_at = None
        ev.created_at = datetime.now(timezone.utc)
        ev.updated_at = datetime.now(timezone.utc)
        # Relationship
        reviewee = MagicMock()
        reviewee.name = "Test Reviewee"
        ev.reviewee = reviewee
        return ev

    @pytest.mark.asyncio
    async def test_not_found_raises_error(self):
        service = _make_service()
        context = _reviewer_context()
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.submit_evaluation(context, uuid4())

    @pytest.mark.asyncio
    async def test_wrong_reviewer_raises_permission_denied(self):
        service = _make_service()
        reviewer_id = uuid4()
        other_user_id = uuid4()
        context = _reviewer_context(user_id=other_user_id)

        existing = self._make_existing_eval(reviewer_id=reviewer_id)
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=existing)

        with pytest.raises(PermissionDeniedError, match="only submit your own"):
            await service.submit_evaluation(context, uuid4())

    @pytest.mark.asyncio
    async def test_missing_scores_entirely(self):
        service = _make_service()
        reviewer_id = uuid4()
        context = _reviewer_context(user_id=reviewer_id)

        existing = self._make_existing_eval(reviewer_id=reviewer_id, scores=None, comment="Some comment")
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=existing)
        service.cv_definition_repo.get_definitions = AsyncMock(return_value=self._make_9_definitions())

        with pytest.raises(ValidationError, match="scores are required"):
            await service.submit_evaluation(context, uuid4())

    @pytest.mark.asyncio
    async def test_partial_scores_rejected(self):
        service = _make_service()
        reviewer_id = uuid4()
        context = _reviewer_context(user_id=reviewer_id)

        definitions = self._make_9_definitions()
        # Only provide 5 out of 9 scores
        partial_scores = {str(d.id): "A" for d in definitions[:5]}

        existing = self._make_existing_eval(reviewer_id=reviewer_id, scores=partial_scores, comment="Some comment")
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=existing)
        service.cv_definition_repo.get_definitions = AsyncMock(return_value=definitions)

        with pytest.raises(ValidationError, match="Missing scores"):
            await service.submit_evaluation(context, uuid4())

    @pytest.mark.asyncio
    async def test_missing_comment(self):
        service = _make_service()
        reviewer_id = uuid4()
        context = _reviewer_context(user_id=reviewer_id)

        definitions = self._make_9_definitions()
        full_scores = {str(d.id): "A" for d in definitions}

        existing = self._make_existing_eval(reviewer_id=reviewer_id, scores=full_scores, comment=None)
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=existing)
        service.cv_definition_repo.get_definitions = AsyncMock(return_value=definitions)

        with pytest.raises(ValidationError, match="comment is required"):
            await service.submit_evaluation(context, uuid4())

    @pytest.mark.asyncio
    async def test_whitespace_only_comment_rejected(self):
        service = _make_service()
        reviewer_id = uuid4()
        context = _reviewer_context(user_id=reviewer_id)

        definitions = self._make_9_definitions()
        full_scores = {str(d.id): "A" for d in definitions}

        existing = self._make_existing_eval(reviewer_id=reviewer_id, scores=full_scores, comment="   ")
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=existing)
        service.cv_definition_repo.get_definitions = AsyncMock(return_value=definitions)

        with pytest.raises(ValidationError, match="comment is required"):
            await service.submit_evaluation(context, uuid4())

    @pytest.mark.asyncio
    async def test_valid_submission_reaches_repo_submit(self):
        """All 9 scores + non-empty comment → validation passes, repo submit is called."""
        service = _make_service()
        reviewer_id = uuid4()
        eval_id = uuid4()
        context = _reviewer_context(user_id=reviewer_id)

        definitions = self._make_9_definitions()
        full_scores = {str(d.id): "A" for d in definitions}

        existing = self._make_existing_eval(
            reviewer_id=reviewer_id, scores=full_scores, comment="Good work"
        )
        service.evaluation_repo.get_evaluation_by_id = AsyncMock(return_value=existing)
        service.cv_definition_repo.get_definitions = AsyncMock(return_value=definitions)

        # submit_evaluation will raise to stop execution after validation
        service.evaluation_repo.submit_evaluation = AsyncMock(
            side_effect=Exception("stop after validation")
        )

        with pytest.raises(Exception, match="stop after validation"):
            await service.submit_evaluation(context, eval_id)

        # Confirms all validation passed: repo submit was called
        assert service.evaluation_repo.submit_evaluation.await_count == 1
