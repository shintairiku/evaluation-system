from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.comprehensive_evaluation_repo import ComprehensiveEvaluationRepository


@pytest.mark.asyncio
async def test_upsert_manual_decision_uses_safe_fallback_for_missing_double_checker():
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock(
        return_value=SimpleNamespace(
            fetchone=lambda: SimpleNamespace(
                _mapping={
                    "period_id": uuid4(),
                    "decision": "降格",
                    "stage_after": "STAGE3",
                    "level_after": 18,
                    "reason": "manual adjustment",
                    "double_checked_by": None,
                    "applied_by_user_id": uuid4(),
                    "applied_at": "2026-02-27T00:00:00+00:00",
                }
            )
        )
    )
    repo = ComprehensiveEvaluationRepository(session)

    await repo.upsert_manual_decision(
        org_id="org_test",
        period_id=uuid4(),
        user_id=uuid4(),
        decision="降格",
        stage_after="STAGE3",
        level_after=18,
        reason="manual adjustment",
        double_checked_by=None,
        applied_by_user_id=uuid4(),
    )

    _, params = session.execute.await_args.args
    assert params["double_checked_by"] == ""
