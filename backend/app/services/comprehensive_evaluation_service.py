from __future__ import annotations

import logging
from math import ceil
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import BadRequestError, NotFoundError, PermissionDeniedError
from ..database.models.evaluation import EvaluationPeriodStatus
from ..database.repositories.comprehensive_evaluation_repo import ComprehensiveEvaluationRepository
from ..database.repositories.evaluation_period_repo import EvaluationPeriodRepository
from ..database.repositories.stage_repo import StageRepository
from ..database.repositories.user_repo import UserRepository
from ..schemas.comprehensive_evaluation import (
    ComprehensiveDecision,
    ComprehensiveEvaluationComputedState,
    ComprehensiveEvaluationFinalizeResponse,
    ComprehensiveEvaluationListMeta,
    ComprehensiveEvaluationListResponse,
    ComprehensiveEvaluationRow,
    ComprehensiveEvaluationSettings,
    ComprehensiveManualDecisionHistoryEntry,
    ComprehensiveManualDecisionHistoryResponse,
    ComprehensiveManualDecisionResponse,
    ComprehensiveManualDecisionUpsertRequest,
    DemotionRuleGroup,
    EvaluationRank,
    PromotionRuleGroup,
)
from ..security.context import AuthContext


logger = logging.getLogger(__name__)


RANK_ORDER: List[EvaluationRank] = ["SS", "S", "A+", "A", "A-", "B", "C", "D"]
RANK_INDEX: Dict[EvaluationRank, int] = {rank: idx for idx, rank in enumerate(RANK_ORDER)}
DEFAULT_THRESHOLDS: Dict[EvaluationRank, float] = {
    "SS": 6.5,
    "S": 5.5,
    "A+": 4.5,
    "A": 3.7,
    "A-": 2.7,
    "B": 1.7,
    "C": 1.0,
    "D": 0.1,
}
DEFAULT_LEVEL_DELTAS: Dict[EvaluationRank, int] = {
    "SS": 10,
    "S": 8,
    "A+": 6,
    "A": 5,
    "A-": 2,
    "B": 1,
    "C": -5,
    "D": -8,
}
FINALIZE_PAGE_LIMIT = 200
USER_LEVEL_MIN = 1
USER_LEVEL_MAX = 30


class ComprehensiveEvaluationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ComprehensiveEvaluationRepository(session)
        self.period_repo = EvaluationPeriodRepository(session)
        self.stage_repo = StageRepository(session)
        self.user_repo = UserRepository(session)

    async def get_comprehensive_evaluation(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
        department_id: Optional[UUID],
        stage_id: Optional[UUID],
        employment_type: Optional[str],
        search: Optional[str],
        processing_status: Optional[str],
        page: int,
        limit: int,
    ) -> ComprehensiveEvaluationListResponse:
        org_id = self._require_org(context)
        self._require_read_role(context)
        await self._ensure_period_exists(period_id, org_id)

        settings = await self.get_settings(context=context)
        rows_data, total = await self.repo.list_rows(
            org_id=org_id,
            period_id=period_id,
            department_id=department_id,
            stage_id=stage_id,
            employment_type=employment_type,
            search=search,
            processing_status=processing_status,
            page=page,
            limit=limit,
        )

        rows: List[ComprehensiveEvaluationRow] = []
        for item in rows_data:
            performance_score = self._to_optional_float(item.get("performance_score"))
            competency_score = self._to_optional_float(item.get("competency_score"))
            core_value_score = self._to_optional_float(item.get("core_value_score"))
            # Category final rank must be judged by the category's raw score (0-7 scale),
            # not by weighted contribution used for total-score aggregation.
            performance_rank_score = self._to_optional_float(item.get("performance_raw_score"))
            competency_rank_score = self._to_optional_float(item.get("competency_raw_score"))
            core_value_rank_score = self._to_optional_float(item.get("core_value_raw_score"))
            performance_weight = self._to_optional_float(item.get("performance_weight_percent"))
            competency_weight = self._to_optional_float(item.get("competency_weight_percent"))

            if performance_rank_score is None:
                performance_rank_score = performance_score
            if competency_rank_score is None:
                competency_rank_score = competency_score
            if core_value_rank_score is None:
                core_value_rank_score = core_value_score

            performance_rank = self._rank_from_score(performance_rank_score, settings.overall_score_thresholds)
            competency_rank = self._rank_from_score(competency_rank_score, settings.overall_score_thresholds)
            core_value_rank = self._rank_from_score(core_value_rank_score, settings.overall_score_thresholds)

            total_score = (
                round(performance_score + competency_score, 2)
                if performance_score is not None and competency_score is not None
                else None
            )
            overall_rank = self._rank_from_score(total_score, settings.overall_score_thresholds)

            employment = item["employment_type"]
            current_level = item.get("current_level")
            current_stage = item.get("current_stage")

            level_delta = None
            if employment == "employee" and overall_rank is not None:
                level_delta = int(settings.level_delta_by_overall_rank[overall_rank])

            new_level = current_level + level_delta if current_level is not None and level_delta is not None else None
            new_stage = current_stage

            rule_context = {
                "overallRank": overall_rank,
                "competencyFinalRank": competency_rank,
                "coreValueFinalRank": core_value_rank,
            }

            promotion_rule_hit = self._evaluate_promotion_groups(
                settings.promotion.rule_groups,
                rule_context,
            )
            demotion_rule_hit = self._evaluate_demotion_groups(
                settings.demotion.rule_groups,
                rule_context,
            )

            promotion_flag = (
                employment == "employee"
                and new_level is not None
                and new_level >= 30
                and promotion_rule_hit
            )
            demotion_flag = demotion_rule_hit

            auto_decision = self._select_auto_decision(
                promotion_flag=promotion_flag,
                demotion_flag=demotion_flag,
            )

            auto_state = ComprehensiveEvaluationComputedState(
                totalScore=total_score,
                overallRank=overall_rank,
                decision=auto_decision,
                promotionFlag=promotion_flag,
                demotionFlag=demotion_flag,
                stageDelta=0,
                levelDelta=level_delta,
                newStage=new_stage,
                newLevel=new_level,
                isPromotionCandidate=promotion_flag,
                isDemotionCandidate=demotion_flag,
            )

            manual_decision = None
            if item.get("manual_decision"):
                manual_decision = ComprehensiveManualDecisionResponse(
                    periodId=period_id,
                    decision=item["manual_decision"],
                    stageAfter=item.get("manual_stage_after"),
                    levelAfter=item.get("manual_level_after"),
                    reason=item.get("manual_reason") or "",
                    doubleCheckedBy=item.get("manual_double_checked_by"),
                    appliedByUserId=item.get("manual_applied_by_user_id"),
                    appliedAt=item.get("manual_applied_at"),
                )

            applied_state = self._apply_manual_decision(
                auto_state=auto_state,
                manual_decision=manual_decision,
                current_stage=current_stage,
                current_level=current_level,
                employment_type=employment,
            )

            rows.append(
                ComprehensiveEvaluationRow(
                    id=item["id"],
                    userId=item["user_id"],
                    evaluationPeriodId=period_id,
                    employeeCode=item["employee_code"],
                    name=item["name"],
                    departmentName=item.get("department_name"),
                    employmentType=employment,
                    processingStatus=item["processing_status"],
                    performanceFinalRank=performance_rank,
                    performanceWeightPercent=performance_weight,
                    performanceScore=performance_score,
                    competencyFinalRank=competency_rank,
                    competencyWeightPercent=competency_weight,
                    competencyScore=competency_score,
                    coreValueFinalRank=core_value_rank,
                    leaderInterviewCleared=None,
                    divisionHeadPresentationCleared=None,
                    ceoInterviewCleared=None,
                    currentStage=current_stage,
                    currentLevel=current_level,
                    auto=auto_state,
                    applied=applied_state,
                    manualDecision=manual_decision,
                )
            )

        meta = ComprehensiveEvaluationListMeta(
            total=total,
            page=page,
            limit=limit,
            pages=max(1, ceil(total / limit)) if limit > 0 else 1,
        )
        return ComprehensiveEvaluationListResponse(rows=rows, meta=meta)

    async def get_stage_options(self, *, context: AuthContext) -> List[str]:
        org_id = self._require_org(context)
        self._require_read_role(context)

        stage_models = await self.stage_repo.get_all(org_id)
        seen = set()
        stage_names: List[str] = []
        for stage in stage_models:
            name = (stage.name or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            stage_names.append(name)

        return stage_names

    async def get_settings(self, *, context: AuthContext) -> ComprehensiveEvaluationSettings:
        org_id = self._require_org(context)
        self._require_read_role(context)

        rule_data = await self.repo.get_settings_rules(org_id)
        settings = self._build_settings_from_rules(rule_data)
        self._validate_settings(settings)
        return settings

    async def update_settings(
        self,
        *,
        context: AuthContext,
        settings: ComprehensiveEvaluationSettings,
    ) -> ComprehensiveEvaluationSettings:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        self._validate_settings(settings)

        before_settings = await self.get_settings(context=context)
        before_json = before_settings.model_dump(mode="json", by_alias=True)

        overall_rules = self._build_overall_rules_payload(settings)
        promotion_groups = self._build_group_payload(settings.promotion.rule_groups, decision_type="promotion")
        demotion_groups = self._build_group_payload(settings.demotion.rule_groups, decision_type="demotion")

        try:
            await self.repo.replace_settings(
                org_id=org_id,
                overall_rules=overall_rules,
                promotion_groups=promotion_groups,
                demotion_groups=demotion_groups,
            )
            await self.repo.insert_settings_audit(
                org_id=org_id,
                actor_user_id=actor_user_id,
                before_json=before_json,
                after_json=settings.model_dump(mode="json", by_alias=True),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return await self.get_settings(context=context)

    async def finalize_evaluation_period(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
    ) -> ComprehensiveEvaluationFinalizeResponse:
        org_id = self._require_org(context)
        self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(period_id, org_id)
        previous_status = self._get_period_status(period)

        if previous_status == "cancelled":
            raise BadRequestError("Cancelled evaluation periods cannot be finalized")
        if previous_status not in ("active", "completed"):
            raise BadRequestError("Only active evaluation periods can be finalized")

        rows = await self._collect_period_rows_for_finalization(context=context, period_id=period_id)
        level_updates: Dict[UUID, int] = {}

        for row in rows:
            if row.employment_type != "employee":
                continue
            if row.applied.new_level is None:
                continue

            try:
                proposed_level = int(row.applied.new_level)
            except (TypeError, ValueError):
                logger.warning(
                    "Skipping invalid applied new level during finalization: user_id=%s level=%s",
                    row.user_id,
                    row.applied.new_level,
                )
                continue

            next_level = max(USER_LEVEL_MIN, min(USER_LEVEL_MAX, proposed_level))
            if next_level != proposed_level:
                logger.warning(
                    "Clamped out-of-range applied level during finalization: user_id=%s proposed=%s clamped=%s",
                    row.user_id,
                    proposed_level,
                    next_level,
                )

            if row.current_level is not None and row.current_level == next_level:
                continue
            level_updates[row.user_id] = next_level

        try:
            updated_user_ids = await self.user_repo.batch_update_user_levels(org_id, level_updates)
            if previous_status != "completed":
                await self.period_repo.update_status(period_id, EvaluationPeriodStatus.COMPLETED, org_id)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return ComprehensiveEvaluationFinalizeResponse(
            periodId=period_id,
            previousStatus=previous_status,
            currentStatus="completed",
            totalUsers=len(rows),
            updatedUserLevels=len(updated_user_ids),
        )

    async def _collect_period_rows_for_finalization(
        self,
        *,
        context: AuthContext,
        period_id: UUID,
    ) -> List[ComprehensiveEvaluationRow]:
        page = 1
        rows: List[ComprehensiveEvaluationRow] = []

        while True:
            page_result = await self.get_comprehensive_evaluation(
                context=context,
                period_id=period_id,
                department_id=None,
                stage_id=None,
                employment_type=None,
                search=None,
                processing_status=None,
                page=page,
                limit=FINALIZE_PAGE_LIMIT,
            )
            rows.extend(page_result.rows)
            if page >= page_result.meta.pages:
                break
            page += 1

        return rows

    async def upsert_manual_decision(
        self,
        *,
        context: AuthContext,
        user_id: UUID,
        payload: ComprehensiveManualDecisionUpsertRequest,
    ) -> ComprehensiveManualDecisionResponse:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(payload.period_id, org_id)
        self._ensure_period_allows_manual_decision(period)
        user_profile = await self.repo.get_user_employment_profile(org_id=org_id, user_id=user_id)
        if not user_profile:
            raise NotFoundError("Target user not found in this organization")

        reason = payload.reason.strip()
        if not reason:
            raise BadRequestError("reason is required")
        double_checked_by = payload.double_checked_by.strip() if payload.double_checked_by else None

        if payload.decision != "対象外":
            if not payload.stage_after or not payload.stage_after.strip():
                raise BadRequestError("stageAfter is required when decision is not 対象外")

        if payload.level_after is not None and (payload.level_after < 1 or payload.level_after > 30):
            raise BadRequestError("levelAfter must be between 1 and 30")

        stage_after = (
            payload.stage_after.strip()
            if payload.decision != "対象外" and payload.stage_after
            else None
        )
        level_after = (
            payload.level_after
            if payload.decision != "対象外" and user_profile["employment_type"] == "employee"
            else None
        )

        try:
            persisted = await self.repo.upsert_manual_decision(
                org_id=org_id,
                period_id=payload.period_id,
                user_id=user_id,
                decision=payload.decision,
                stage_after=stage_after,
                level_after=level_after,
                reason=reason,
                double_checked_by=double_checked_by,
                applied_by_user_id=actor_user_id,
            )

            await self.repo.insert_manual_decision_history(
                org_id=org_id,
                period_id=payload.period_id,
                user_id=user_id,
                operation="UPSERT",
                decision=persisted.get("decision"),
                stage_after=persisted.get("stage_after"),
                level_after=persisted.get("level_after"),
                reason=persisted.get("reason"),
                double_checked_by=persisted.get("double_checked_by"),
                applied_by_user_id=persisted.get("applied_by_user_id"),
                applied_at=persisted.get("applied_at"),
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return ComprehensiveManualDecisionResponse(
            periodId=persisted["period_id"],
            decision=persisted["decision"],
            stageAfter=persisted.get("stage_after"),
            levelAfter=persisted.get("level_after"),
            reason=persisted.get("reason") or "",
            doubleCheckedBy=persisted.get("double_checked_by"),
            appliedByUserId=persisted["applied_by_user_id"],
            appliedAt=persisted["applied_at"],
        )

    async def clear_manual_decision(
        self,
        *,
        context: AuthContext,
        user_id: UUID,
        period_id: UUID,
    ) -> None:
        org_id = self._require_org(context)
        actor_user_id = self._require_user_id(context)
        self._require_write_role(context)

        period = await self._ensure_period_exists(period_id, org_id)
        self._ensure_period_allows_manual_decision(period)
        user_profile = await self.repo.get_user_employment_profile(org_id=org_id, user_id=user_id)
        if not user_profile:
            raise NotFoundError("Target user not found in this organization")

        existing = await self.repo.get_manual_decision(
            org_id=org_id,
            period_id=period_id,
            user_id=user_id,
        )

        try:
            await self.repo.clear_manual_decision(
                org_id=org_id,
                period_id=period_id,
                user_id=user_id,
            )

            await self.repo.insert_manual_decision_history(
                org_id=org_id,
                period_id=period_id,
                user_id=user_id,
                operation="CLEAR",
                decision=existing.get("decision") if existing else None,
                stage_after=existing.get("stage_after") if existing else None,
                level_after=existing.get("level_after") if existing else None,
                reason=existing.get("reason") if existing else None,
                double_checked_by=existing.get("double_checked_by") if existing else None,
                applied_by_user_id=existing.get("applied_by_user_id") if existing else actor_user_id,
                applied_at=existing.get("applied_at") if existing else None,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

    async def get_manual_decision_history(
        self,
        *,
        context: AuthContext,
        period_id: Optional[UUID],
        page: int,
        limit: int,
    ) -> ComprehensiveManualDecisionHistoryResponse:
        org_id = self._require_org(context)
        self._require_read_role(context)

        if period_id:
            await self._ensure_period_exists(period_id, org_id)

        records, total = await self.repo.list_manual_decision_history(
            org_id=org_id,
            period_id=period_id,
            page=page,
            limit=limit,
        )

        items = [
            ComprehensiveManualDecisionHistoryEntry(
                id=item["id"],
                periodId=item["period_id"],
                periodName=item.get("period_name"),
                userId=item["user_id"],
                employeeCode=item.get("employee_code"),
                userName=item.get("user_name"),
                operation=item["operation"],
                decision=item.get("decision"),
                stageAfter=item.get("stage_after"),
                levelAfter=item.get("level_after"),
                reason=item.get("reason"),
                doubleCheckedBy=item.get("double_checked_by"),
                appliedByUserId=item.get("applied_by_user_id"),
                appliedByUserName=item.get("applied_by_user_name"),
                appliedAt=item.get("applied_at"),
                changedAt=item["changed_at"],
            )
            for item in records
        ]

        meta = ComprehensiveEvaluationListMeta(
            total=total,
            page=page,
            limit=limit,
            pages=max(1, ceil(total / limit)) if limit > 0 else 1,
        )
        return ComprehensiveManualDecisionHistoryResponse(items=items, meta=meta)

    def _build_settings_from_rules(self, rule_data: Dict[str, List[Dict]]) -> ComprehensiveEvaluationSettings:
        overall_rules = sorted(
            rule_data.get("overall_rules", []),
            key=lambda row: int(row["display_order"]),
        )

        threshold_map: Dict[EvaluationRank, float] = {}
        level_delta_map: Dict[EvaluationRank, int] = {}

        for rank in RANK_ORDER:
            matched = next((row for row in overall_rules if row["overall_rank"] == rank), None)
            if matched:
                threshold_map[rank] = float(matched["min_score"])
                level_delta_map[rank] = int(matched["level_delta"])
            else:
                threshold_map[rank] = DEFAULT_THRESHOLDS[rank]
                level_delta_map[rank] = DEFAULT_LEVEL_DELTAS[rank]

        group_rules = rule_data.get("group_rules", [])
        promotion_groups: List[Dict] = []
        demotion_groups: List[Dict] = []

        grouped_map: Dict[Tuple[str, str], Dict] = {}
        for row in group_rules:
            key = (row["decision_type"], str(row["id"]))
            if key not in grouped_map:
                grouped_map[key] = {
                    "id": str(row["id"]),
                    "decision_type": row["decision_type"],
                    "display_order": int(row["display_order"]),
                    "conditions": [],
                }
            grouped_map[key]["conditions"].append(row)

        grouped_values = sorted(grouped_map.values(), key=lambda g: (g["decision_type"], g["display_order"]))
        for group in grouped_values:
            if group["decision_type"] == "promotion":
                promotion_groups.append(
                    {
                        "id": group["id"],
                        "conditions": [
                            {
                                "type": "rank_at_least",
                                "field": condition["field_name"],
                                "minimumRank": condition["threshold_rank"],
                            }
                            for condition in sorted(group["conditions"], key=lambda c: int(c["condition_order"]))
                        ],
                    }
                )
            elif group["decision_type"] == "demotion":
                demotion_groups.append(
                    {
                        "id": group["id"],
                        "conditions": [
                            {
                                "type": "rank_at_or_worse",
                                "field": condition["field_name"],
                                "thresholdRank": condition["threshold_rank"],
                            }
                            for condition in sorted(group["conditions"], key=lambda c: int(c["condition_order"]))
                        ],
                    }
                )

        if len(promotion_groups) == 0:
            promotion_groups = [
                {
                    "id": "promotion-default",
                    "conditions": [
                        {"type": "rank_at_least", "field": "overallRank", "minimumRank": "A+"},
                        {"type": "rank_at_least", "field": "competencyFinalRank", "minimumRank": "A+"},
                        {"type": "rank_at_least", "field": "coreValueFinalRank", "minimumRank": "A+"},
                    ],
                }
            ]

        if len(demotion_groups) == 0:
            demotion_groups = [
                {
                    "id": "demotion-default",
                    "conditions": [
                        {"type": "rank_at_or_worse", "field": "overallRank", "thresholdRank": "D"},
                    ],
                }
            ]

        return ComprehensiveEvaluationSettings(
            promotion={"ruleGroups": promotion_groups},
            demotion={"ruleGroups": demotion_groups},
            overallScoreThresholds=threshold_map,
            levelDeltaByOverallRank=level_delta_map,
        )

    def _validate_settings(self, settings: ComprehensiveEvaluationSettings) -> None:
        missing_thresholds = [rank for rank in RANK_ORDER if rank not in settings.overall_score_thresholds]
        if missing_thresholds:
            raise BadRequestError(f"Missing threshold ranks: {', '.join(missing_thresholds)}")

        missing_deltas = [rank for rank in RANK_ORDER if rank not in settings.level_delta_by_overall_rank]
        if missing_deltas:
            raise BadRequestError(f"Missing level delta ranks: {', '.join(missing_deltas)}")

        threshold_values = [float(settings.overall_score_thresholds[rank]) for rank in RANK_ORDER]
        for i in range(len(threshold_values) - 1):
            if threshold_values[i] <= threshold_values[i + 1]:
                raise BadRequestError("overallScoreThresholds must be strictly descending from SS to D")

        if len(settings.promotion.rule_groups) == 0:
            raise BadRequestError("promotion.ruleGroups must contain at least one group")
        if len(settings.demotion.rule_groups) == 0:
            raise BadRequestError("demotion.ruleGroups must contain at least one group")

        for group in settings.promotion.rule_groups:
            if len(group.conditions) == 0:
                raise BadRequestError("Each promotion rule group must contain at least one condition")

        for group in settings.demotion.rule_groups:
            if len(group.conditions) == 0:
                raise BadRequestError("Each demotion rule group must contain at least one condition")

    def _build_overall_rules_payload(self, settings: ComprehensiveEvaluationSettings) -> List[Dict[str, object]]:
        payload: List[Dict[str, object]] = []

        for idx, rank in enumerate(RANK_ORDER):
            min_score = float(settings.overall_score_thresholds[rank])
            max_score = None if idx == 0 else float(settings.overall_score_thresholds[RANK_ORDER[idx - 1]])
            payload.append(
                {
                    "overall_rank": rank,
                    "min_score": min_score,
                    "max_score": max_score,
                    "level_delta": int(settings.level_delta_by_overall_rank[rank]),
                    "display_order": idx + 1,
                }
            )

        return payload

    def _build_group_payload(self, groups: Sequence, *, decision_type: str) -> List[Dict[str, object]]:
        payload: List[Dict[str, object]] = []

        for group_idx, group in enumerate(groups):
            condition_payload = []
            for condition_idx, condition in enumerate(group.conditions):
                if decision_type == "promotion":
                    threshold_rank = condition.minimum_rank
                    operator = "rank_at_least"
                else:
                    threshold_rank = condition.threshold_rank
                    operator = "rank_at_or_worse"

                condition_payload.append(
                    {
                        "condition_order": condition_idx + 1,
                        "field_name": condition.field,
                        "operator": operator,
                        "threshold_rank": threshold_rank,
                    }
                )

            payload.append(
                {
                    "group_name": f"{decision_type}-group-{group_idx + 1}",
                    "display_order": group_idx + 1,
                    "conditions": condition_payload,
                }
            )

        return payload

    def _evaluate_promotion_groups(
        self,
        groups: Sequence[PromotionRuleGroup],
        values: Dict[str, Optional[EvaluationRank]],
    ) -> bool:
        for group in groups:
            evaluated_count = 0
            all_passed = True
            for condition in group.conditions:
                actual = values.get(condition.field)
                if actual is None:
                    continue

                evaluated_count += 1
                if not self._is_rank_at_least(actual, condition.minimum_rank):
                    all_passed = False
                    break

            if evaluated_count > 0 and all_passed:
                return True
        return False

    def _evaluate_demotion_groups(
        self,
        groups: Sequence[DemotionRuleGroup],
        values: Dict[str, Optional[EvaluationRank]],
    ) -> bool:
        for group in groups:
            evaluated_count = 0
            all_passed = True
            for condition in group.conditions:
                actual = values.get(condition.field)
                if actual is None:
                    continue

                evaluated_count += 1
                if not self._is_rank_at_or_worse(actual, condition.threshold_rank):
                    all_passed = False
                    break

            if evaluated_count > 0 and all_passed:
                return True
        return False

    def _apply_manual_decision(
        self,
        *,
        auto_state: ComprehensiveEvaluationComputedState,
        manual_decision: Optional[ComprehensiveManualDecisionResponse],
        current_stage: Optional[str],
        current_level: Optional[int],
        employment_type: str,
    ) -> ComprehensiveEvaluationComputedState:
        if manual_decision is None:
            return auto_state

        decision = manual_decision.decision
        stage_after = auto_state.new_stage
        level_after = auto_state.new_level

        if decision != "対象外" and manual_decision.stage_after and manual_decision.stage_after.strip():
            stage_after = manual_decision.stage_after.strip()

        if (
            decision != "対象外"
            and employment_type == "employee"
        ):
            if manual_decision.level_after is not None:
                level_after = manual_decision.level_after
            elif current_level is not None:
                level_after = current_level

        stage_delta = self._parse_stage_delta(current_stage, stage_after)
        if current_level is not None and level_after is not None:
            level_delta = level_after - current_level
        else:
            level_delta = auto_state.level_delta

        return ComprehensiveEvaluationComputedState(
            totalScore=auto_state.total_score,
            overallRank=auto_state.overall_rank,
            decision=decision,
            promotionFlag=auto_state.promotion_flag,
            demotionFlag=auto_state.demotion_flag,
            stageDelta=stage_delta,
            levelDelta=level_delta,
            newStage=stage_after,
            newLevel=level_after,
            isPromotionCandidate=auto_state.is_promotion_candidate,
            isDemotionCandidate=auto_state.is_demotion_candidate,
        )

    def _parse_stage_delta(self, current_stage: Optional[str], next_stage: Optional[str]) -> int:
        current = self._parse_stage_number(current_stage)
        nxt = self._parse_stage_number(next_stage)
        if current is None or nxt is None:
            return 0
        return nxt - current

    def _parse_stage_number(self, stage_name: Optional[str]) -> Optional[int]:
        if not stage_name:
            return None

        lowered = stage_name.lower().replace(" ", "")
        if "stage" not in lowered:
            return None

        digits = "".join(ch for ch in lowered if ch.isdigit())
        if not digits:
            return None

        try:
            return int(digits)
        except ValueError:
            return None

    def _select_auto_decision(self, *, promotion_flag: bool, demotion_flag: bool) -> ComprehensiveDecision:
        if promotion_flag and not demotion_flag:
            return "昇格"
        if demotion_flag and not promotion_flag:
            return "降格"
        return "対象外"

    def _rank_from_score(
        self,
        score: Optional[float],
        thresholds: Dict[EvaluationRank, float],
    ) -> Optional[EvaluationRank]:
        if score is None:
            return None

        for rank in RANK_ORDER:
            if score >= float(thresholds[rank]):
                return rank
        return RANK_ORDER[-1]

    def _is_rank_at_least(self, actual: EvaluationRank, minimum: EvaluationRank) -> bool:
        return RANK_INDEX[actual] <= RANK_INDEX[minimum]

    def _is_rank_at_or_worse(self, actual: EvaluationRank, threshold: EvaluationRank) -> bool:
        return RANK_INDEX[actual] >= RANK_INDEX[threshold]

    async def _ensure_period_exists(self, period_id: UUID, org_id: str):
        period = await self.period_repo.get_by_id(period_id, org_id)
        if period is None:
            raise NotFoundError("Evaluation period not found")
        return period

    def _ensure_period_allows_manual_decision(self, period) -> None:
        status = self._get_period_status(period)
        if status == "completed":
            raise BadRequestError("Cannot modify manual decisions after finalization")
        if status == "cancelled":
            raise BadRequestError("Cannot modify manual decisions for cancelled evaluation periods")

    def _get_period_status(self, period) -> str:
        status = getattr(period.status, "value", period.status)
        return str(status).lower()

    def _require_read_role(self, context: AuthContext) -> None:
        if not context.has_any_role(["admin", "eval_admin"]):
            raise PermissionDeniedError("Access denied. Requires admin or eval_admin role")

    def _require_write_role(self, context: AuthContext) -> None:
        if not context.has_role("eval_admin"):
            raise PermissionDeniedError("Access denied. Requires eval_admin role")

    def _require_org(self, context: AuthContext) -> str:
        if not context.organization_id:
            raise PermissionDeniedError("Organization context required")
        return context.organization_id

    def _require_user_id(self, context: AuthContext) -> UUID:
        if not context.user_id:
            raise PermissionDeniedError("Authenticated user is required")
        return context.user_id

    def _to_optional_float(self, value) -> Optional[float]:
        if value is None:
            return None
        return float(value)
