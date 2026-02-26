from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.core.exceptions import BadRequestError, PermissionDeniedError
from app.database.models.evaluation import EvaluationPeriodStatus
from app.schemas.comprehensive_evaluation import (
    ComprehensiveEvaluationComputedState,
    ComprehensiveEvaluationSettings,
    ComprehensiveManualDecisionUpsertRequest,
    ComprehensiveManualDecisionResponse,
    DemotionRuleCondition,
    DemotionRuleGroup,
    DemotionRuleSettings,
    PromotionRuleCondition,
    PromotionRuleGroup,
    PromotionRuleSettings,
)
from app.security.context import AuthContext, RoleInfo
from app.services.comprehensive_evaluation_service import ComprehensiveEvaluationService


def build_settings() -> ComprehensiveEvaluationSettings:
    return ComprehensiveEvaluationSettings(
        promotion=PromotionRuleSettings(
            ruleGroups=[
                PromotionRuleGroup(
                    id="promotion-group-1",
                    conditions=[
                        PromotionRuleCondition(
                            type="rank_at_least",
                            field="overallRank",
                            minimumRank="A+",
                        ),
                        PromotionRuleCondition(
                            type="rank_at_least",
                            field="competencyFinalRank",
                            minimumRank="A+",
                        ),
                        PromotionRuleCondition(
                            type="rank_at_least",
                            field="coreValueFinalRank",
                            minimumRank="A+",
                        ),
                    ],
                )
            ]
        ),
        demotion=DemotionRuleSettings(
            ruleGroups=[
                DemotionRuleGroup(
                    id="demotion-group-1",
                    conditions=[
                        DemotionRuleCondition(
                            type="rank_at_or_worse",
                            field="overallRank",
                            thresholdRank="D",
                        )
                    ],
                )
            ]
        ),
        overallScoreThresholds={
            "SS": 6.5,
            "S": 5.5,
            "A+": 4.5,
            "A": 3.7,
            "A-": 2.7,
            "B": 1.7,
            "C": 1.0,
            "D": 0.1,
        },
        levelDeltaByOverallRank={
            "SS": 10,
            "S": 8,
            "A+": 6,
            "A": 5,
            "A-": 2,
            "B": 1,
            "C": -5,
            "D": -8,
        },
    )


def make_context(*, role_name: str) -> AuthContext:
    return AuthContext(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        roles=[RoleInfo(id=1, name=role_name, description="")],
        organization_id="org_test",
        organization_slug="test-org",
    )


def test_promotion_groups_ignore_unknown_fields_but_require_evaluated_condition():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()

    # coreValueFinalRank is unknown (None), but other evaluated conditions pass.
    result = service._evaluate_promotion_groups(
        settings.promotion.rule_groups,
        {
            "overallRank": "A+",
            "competencyFinalRank": "A+",
            "coreValueFinalRank": None,
        },
    )

    assert result is True


def test_demotion_groups_require_at_least_one_evaluated_condition():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()

    # No condition can be evaluated -> group must fail by spec.
    result = service._evaluate_demotion_groups(
        settings.demotion.rule_groups,
        {
            "overallRank": None,
            "competencyFinalRank": None,
            "coreValueFinalRank": None,
        },
    )

    assert result is False


def test_apply_manual_decision_overrides_applied_state_for_employee():
    service = ComprehensiveEvaluationService(AsyncMock())

    auto_state = ComprehensiveEvaluationComputedState(
        totalScore=5.2,
        overallRank="A+",
        decision="昇格",
        promotionFlag=True,
        demotionFlag=False,
        stageDelta=0,
        levelDelta=6,
        newStage="STAGE4",
        newLevel=26,
        isPromotionCandidate=True,
        isDemotionCandidate=False,
    )
    manual = ComprehensiveManualDecisionResponse(
        periodId=uuid4(),
        decision="降格",
        stageAfter="STAGE3",
        levelAfter=18,
        reason="manual adjustment",
        doubleCheckedBy="HR checker",
        appliedByUserId=uuid4(),
        appliedAt="2026-02-20T00:00:00+00:00",
    )

    applied = service._apply_manual_decision(
        auto_state=auto_state,
        manual_decision=manual,
        current_stage="STAGE4",
        current_level=20,
        employment_type="employee",
    )

    assert applied.decision == "降格"
    assert applied.new_stage == "STAGE3"
    assert applied.new_level == 18
    assert applied.stage_delta == -1
    assert applied.level_delta == -2


