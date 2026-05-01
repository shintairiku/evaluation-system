from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.core.exceptions import BadRequestError, PermissionDeniedError
from app.database.models.evaluation import EvaluationPeriodStatus
from app.schemas.comprehensive_evaluation import (
    ComprehensiveDefaultAssignmentUpdateRequest,
    ComprehensiveEvaluationComputedState,
    ComprehensiveEvaluationExportRequest,
    ComprehensiveEvaluationRow,
    ComprehensiveEvaluationSettings,
    ComprehensiveManualDecisionUpsertRequest,
    ComprehensiveManualDecisionResponse,
    ComprehensiveStageAssignmentUpdateRequest,
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


def test_promotion_groups_fail_when_a_required_rank_is_unknown():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()

    result = service._evaluate_promotion_groups(
        settings.promotion.rule_groups,
        {
            "overallRank": "A+",
            "performanceFinalRank": "A+",
            "competencyFinalRank": "A+",
            "coreValueFinalRank": None,
        },
    )

    assert result is False


def test_promotion_groups_support_performance_final_rank():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()
    settings.promotion.rule_groups[0].conditions = [
        PromotionRuleCondition(
            type="rank_at_least",
            field="performanceFinalRank",
            minimumRank="A+",
        )
    ]

    result = service._evaluate_promotion_groups(
        settings.promotion.rule_groups,
        {
            "overallRank": "B",
            "performanceFinalRank": "A+",
            "competencyFinalRank": "B",
            "coreValueFinalRank": "B",
        },
    )

    assert result is True


def test_demotion_groups_require_at_least_one_evaluated_condition():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()

    result = service._evaluate_demotion_groups(
        settings.demotion.rule_groups,
        {
            "overallRank": None,
            "performanceFinalRank": None,
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


def test_apply_manual_decision_defaults_level_to_current_when_omitted():
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
        decision="昇格",
        stageAfter="STAGE5",
        reason="stage change only",
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

    assert applied.new_stage == "STAGE5"
    assert applied.new_level == 20
    assert applied.level_delta == 0


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
async def test_get_comprehensive_evaluation_candidate_view_denies_admin():
    service = ComprehensiveEvaluationService(AsyncMock())

    with pytest.raises(PermissionDeniedError, match="eval_admin"):
        await service.get_comprehensive_evaluation(
            context=make_context(role_name="admin"),
            period_id=uuid4(),
            department_id=None,
            stage_id=None,
            employment_type=None,
            search=None,
            processing_status=None,
            page=1,
            limit=200,
            candidate_view=True,
        )


@pytest.mark.asyncio
async def test_export_comprehensive_evaluation_csv_denies_admin():
    service = ComprehensiveEvaluationService(AsyncMock())

    with pytest.raises(PermissionDeniedError, match="eval_admin"):
        await service.export_comprehensive_evaluation_csv(
            context=make_context(role_name="admin"),
            payload=ComprehensiveEvaluationExportRequest(
                periodId=uuid4(),
                columns=["employeeCode"],
            ),
        )


@pytest.mark.asyncio
async def test_export_comprehensive_evaluation_csv_formats_selected_columns():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()
    user_id = uuid4()

    service.get_comprehensive_evaluation = AsyncMock(
        return_value=SimpleNamespace(
            rows=[
                ComprehensiveEvaluationRow(
                    id=f"{period_id}:{user_id}",
                    userId=user_id,
                    evaluationPeriodId=period_id,
                    employeeCode="E001",
                    name="Export User",
                    departmentName="Engineering",
                    employmentType="employee",
                    processingStatus="processed",
                    performanceFinalRank="A+",
                    performanceWeightPercent=100,
                    performanceScore=4.5,
                    competencyFinalRank="A",
                    competencyWeightPercent=30,
                    competencyScore=0.42,
                    coreValueFinalRank=None,
                    leaderInterviewCleared=None,
                    divisionHeadPresentationCleared=None,
                    ceoInterviewCleared=None,
                    currentStage="STAGE4",
                    currentLevel=24,
                    auto=ComprehensiveEvaluationComputedState(
                        totalScore=4.92,
                        overallRank="A+",
                        decision="昇格",
                        promotionFlag=True,
                        demotionFlag=False,
                        stageDelta=0,
                        levelDelta=6,
                        newStage="STAGE4",
                        newLevel=30,
                        isPromotionCandidate=True,
                        isDemotionCandidate=False,
                    ),
                    applied=ComprehensiveEvaluationComputedState(
                        totalScore=4.92,
                        overallRank="A+",
                        decision="昇格",
                        promotionFlag=True,
                        demotionFlag=False,
                        stageDelta=1,
                        levelDelta=6,
                        newStage="STAGE5",
                        newLevel=30,
                        isPromotionCandidate=True,
                        isDemotionCandidate=False,
                    ),
                    manualDecision=ComprehensiveManualDecisionResponse(
                        periodId=period_id,
                        decision="昇格",
                        stageAfter="STAGE5",
                        levelAfter=30,
                        reason="manual adjustment",
                        appliedByUserId=uuid4(),
                        appliedAt="2026-03-01T00:00:00+00:00",
                    ),
                )
            ],
            meta=SimpleNamespace(total=1),
        )
    )
    service.period_repo.get_by_id = AsyncMock(return_value=object())

    csv_text = await service.export_comprehensive_evaluation_csv(
        context=make_context(role_name="eval_admin"),
        payload=ComprehensiveEvaluationExportRequest(
            periodId=period_id,
            departmentName="Engineering",
            stageName="STAGE4",
            columns=[
                "employeeCode",
                "employmentType",
                "currentLevel",
                "totalScore",
                "newLevel",
                "promotionDemotionFlag",
                "processingStatus",
            ],
        ),
    )

    assert csv_text == (
        "社員番号,雇用形態,現在レベル,合計（点）,反映後レベル,昇格/降格フラグ,処理状態\r\n"
        "E001,正社員,24,4.92,30,昇格（手動）,処理済\r\n"
    )
    service.get_comprehensive_evaluation.assert_awaited_once()


@pytest.mark.asyncio
async def test_category_rank_uses_raw_score_not_weighted_contribution():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()
    period_id = uuid4()
    user_id = uuid4()

    service._get_period_settings_map = AsyncMock(return_value=(settings, {}, {}))
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_id}",
                    "user_id": user_id,
                    "department_id": None,
                    "employee_code": "E001",
                    "name": "Test User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 10,
                    # Legacy weighted contribution scores (kept for backward compat)
                    "performance_score": 4.40,
                    "competency_score": 0.52,
                    "core_value_score": None,
                    # MBO total on 0-100 scale (spec section 4-4)
                    "mbo_total_100": 70.0,
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
    # competencyScore now holds the raw 0-7 score (not weighted contribution)
    assert row.competency_score == pytest.approx(5.20)
    # MBO rank from mbo_total_100=70 → "S", comp rank "A+"
    # total = S(6)*10/11 + A+(5)*1/11 = 5.909... → round 5.91
    assert row.performance_final_rank == "S"
    assert row.auto.total_score == pytest.approx(5.91)


@pytest.mark.asyncio
async def test_promotion_flag_uses_rule_hit_even_when_new_level_is_below_30():
    service = ComprehensiveEvaluationService(AsyncMock())
    settings = build_settings()
    period_id = uuid4()
    user_id = uuid4()

    service._get_period_settings_map = AsyncMock(return_value=(settings, {}, {}))
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_id}",
                    "user_id": user_id,
                    "department_id": None,
                    "stage_id": uuid4(),
                    "employee_code": "E001",
                    "name": "Level Ten User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 10,
                    "performance_score": 4.5,
                    "competency_score": 0.2,
                    "core_value_score": None,
                    "mbo_total_100": 64.0,
                    "performance_raw_score": 4.5,
                    "competency_raw_score": 4.7,
                    "core_value_raw_score": 4.7,
                    "current_stage": "STAGE4",
                    "current_level": 10,
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

    # mbo_total_100=64 → A+, comp_raw=4.7 → A+, cv_raw=4.7 → A+
    # total = A+(5)*10/11 + A+(5)*1/11 = 5.0 → A+, level delta +6
    assert row.auto.overall_rank == "A+"
    assert row.auto.total_score == pytest.approx(5.0)
    assert row.auto.new_level == 16
    assert row.auto.promotion_flag is True
    assert row.auto.decision == "昇格"


@pytest.mark.asyncio
async def test_department_override_uses_department_specific_settings():
    service = ComprehensiveEvaluationService(AsyncMock())
    default_settings = build_settings()
    override_settings = build_settings()
    period_id = uuid4()
    override_department_id = uuid4()
    user_a = uuid4()
    user_b = uuid4()

    override_settings.level_delta_by_overall_rank["A+"] = 42

    service._get_period_settings_map = AsyncMock(
        return_value=(default_settings, {override_department_id: override_settings}, {})
    )
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_a}",
                    "user_id": user_a,
                    "department_id": override_department_id,
                    "stage_id": uuid4(),
                    "employee_code": "E001",
                    "name": "Override User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 0,
                    "performance_score": 4.92,
                    "performance_raw_score": 4.92,
                    "mbo_total_100": 64.0,
                    "competency_score": 0.0,
                    "competency_raw_score": 0.0,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                },
                {
                    "id": f"{period_id}:{user_b}",
                    "user_id": user_b,
                    "department_id": uuid4(),
                    "stage_id": uuid4(),
                    "employee_code": "E002",
                    "name": "Default User",
                    "department_name": "Sales",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 0,
                    "performance_score": 4.92,
                    "performance_raw_score": 4.92,
                    "mbo_total_100": 64.0,
                    "competency_score": 0.0,
                    "competency_raw_score": 0.0,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                },
            ],
            2,
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

    assert result.rows[0].auto.new_level == 62
    assert result.rows[1].auto.new_level == 26


