import pytest
from unittest.mock import AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.database.repositories.goal_repo import GoalRepository


def test_validate_status_transition_allows_approved_to_rejected():
    session = AsyncMock(spec=AsyncSession)
    repo = GoalRepository(session)

    repo._validate_status_transition("approved", "rejected")


def test_validate_status_transition_still_blocks_approved_to_draft():
    session = AsyncMock(spec=AsyncSession)
    repo = GoalRepository(session)

    with pytest.raises(ValidationError):
        repo._validate_status_transition("approved", "draft")