def test_validate_settings_rejects_non_descending_thresholds():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()
    settings.overall_score_thresholds["S"] = 7.0  # invalid: S > SS

    with pytest.raises(BadRequestError):
        service._validate_settings(settings)


def test_rank_from_score_returns_lowest_rank_for_zero_score():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()

    result = service._rank_from_score(0.0, settings.overall_score_thresholds)

    assert result == "D"


def test_require_write_role_denies_non_eval_admin():
    service = ComprehensiveEvaluationService(AsyncMock())
    admin_context = make_context(role_name="admin")

    with pytest.raises(PermissionDeniedError):
        service._require_write_role(admin_context)


@pytest.mark.asyncio
async def test_category_rank_uses_raw_score_not_weighted_contribution():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()
    period_id = uuid4()
    user_id = uuid4()

    service.get_settings = AsyncMock(return_value=settings)
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_id}",
                    "user_id": user_id,
                    "employee_code": "E001",
                    "name": "Test User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 10,
                    # Weighted contribution scores (for total)
                    "performance_score": 4.40,
                    "competency_score": 0.52,
                    "core_value_score": None,
                    # Raw category scores (for category final ranks)
                    "performance_raw_score": 4.40,
                    "competency_raw_score": 5.20,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                }
            ],
            1,
        )
    )

    result = await service.get_comprehensive_evaluation(
        context=make_context(role_name="admin"),
        period_id=period_id,
        department_id=None,
        stage_id=None,
        employment_type=None,
        search=None,
        processing_status=None,
        page=1,
        limit=200,
    )

    row = result.rows[0]
    # Regression: competency rank must be based on raw 5.20 (=> A+), not weighted 0.52 (=> D).
    assert row.competency_final_rank == "A+"
    assert row.competency_score == pytest.approx(0.52)
    assert row.auto.total_score == pytest.approx(4.92)


@pytest.mark.asyncio
async def test_upsert_manual_decision_rejects_completed_period():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))

    payload = ComprehensiveManualDecisionUpsertRequest(
        periodId=period_id,
        decision="昇格",
        stageAfter="STAGE4",
        levelAfter=20,
        reason="manual adjustment",
        doubleCheckedBy="HR checker",
    )

    with pytest.raises(BadRequestError, match="finalization"):
        await service.upsert_manual_decision(
            context=make_context(role_name="eval_admin"),
            user_id=uuid4(),
            payload=payload,
        )


@pytest.mark.asyncio
async def test_finalize_period_updates_levels_and_marks_completed():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()
    employee_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="active"))
    service.get_comprehensive_evaluation = AsyncMock(
        return_value=SimpleNamespace(
            rows=[
                SimpleNamespace(
                    user_id=employee_id,
                    employment_type="employee",
                    current_level=20,
                    applied=SimpleNamespace(new_level=23),
                ),
                SimpleNamespace(
                    user_id=uuid4(),
                    employment_type="employee",
                    current_level=15,
                    applied=SimpleNamespace(new_level=15),
                ),
                SimpleNamespace(
                    user_id=uuid4(),
                    employment_type="parttime",
                    current_level=None,
                    applied=SimpleNamespace(new_level=30),
                ),
            ],
            meta=SimpleNamespace(pages=1),
        )
    )
    service.user_repo.batch_update_user_levels = AsyncMock(return_value={employee_id})
    service.period_repo.update_status = AsyncMock(return_value=SimpleNamespace(status="completed"))

    result = await service.finalize_evaluation_period(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
    )

    service.user_repo.batch_update_user_levels.assert_awaited_once_with(
        "org_test",
        {employee_id: 23},
    )
    service.period_repo.update_status.assert_awaited_once_with(
        period_id,
        EvaluationPeriodStatus.COMPLETED,
        "org_test",
    )
    session.commit.assert_awaited_once()
    assert result.previous_status == "active"
    assert result.current_status == "completed"
    assert result.updated_user_levels == 1
    assert result.total_users == 3


@pytest.mark.asyncio
async def test_finalize_period_is_idempotent_when_already_completed():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))
    service.get_comprehensive_evaluation = AsyncMock(
        return_value=SimpleNamespace(rows=[], meta=SimpleNamespace(pages=1))
    )
    service.user_repo.batch_update_user_levels = AsyncMock(return_value=set())
    service.period_repo.update_status = AsyncMock()

    result = await service.finalize_evaluation_period(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
    )

    service.period_repo.update_status.assert_not_awaited()
    assert result.previous_status == "completed"
    assert result.current_status == "completed"
    assert result.updated_user_levels == 0