@pytest.mark.asyncio
async def test_same_department_can_use_different_settings_across_periods():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_a = uuid4()
    period_b = uuid4()
    department_id = uuid4()
    user_id = uuid4()
    default_settings = build_settings()
    period_b_settings = build_settings()
    period_b_settings.level_delta_by_overall_rank["A+"] = 15

    service._get_period_settings_map = AsyncMock(
        side_effect=[
            (default_settings, {department_id: default_settings}, {}),
            (default_settings, {department_id: period_b_settings}, {}),
        ]
    )
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_a}:{user_id}",
                    "user_id": user_id,
                    "department_id": department_id,
                    "stage_id": uuid4(),
                    "employee_code": "E001",
                    "name": "Period User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 0,
                    "performance_score": 4.92,
                    "performance_raw_score": 4.92,
                    "mbo_total_100": 64.0,
                    "competency_score": 0.0,
                    "competency_raw_score": 0.0,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                }
            ],
            1,
        )
    )

    first = await service.get_comprehensive_evaluation(
        context=make_context(role_name="admin"),
        period_id=period_a,
        department_id=None,
        stage_id=None,
        employment_type=None,
        search=None,
        processing_status=None,
        page=1,
        limit=200,
    )
    second = await service.get_comprehensive_evaluation(
        context=make_context(role_name="admin"),
        period_id=period_b,
        department_id=None,
        stage_id=None,
        employment_type=None,
        search=None,
        processing_status=None,
        page=1,
        limit=200,
    )

    assert first.rows[0].auto.new_level == 26
    assert second.rows[0].auto.new_level == 35


