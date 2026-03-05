"""
Tests for peer review repository scoping guards.
Pattern: mocked AsyncSession — same as test_core_value_evaluation_repo_scoping.py.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.database.repositories.peer_review_evaluation_repo import PeerReviewEvaluationRepository


@pytest.mark.asyncio
async def test_update_evaluation_rejects_non_draft_status():
    """update_evaluation should reject evaluations that are not in draft status."""
    session = AsyncMock(spec=AsyncSession)
    repo = PeerReviewEvaluationRepository(session)

    eval_id = uuid4()
    org_id = "org_test"

    # Mock _validate_exists to return a submitted evaluation
    submitted_eval = MagicMock()
    submitted_eval.status = "submitted"
    repo._validate_exists = AsyncMock(return_value=submitted_eval)

    with pytest.raises(ValidationError, match="not in draft"):
        await repo.update_evaluation(eval_id, {"comment": "test"}, org_id)


@pytest.mark.asyncio
async def test_update_evaluation_allows_draft_status():
    """update_evaluation should allow updates on draft evaluations."""
    session = AsyncMock(spec=AsyncSession)
    repo = PeerReviewEvaluationRepository(session)

    eval_id = uuid4()
    org_id = "org_test"

    # Mock _validate_exists to return a draft evaluation
    draft_eval = MagicMock()
    draft_eval.status = "draft"
    repo._validate_exists = AsyncMock(return_value=draft_eval)

    # Mock the execute and get_evaluation_by_id for the update path
    session.execute = AsyncMock()
    repo.get_evaluation_by_id = AsyncMock(return_value=draft_eval)

    result = await repo.update_evaluation(eval_id, {"comment": "test"}, org_id)
    assert result is not None
    assert session.execute.await_count == 1


@pytest.mark.asyncio
async def test_submit_evaluation_rejects_non_draft_status():
    """submit_evaluation should reject evaluations that are not in draft status."""
    session = AsyncMock(spec=AsyncSession)
    repo = PeerReviewEvaluationRepository(session)

    eval_id = uuid4()
    org_id = "org_test"

    # Mock _validate_exists to return a submitted evaluation
    submitted_eval = MagicMock()
    submitted_eval.status = "submitted"
    repo._validate_exists = AsyncMock(return_value=submitted_eval)

    with pytest.raises(ValidationError, match="must be draft"):
        await repo.submit_evaluation(eval_id, org_id)


@pytest.mark.asyncio
async def test_submit_evaluation_allows_draft_status():
    """submit_evaluation should transition draft → submitted."""
    session = AsyncMock(spec=AsyncSession)
    repo = PeerReviewEvaluationRepository(session)

    eval_id = uuid4()
    org_id = "org_test"

    # Mock _validate_exists to return a draft evaluation
    draft_eval = MagicMock()
    draft_eval.status = "draft"
    repo._validate_exists = AsyncMock(return_value=draft_eval)

    # Mock the execute and get_evaluation_by_id for the submit path
    session.execute = AsyncMock()
    repo.get_evaluation_by_id = AsyncMock(return_value=draft_eval)

    result = await repo.submit_evaluation(eval_id, org_id)
    assert result is not None
    assert session.execute.await_count == 1
