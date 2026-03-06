from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.exceptions import BadRequestError
from app.schemas.common import SelfAssessmentStatus
from app.services.self_assessment_service import SelfAssessmentService


@pytest.mark.asyncio
async def test_validate_competency_rating_data_requires_all_stage_actions():
    session = AsyncMock(spec=AsyncSession)
    service = SelfAssessmentService(session)

    org_id = "org_test"
    user_id = uuid4()
    stage_id = uuid4()
    comp_1_id = uuid4()
    comp_2_id = uuid4()

    goal = SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        target_data={
            "selected_ideal_actions": {
                str(comp_1_id): ["1", "2"],
            }
        },
    )

    comp_1 = SimpleNamespace(id=comp_1_id, description={"1": "a", "2": "b"})
    comp_2 = SimpleNamespace(id=comp_2_id, description={"1": "c"})

    service.user_repo.get_user_stage_id = AsyncMock(return_value=stage_id)
    service.competency_repo.get_by_stage_id = AsyncMock(return_value=[comp_1, comp_2])

    # Missing comp_2 action "1"
    rating_data = {
        str(comp_1_id): {"1": "A", "2": "S"},
    }

    with pytest.raises(ValidationError, match="missing 1 item"):
        await service._validate_competency_rating_data_completeness(goal, rating_data, org_id)


@pytest.mark.asyncio
async def test_validate_competency_rating_data_accepts_complete_stage_actions():
    session = AsyncMock(spec=AsyncSession)
    service = SelfAssessmentService(session)

    org_id = "org_test"
    user_id = uuid4()
    stage_id = uuid4()
    comp_1_id = uuid4()
    comp_2_id = uuid4()

    goal = SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        target_data={},
    )

    comp_1 = SimpleNamespace(id=comp_1_id, description={"1": "a", "2": "b"})
    comp_2 = SimpleNamespace(id=comp_2_id, description={"1": "c"})

    service.user_repo.get_user_stage_id = AsyncMock(return_value=stage_id)
    service.competency_repo.get_by_stage_id = AsyncMock(return_value=[comp_1, comp_2])

    rating_data = {
        str(comp_1_id): {"1": "A", "2": "S"},
        str(comp_2_id): {"1": "B"},
    }

    await service._validate_competency_rating_data_completeness(goal, rating_data, org_id)


@pytest.mark.asyncio
async def test_validate_competency_rating_data_falls_back_to_selected_actions_when_stage_missing():
    session = AsyncMock(spec=AsyncSession)
    service = SelfAssessmentService(session)

    org_id = "org_test"
    user_id = uuid4()
    comp_id = uuid4()

    goal = SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        target_data={
            "selected_ideal_actions": {
                str(comp_id): ["1", "2"],
            }
        },
    )

    service.user_repo.get_user_stage_id = AsyncMock(return_value=None)
    service.competency_repo.get_by_stage_id = AsyncMock(return_value=[])

    rating_data = {
        str(comp_id): {"1": "A"},
    }

    with pytest.raises(ValidationError, match="missing 1 item"):
        await service._validate_competency_rating_data_completeness(goal, rating_data, org_id)


@pytest.mark.asyncio
async def test_approve_assessment_requires_approved_supervisor_feedback():
    session = AsyncMock(spec=AsyncSession)
    service = SelfAssessmentService(session)

    assessment_id = uuid4()
    org_id = "org_test"

    assessment = SimpleNamespace(
        id=assessment_id,
        period_id=uuid4(),
        status=SelfAssessmentStatus.SUBMITTED.value,
    )

    pending_feedback = SimpleNamespace(action="PENDING")

    service.self_assessment_repo.get_by_id_with_details = AsyncMock(return_value=assessment)
    service.supervisor_feedback_repo.get_by_self_assessment = AsyncMock(return_value=pending_feedback)
    service.evaluation_period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="active"))
    service.self_assessment_repo.approve_assessment = AsyncMock()

    with pytest.raises(BadRequestError, match="before supervisor feedback is approved"):
        await service.approve_assessment(assessment_id, org_id)

    service.self_assessment_repo.approve_assessment.assert_not_awaited()


@pytest.mark.asyncio
async def test_approve_assessment_allows_when_supervisor_feedback_is_approved():
    session = AsyncMock(spec=AsyncSession)
    service = SelfAssessmentService(session)

    assessment_id = uuid4()
    org_id = "org_test"

    submitted_assessment = SimpleNamespace(
        id=assessment_id,
        period_id=uuid4(),
        status=SelfAssessmentStatus.SUBMITTED.value,
    )
    approved_feedback = SimpleNamespace(action="APPROVED")
    approved_assessment = SimpleNamespace(
        id=assessment_id,
        goal_id=uuid4(),
        period_id=submitted_assessment.period_id,
        self_rating_code=None,
        self_rating=None,
        self_comment=None,
        rating_data={},
        status=SelfAssessmentStatus.APPROVED.value,
        submitted_at=None,
        created_at=None,
        updated_at=None,
    )

    service.self_assessment_repo.get_by_id_with_details = AsyncMock(return_value=submitted_assessment)
    service.supervisor_feedback_repo.get_by_self_assessment = AsyncMock(return_value=approved_feedback)
    service.evaluation_period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="active"))
    service.self_assessment_repo.approve_assessment = AsyncMock(return_value=approved_assessment)
    service._enrich_assessment_data = AsyncMock(return_value=SimpleNamespace(id=assessment_id))

    result = await service.approve_assessment(assessment_id, org_id)

    assert result.id == assessment_id
    service.self_assessment_repo.approve_assessment.assert_awaited_once_with(assessment_id, org_id)