@pytest.mark.asyncio
async def test_stage_override_uses_stage_specific_settings():
    service = ComprehensiveEvaluationService(AsyncMock())
    default_settings = build_settings()
    override_settings = build_settings()
    period_id = uuid4()
    override_stage_id = uuid4()
    user_a = uuid4()
    user_b = uuid4()

    override_settings.level_delta_by_overall_rank["A+"] = 18

    service._get_period_settings_map = AsyncMock(
        return_value=(default_settings, {}, {override_stage_id: override_settings})
    )
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_a}",
                    "user_id": user_a,
                    "department_id": None,
                    "stage_id": override_stage_id,
                    "employee_code": "E010",
                    "name": "Stage Override User",
                    "department_name": None,
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 0,
                    "performance_score": 4.92,
                    "performance_raw_score": 4.92,
                    "mbo_total_100": 64.0,
                    "competency_score": 0.0,
                    "competency_raw_score": 0.0,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                },
                {
                    "id": f"{period_id}:{user_b}",
                    "user_id": user_b,
                    "department_id": None,
                    "stage_id": uuid4(),
                    "employee_code": "E011",
                    "name": "Stage Default User",
                    "department_name": None,
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 0,
                    "performance_score": 4.92,
                    "performance_raw_score": 4.92,
                    "mbo_total_100": 64.0,
                    "competency_score": 0.0,
                    "competency_raw_score": 0.0,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                },
            ],
            2,
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

    assert result.rows[0].auto.new_level == 38
    assert result.rows[1].auto.new_level == 26


