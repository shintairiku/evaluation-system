"""
Tests for PeerReviewService.bulk_assign_reviewers validation rules.
Pattern: async with mocked repos — same as test_peer_review_validation.py.
"""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.schemas.peer_review import BulkAssignReviewersItem
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.peer_review_service import PeerReviewService


# ============================================================
# Helpers
# ============================================================

def _admin_context(*, user_id=None, org_id: str = "org_test") -> AuthContext:
    """AuthContext with GOAL_READ_ALL permission (admin)."""
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


def _make_service() -> PeerReviewService:
    session = AsyncMock(spec=AsyncSession)
    return PeerReviewService(session)


def _valid_item(*, reviewee_id=None) -> BulkAssignReviewersItem:
    """Create a valid bulk assignment item with 2 unique reviewers."""
    return BulkAssignReviewersItem(
        reviewee_id=reviewee_id or uuid4(),
        reviewer_ids=[uuid4(), uuid4()],
    )


# ============================================================
# bulk_assign_reviewers validation
# ============================================================

class TestBulkAssignReviewersValidation:

    @pytest.mark.asyncio
    async def test_rejects_over_200_items(self):
        service = _make_service()
        context = _admin_context()
        items = [_valid_item() for _ in range(201)]

        with pytest.raises(ValidationError, match="200"):
            await service.bulk_assign_reviewers(context, uuid4(), items)

    @pytest.mark.asyncio
    async def test_duplicate_reviewee_marked_as_failure(self):
        service = _make_service()
        context = _admin_context()
        reviewee_id = uuid4()

        items = [
            BulkAssignReviewersItem(reviewee_id=reviewee_id, reviewer_ids=[uuid4(), uuid4()]),
            BulkAssignReviewersItem(reviewee_id=reviewee_id, reviewer_ids=[uuid4(), uuid4()]),
        ]

        # Mock repo calls for the valid first item
        service.assignment_repo.delete_assignments_for_reviewee = AsyncMock(return_value=0)
        service.assignment_repo.create_assignment = AsyncMock(
            side_effect=lambda **kwargs: type('obj', (object,), {'id': uuid4()})()
        )
        service.evaluation_repo.create_evaluation = AsyncMock()
        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), items)

        assert result.success_count == 1
        assert result.failure_count == 1
        failed = [r for r in result.results if not r.success]
        assert len(failed) == 1
        assert "Duplicate" in failed[0].error

    @pytest.mark.asyncio
    async def test_rejects_wrong_reviewer_count(self):
        service = _make_service()
        context = _admin_context()
        items = [
            BulkAssignReviewersItem(reviewee_id=uuid4(), reviewer_ids=[uuid4()]),
        ]

        # No repo calls expected — validation fails before
        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), items)

        assert result.success_count == 0
        assert result.failure_count == 1
        assert "Exactly 2" in result.results[0].error

    @pytest.mark.asyncio
    async def test_rejects_duplicate_reviewer_ids(self):
        service = _make_service()
        context = _admin_context()
        dup_id = uuid4()
        items = [
            BulkAssignReviewersItem(reviewee_id=uuid4(), reviewer_ids=[dup_id, dup_id]),
        ]

        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), items)

        assert result.failure_count == 1
        assert "Duplicate reviewer" in result.results[0].error

    @pytest.mark.asyncio
    async def test_rejects_self_assign(self):
        service = _make_service()
        context = _admin_context()
        reviewee_id = uuid4()
        items = [
            BulkAssignReviewersItem(reviewee_id=reviewee_id, reviewer_ids=[reviewee_id, uuid4()]),
        ]

        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), items)

        assert result.failure_count == 1
        assert "cannot review themselves" in result.results[0].error

    @pytest.mark.asyncio
    async def test_valid_items_reach_repo_calls(self):
        """Valid items should pass validation and call repo create."""
        service = _make_service()
        context = _admin_context()
        items = [_valid_item(), _valid_item()]

        service.assignment_repo.delete_assignments_for_reviewee = AsyncMock(return_value=0)
        service.assignment_repo.create_assignment = AsyncMock(
            side_effect=lambda **kwargs: type('obj', (object,), {'id': uuid4()})()
        )
        service.evaluation_repo.create_evaluation = AsyncMock()
        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), items)

        assert result.success_count == 2
        assert result.failure_count == 0
        # 2 items × 2 reviewers = 4 assignment creates
        assert service.assignment_repo.create_assignment.await_count == 4
        # 2 items × 2 evaluations = 4 evaluation creates
        assert service.evaluation_repo.create_evaluation.await_count == 4
        assert service.session.commit.await_count == 1

    @pytest.mark.asyncio
    async def test_mixed_valid_and_invalid(self):
        """Mix of valid and invalid items returns correct counts."""
        service = _make_service()
        context = _admin_context()
        reviewee_id = uuid4()

        items = [
            _valid_item(),  # valid
            BulkAssignReviewersItem(reviewee_id=reviewee_id, reviewer_ids=[reviewee_id, uuid4()]),  # self-assign
            _valid_item(),  # valid
        ]

        service.assignment_repo.delete_assignments_for_reviewee = AsyncMock(return_value=0)
        service.assignment_repo.create_assignment = AsyncMock(
            side_effect=lambda **kwargs: type('obj', (object,), {'id': uuid4()})()
        )
        service.evaluation_repo.create_evaluation = AsyncMock()
        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), items)

        assert result.success_count == 2
        assert result.failure_count == 1
        assert len(result.results) == 3

    @pytest.mark.asyncio
    async def test_empty_list_returns_zero_counts(self):
        service = _make_service()
        context = _admin_context()

        service.session.commit = AsyncMock()

        result = await service.bulk_assign_reviewers(context, uuid4(), [])

        assert result.success_count == 0
        assert result.failure_count == 0
        assert len(result.results) == 0
