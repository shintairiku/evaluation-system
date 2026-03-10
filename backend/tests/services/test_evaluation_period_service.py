from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.database.models.evaluation import EvaluationPeriodStatus
from app.schemas.evaluation import EvaluationPeriodCreate, EvaluationPeriodType
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.services.evaluation_period_service import EvaluationPeriodService


def _admin_context(*, org_id: str) -> AuthContext:
    return AuthContext(
        user_id=uuid4(),
        roles=[RoleInfo(id=1, name="admin", description="Administrator role")],
        organization_id=org_id,
        role_permission_overrides={"admin": {Permission.EVALUATION_MANAGE}},
    )


def _period_create_payload() -> EvaluationPeriodCreate:
    return EvaluationPeriodCreate(
        name="FY2026 H1",
        period_type=EvaluationPeriodType.HALF_TERM,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 6, 30),
        goal_submission_deadline=date(2026, 6, 15),
        evaluation_deadline=date(2026, 7, 15),
    )


@pytest.mark.asyncio
async def test_create_allows_duplicate_period_name_and_date_range():
    session = AsyncMock(spec=AsyncSession)
    service = EvaluationPeriodService(session)

    org_id = "org_test"
    context = _admin_context(org_id=org_id)
    period_data = _period_create_payload()

    service.evaluation_period_repo.check_name_exists = AsyncMock(return_value=True)
    service.evaluation_period_repo.check_date_overlap = AsyncMock(return_value=True)

    created_period = SimpleNamespace(
        id=uuid4(),
        name=period_data.name,
        period_type=period_data.period_type,
        start_date=period_data.start_date,
        end_date=period_data.end_date,
        goal_submission_deadline=period_data.goal_submission_deadline,
        evaluation_deadline=period_data.evaluation_deadline,
        status=period_data.status,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    service.evaluation_period_repo.create_evaluation_period = AsyncMock(return_value=created_period)

    with patch("app.services.evaluation_period_service.ComprehensiveEvaluationService") as mock_comprehensive_service:
        comprehensive_instance = mock_comprehensive_service.return_value
        comprehensive_instance.ensure_period_default_assignment_seeded = AsyncMock()

        result = await service.create_evaluation_period(context, period_data)

    assert result.name == period_data.name
    service.evaluation_period_repo.create_evaluation_period.assert_awaited_once_with(period_data, org_id)
    assert service.evaluation_period_repo.check_name_exists.await_count == 0
    assert service.evaluation_period_repo.check_date_overlap.await_count == 0
    comprehensive_instance.ensure_period_default_assignment_seeded.assert_awaited_once_with(
        org_id=org_id,
        period_id=created_period.id,
    )
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_seeds_comprehensive_default_assignment():
    session = AsyncMock(spec=AsyncSession)
    service = EvaluationPeriodService(session)

    org_id = "org_test"
    context = _admin_context(org_id=org_id)
    period_data = _period_create_payload()

    created_period = SimpleNamespace(
        id=uuid4(),
        name=period_data.name,
        period_type=period_data.period_type,
        start_date=period_data.start_date,
        end_date=period_data.end_date,
        goal_submission_deadline=period_data.goal_submission_deadline,
        evaluation_deadline=period_data.evaluation_deadline,
        status=period_data.status,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    service.evaluation_period_repo.create_evaluation_period = AsyncMock(return_value=created_period)

    with patch("app.services.evaluation_period_service.ComprehensiveEvaluationService") as mock_comprehensive_service:
        comprehensive_instance = mock_comprehensive_service.return_value
        comprehensive_instance.ensure_period_default_assignment_seeded = AsyncMock()

        await service.create_evaluation_period(context, period_data)

        comprehensive_instance.ensure_period_default_assignment_seeded.assert_awaited_once_with(
            org_id=org_id,
            period_id=created_period.id,
        )


@pytest.mark.asyncio
async def test_create_still_rejects_evaluation_deadline_before_period_end():
    session = AsyncMock(spec=AsyncSession)
    service = EvaluationPeriodService(session)

    period_data = _period_create_payload().model_copy(update={"evaluation_deadline": date(2026, 6, 1)})

    with pytest.raises(BadRequestError, match="Evaluation deadline should not be before the period end date"):
        await service._validate_period_creation(period_data, org_id="org_test")


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [EvaluationPeriodStatus.DRAFT, EvaluationPeriodStatus.COMPLETED])
async def test_delete_validation_allows_draft_and_completed(status: EvaluationPeriodStatus):
    session = AsyncMock(spec=AsyncSession)
    service = EvaluationPeriodService(session)

    period = SimpleNamespace(status=status)

    await service._validate_period_deletion(period)


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [EvaluationPeriodStatus.ACTIVE, EvaluationPeriodStatus.CANCELLED])
async def test_delete_validation_rejects_active_and_cancelled(status: EvaluationPeriodStatus):
    session = AsyncMock(spec=AsyncSession)
    service = EvaluationPeriodService(session)

    period = SimpleNamespace(status=status)

    with pytest.raises(BadRequestError, match=f"Cannot delete {status} evaluation period"):
        await service._validate_period_deletion(period)