@pytest.mark.asyncio
async def test_department_override_takes_precedence_over_stage_override():
    service = ComprehensiveEvaluationService(AsyncMock())
    default_settings = build_settings()
    stage_settings = build_settings()
    department_settings = build_settings()
    period_id = uuid4()
    stage_id = uuid4()
    department_id = uuid4()
    user_id = uuid4()

    stage_settings.level_delta_by_overall_rank["A+"] = 14
    department_settings.level_delta_by_overall_rank["A+"] = 21

    service._get_period_settings_map = AsyncMock(
        return_value=(
            default_settings,
            {department_id: department_settings},
            {stage_id: stage_settings},
        )
    )
    service.period_repo.get_by_id = AsyncMock(return_value=object())
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_id}",
                    "user_id": user_id,
                    "department_id": department_id,
                    "stage_id": stage_id,
                    "employee_code": "E012",
                    "name": "Priority User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "processed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 0,
                    "performance_score": 4.92,
                    "performance_raw_score": 4.92,
                    "mbo_total_100": 64.0,
                    "competency_score": 0.0,
                    "competency_raw_score": 0.0,
                    "core_value_score": None,
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

    assert result.rows[0].auto.new_level == 41


@pytest.mark.asyncio
async def test_update_default_assignment_rejects_completed_period():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))

    with pytest.raises(BadRequestError, match="completed or cancelled"):
        await service.update_default_assignment(
            context=make_context(role_name="eval_admin"),
            payload=ComprehensiveDefaultAssignmentUpdateRequest(
                periodId=period_id,
                settings=build_settings(),
            ),
        )


@pytest.mark.asyncio
async def test_update_stage_assignment_rejects_completed_period():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))

    with pytest.raises(BadRequestError, match="completed or cancelled"):
        await service.update_stage_assignment(
            context=make_context(role_name="eval_admin"),
            stage_id=uuid4(),
            payload=ComprehensiveStageAssignmentUpdateRequest(
                periodId=period_id,
                settings=build_settings(),
            ),
        )


@pytest.mark.asyncio
async def test_upsert_manual_decision_rejects_cancelled_period():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="cancelled"))

    payload = ComprehensiveManualDecisionUpsertRequest(
        periodId=period_id,
        decision="昇格",
        stageAfter="STAGE4",
        reason="manual adjustment",
    )

    with pytest.raises(BadRequestError, match="cancelled"):
        await service.upsert_manual_decision(
            context=make_context(role_name="eval_admin"),
            user_id=uuid4(),
            payload=payload,
        )


@pytest.mark.asyncio
async def test_clear_manual_decision_rejects_cancelled_period():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="cancelled"))

    with pytest.raises(BadRequestError, match="cancelled"):
        await service.clear_manual_decision(
            context=make_context(role_name="eval_admin"),
            user_id=uuid4(),
            period_id=period_id,
        )


@pytest.mark.asyncio
async def test_upsert_manual_decision_rejects_unprocessed_user():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()
    user_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))
    service.repo.is_user_processed = AsyncMock(return_value=False)

    payload = ComprehensiveManualDecisionUpsertRequest(
        periodId=period_id,
        decision="昇格",
        stageAfter="STAGE4",
        reason="manual adjustment",
    )

    with pytest.raises(BadRequestError, match="must be processed"):
        await service.upsert_manual_decision(
            context=make_context(role_name="eval_admin"),
            user_id=user_id,
            payload=payload,
        )


@pytest.mark.asyncio
async def test_clear_manual_decision_rejects_unprocessed_user():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()
    user_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))
    service.repo.is_user_processed = AsyncMock(return_value=False)

    with pytest.raises(BadRequestError, match="must be processed"):
        await service.clear_manual_decision(
            context=make_context(role_name="eval_admin"),
            user_id=user_id,
            period_id=period_id,
        )


@pytest.mark.asyncio
async def test_upsert_manual_decision_rejects_unknown_stage_name():
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()
    user_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))
    service.repo.is_user_processed = AsyncMock(return_value=True)
    service.repo.get_user_employment_profile = AsyncMock(
        return_value={
            "id": user_id,
            "level": 10,
            "stage_name": "STAGE1",
            "employment_type": "employee",
        }
    )
    service.stage_repo.get_by_name = AsyncMock(return_value=None)

    payload = ComprehensiveManualDecisionUpsertRequest(
        periodId=period_id,
        decision="昇格",
        stageAfter="UNKNOWN-STAGE",
        levelAfter=11,
        reason="manual adjustment",
    )

    with pytest.raises(BadRequestError, match="stageAfter"):
        await service.upsert_manual_decision(
            context=make_context(role_name="eval_admin"),
            user_id=user_id,
            payload=payload,
        )


@pytest.mark.asyncio
async def test_upsert_manual_decision_applies_stage_and_level_when_completed():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()
    user_id = uuid4()
    stage_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))
    service.repo.is_user_processed = AsyncMock(return_value=True)
    service.repo.get_user_employment_profile = AsyncMock(
        return_value={
            "id": user_id,
            "level": 10,
            "stage_name": "STAGE1",
            "employment_type": "employee",
        }
    )
    service.stage_repo.get_by_name = AsyncMock(return_value=SimpleNamespace(id=stage_id, name="STAGE2"))
    service.repo.upsert_manual_decision = AsyncMock(
        return_value={
            "period_id": period_id,
            "decision": "昇格",
            "stage_after": "STAGE2",
            "level_after": 12,
            "reason": "manual adjustment",
            "double_checked_by": None,
            "applied_by_user_id": UUID("00000000-0000-0000-0000-000000000001"),
            "applied_at": "2026-03-03T00:00:00+00:00",
        }
    )
    service.repo.insert_manual_decision_history = AsyncMock()
    service.repo.upsert_processing_status = AsyncMock()
    service.user_repo.update_user_stage = AsyncMock(return_value=SimpleNamespace(id=user_id))
    service.user_repo.batch_update_user_levels = AsyncMock(return_value={user_id})

    payload = ComprehensiveManualDecisionUpsertRequest(
        periodId=period_id,
        decision="昇格",
        stageAfter="STAGE2",
        levelAfter=12,
        reason="manual adjustment",
    )

    await service.upsert_manual_decision(
        context=make_context(role_name="eval_admin"),
        user_id=user_id,
        payload=payload,
    )

    service.user_repo.update_user_stage.assert_awaited_once_with(user_id, stage_id, "org_test")
    service.user_repo.batch_update_user_levels.assert_awaited_once_with("org_test", {user_id: 12})
    service.repo.upsert_processing_status.assert_awaited_once()
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_finalize_period_marks_completed_without_bulk_level_updates():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="active"))
    service.get_comprehensive_evaluation = AsyncMock()
    service.user_repo.batch_update_user_levels = AsyncMock()
    service.user_repo.batch_update_user_stages = AsyncMock()
    service.period_repo.update_status = AsyncMock(return_value=SimpleNamespace(status="completed"))

    result = await service.finalize_evaluation_period(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
    )

    service.get_comprehensive_evaluation.assert_not_awaited()
    service.user_repo.batch_update_user_levels.assert_not_awaited()
    service.user_repo.batch_update_user_stages.assert_not_awaited()
    service.period_repo.update_status.assert_awaited_once_with(
        period_id,
        EvaluationPeriodStatus.COMPLETED,
        "org_test",
    )
    session.commit.assert_awaited_once()
    assert result.previous_status == "active"
    assert result.current_status == "completed"
    assert result.updated_user_levels == 0
    assert result.total_users == 0


@pytest.mark.asyncio
async def test_finalize_period_allows_draft_status():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="draft"))
    service.get_comprehensive_evaluation = AsyncMock()
    service.period_repo.update_status = AsyncMock(return_value=SimpleNamespace(status="completed"))

    result = await service.finalize_evaluation_period(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
    )

    service.period_repo.update_status.assert_awaited_once_with(
        period_id,
        EvaluationPeriodStatus.COMPLETED,
        "org_test",
    )
    assert result.previous_status == "draft"
    assert result.current_status == "completed"
    assert result.updated_user_levels == 0


@pytest.mark.asyncio
async def test_finalize_period_is_idempotent_when_already_completed():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="completed"))
    service.get_comprehensive_evaluation = AsyncMock()
    service.period_repo.update_status = AsyncMock()

    result = await service.finalize_evaluation_period(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
    )

    service.period_repo.update_status.assert_not_awaited()
    assert result.previous_status == "completed"
    assert result.current_status == "completed"
    assert result.updated_user_levels == 0


@pytest.mark.asyncio
async def test_process_user_evaluation_applies_computed_level_and_marks_processed():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()
    user_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="active"))
    service._get_period_settings_map = AsyncMock(return_value=(build_settings(), {}, {}))
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
                    "processing_status": "unprocessed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 10,
                    "performance_score": 4.40,
                    "performance_raw_score": 4.40,
                    "mbo_total_100": 70.0,
                    "competency_score": 0.52,
                    "competency_raw_score": 5.20,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 20,
                    "manual_decision": None,
                }
            ],
            1,
        )
    )
    service.user_repo.update_user_stage = AsyncMock()
    service.user_repo.batch_update_user_levels = AsyncMock(return_value={user_id})
    service.repo.upsert_processing_status = AsyncMock()

    result = await service.process_user_evaluation(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
        user_id=user_id,
    )

    # mbo_total_100=70 → S, comp_raw=5.20 → A+
    # total = S(6)*10/11 + A+(5)*1/11 = 5.91 → S, level delta S=+8, 20+8=28
    service.user_repo.batch_update_user_levels.assert_awaited_once_with(
        "org_test",
        {user_id: 28},
    )
    service.user_repo.update_user_stage.assert_not_awaited()
    service.repo.upsert_processing_status.assert_awaited_once_with(
        org_id="org_test",
        period_id=period_id,
        user_id=user_id,
        processed_by_user_id=UUID("00000000-0000-0000-0000-000000000001"),
    )
    assert result.processing_status == "processed"
    assert result.updated_level is True
    assert result.updated_stage is False


@pytest.mark.asyncio
async def test_process_user_evaluation_applies_manual_stage_and_clamped_level():
    session = AsyncMock()
    service = ComprehensiveEvaluationService(session)
    period_id = uuid4()
    user_id = uuid4()
    next_stage_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status="active"))
    service._get_period_settings_map = AsyncMock(return_value=(build_settings(), {}, {}))
    service.repo.list_rows = AsyncMock(
        return_value=(
            [
                {
                    "id": f"{period_id}:{user_id}",
                    "user_id": user_id,
                    "employee_code": "E002",
                    "name": "Manual User",
                    "department_name": "Engineering",
                    "employment_type": "employee",
                    "processing_status": "unprocessed",
                    "performance_weight_percent": 100,
                    "competency_weight_percent": 10,
                    "performance_score": 4.40,
                    "performance_raw_score": 4.40,
                    "mbo_total_100": 70.0,
                    "competency_score": 0.52,
                    "competency_raw_score": 5.20,
                    "core_value_score": None,
                    "core_value_raw_score": None,
                    "current_stage": "STAGE4",
                    "current_level": 29,
                    "manual_decision": "昇格",
                    "manual_stage_after": "STAGE5",
                    "manual_level_after": 40,
                    "manual_reason": "manual",
                    "manual_double_checked_by": None,
                    "manual_applied_by_user_id": UUID("00000000-0000-0000-0000-000000000001"),
                    "manual_applied_at": "2026-03-03T00:00:00+00:00",
                }
            ],
            1,
        )
    )
    service.stage_repo.get_all = AsyncMock(return_value=[SimpleNamespace(id=next_stage_id, name="STAGE5")])
    service.user_repo.update_user_stage = AsyncMock(return_value=SimpleNamespace(id=user_id))
    service.user_repo.batch_update_user_levels = AsyncMock(return_value={user_id})
    service.repo.upsert_processing_status = AsyncMock()

    result = await service.process_user_evaluation(
        context=make_context(role_name="eval_admin"),
        period_id=period_id,
        user_id=user_id,
    )

    service.user_repo.update_user_stage.assert_awaited_once_with(user_id, next_stage_id, "org_test")
    service.user_repo.batch_update_user_levels.assert_awaited_once_with("org_test", {user_id: 30})
    assert result.updated_stage is True
    assert result.updated_level is True


@pytest.mark.asyncio
@pytest.mark.parametrize("period_status", ["completed", "cancelled"])
async def test_process_user_evaluation_rejects_closed_period(period_status: str):
    service = ComprehensiveEvaluationService(AsyncMock())
    period_id = uuid4()

    service.period_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(status=period_status))

    with pytest.raises(BadRequestError, match="completed or cancelled"):
        await service.process_user_evaluation(
            context=make_context(role_name="eval_admin"),
            period_id=period_id,
            user_id=uuid4(),
        )
