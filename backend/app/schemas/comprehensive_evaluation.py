from datetime import datetime
from typing import Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


EvaluationRank = Literal["SS", "S", "A+", "A", "A-", "B", "C", "D"]
EmploymentType = Literal["employee", "parttime"]
ProcessingStatus = Literal["processed", "unprocessed"]
ComprehensiveDecision = Literal["昇格", "降格", "対象外"]
HistoryOperation = Literal["UPSERT", "CLEAR"]
ConditionField = Literal["overallRank", "competencyFinalRank", "coreValueFinalRank"]
EvaluationPeriodLifecycleStatus = Literal["draft", "active", "completed", "cancelled"]


class PromotionRuleCondition(BaseModel):
    type: Literal["rank_at_least"]
    field: ConditionField
    minimum_rank: EvaluationRank = Field(..., alias="minimumRank")

    model_config = {"populate_by_name": True}


class DemotionRuleCondition(BaseModel):
    type: Literal["rank_at_or_worse"]
    field: ConditionField
    threshold_rank: EvaluationRank = Field(..., alias="thresholdRank")

    model_config = {"populate_by_name": True}


class PromotionRuleGroup(BaseModel):
    id: str
    conditions: List[PromotionRuleCondition]


class DemotionRuleGroup(BaseModel):
    id: str
    conditions: List[DemotionRuleCondition]


class PromotionRuleSettings(BaseModel):
    rule_groups: List[PromotionRuleGroup] = Field(default_factory=list, alias="ruleGroups")

    model_config = {"populate_by_name": True}


class DemotionRuleSettings(BaseModel):
    rule_groups: List[DemotionRuleGroup] = Field(default_factory=list, alias="ruleGroups")

    model_config = {"populate_by_name": True}


class ComprehensiveEvaluationSettings(BaseModel):
    promotion: PromotionRuleSettings
    demotion: DemotionRuleSettings
    overall_score_thresholds: Dict[EvaluationRank, float] = Field(..., alias="overallScoreThresholds")
    level_delta_by_overall_rank: Dict[EvaluationRank, int] = Field(..., alias="levelDeltaByOverallRank")

    model_config = {"populate_by_name": True}


class ComprehensiveEvaluationComputedState(BaseModel):
    total_score: Optional[float] = Field(None, alias="totalScore")
    overall_rank: Optional[EvaluationRank] = Field(None, alias="overallRank")
    decision: ComprehensiveDecision
    promotion_flag: bool = Field(..., alias="promotionFlag")
    demotion_flag: bool = Field(..., alias="demotionFlag")
    stage_delta: int = Field(..., alias="stageDelta")
    level_delta: Optional[int] = Field(None, alias="levelDelta")
    new_stage: Optional[str] = Field(None, alias="newStage")
    new_level: Optional[int] = Field(None, alias="newLevel")
    is_promotion_candidate: bool = Field(..., alias="isPromotionCandidate")
    is_demotion_candidate: bool = Field(..., alias="isDemotionCandidate")

    model_config = {"populate_by_name": True}


class ComprehensiveManualDecisionResponse(BaseModel):
    period_id: UUID = Field(..., alias="periodId")
    decision: ComprehensiveDecision
    stage_after: Optional[str] = Field(None, alias="stageAfter")
    level_after: Optional[int] = Field(None, alias="levelAfter")
    reason: str
    double_checked_by: str = Field(..., alias="doubleCheckedBy")
    applied_by_user_id: UUID = Field(..., alias="appliedByUserId")
    applied_at: datetime = Field(..., alias="appliedAt")

    model_config = {"populate_by_name": True}


class ComprehensiveEvaluationRow(BaseModel):
    id: str
    user_id: UUID = Field(..., alias="userId")
    evaluation_period_id: UUID = Field(..., alias="evaluationPeriodId")

    employee_code: str = Field(..., alias="employeeCode")
    name: str
    department_name: Optional[str] = Field(None, alias="departmentName")
    employment_type: EmploymentType = Field(..., alias="employmentType")
    processing_status: ProcessingStatus = Field(..., alias="processingStatus")

    performance_final_rank: Optional[EvaluationRank] = Field(None, alias="performanceFinalRank")
    performance_weight_percent: Optional[float] = Field(None, alias="performanceWeightPercent")
    performance_score: Optional[float] = Field(None, alias="performanceScore")

    competency_final_rank: Optional[EvaluationRank] = Field(None, alias="competencyFinalRank")
    competency_weight_percent: Optional[float] = Field(None, alias="competencyWeightPercent")
    competency_score: Optional[float] = Field(None, alias="competencyScore")

    core_value_final_rank: Optional[EvaluationRank] = Field(None, alias="coreValueFinalRank")

    leader_interview_cleared: Optional[bool] = Field(None, alias="leaderInterviewCleared")
    division_head_presentation_cleared: Optional[bool] = Field(None, alias="divisionHeadPresentationCleared")
    ceo_interview_cleared: Optional[bool] = Field(None, alias="ceoInterviewCleared")

    current_stage: Optional[str] = Field(None, alias="currentStage")
    current_level: Optional[int] = Field(None, alias="currentLevel")

    auto: ComprehensiveEvaluationComputedState
    applied: ComprehensiveEvaluationComputedState
    manual_decision: Optional[ComprehensiveManualDecisionResponse] = Field(None, alias="manualDecision")

    model_config = {"populate_by_name": True}


class ComprehensiveEvaluationListMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int


class ComprehensiveEvaluationListResponse(BaseModel):
    rows: List[ComprehensiveEvaluationRow]
    meta: ComprehensiveEvaluationListMeta


class ComprehensiveEvaluationFinalizeRequest(BaseModel):
    period_id: UUID = Field(..., alias="periodId")

    model_config = {"populate_by_name": True}


class ComprehensiveEvaluationFinalizeResponse(BaseModel):
    period_id: UUID = Field(..., alias="periodId")
    previous_status: EvaluationPeriodLifecycleStatus = Field(..., alias="previousStatus")
    current_status: EvaluationPeriodLifecycleStatus = Field(..., alias="currentStatus")
    total_users: int = Field(..., alias="totalUsers")
    updated_user_levels: int = Field(..., alias="updatedUserLevels")

    model_config = {"populate_by_name": True}


class ComprehensiveManualDecisionUpsertRequest(BaseModel):
    period_id: UUID = Field(..., alias="periodId")
    decision: ComprehensiveDecision
    stage_after: Optional[str] = Field(None, alias="stageAfter")
    level_after: Optional[int] = Field(None, alias="levelAfter", ge=1, le=30)
    reason: str = Field(..., min_length=1)
    double_checked_by: str = Field(..., alias="doubleCheckedBy", min_length=1)

    @model_validator(mode="after")
    def _validate_required_fields(self):
        if self.decision != "対象外":
            if not self.stage_after or not self.stage_after.strip():
                raise ValueError("stageAfter is required when decision is not 対象外")
        return self

    model_config = {"populate_by_name": True}


class ComprehensiveManualDecisionHistoryEntry(BaseModel):
    id: UUID
    period_id: UUID = Field(..., alias="periodId")
    period_name: Optional[str] = Field(None, alias="periodName")
    user_id: UUID = Field(..., alias="userId")
    employee_code: Optional[str] = Field(None, alias="employeeCode")
    user_name: Optional[str] = Field(None, alias="userName")
    operation: HistoryOperation
    decision: Optional[ComprehensiveDecision] = None
    stage_after: Optional[str] = Field(None, alias="stageAfter")
    level_after: Optional[int] = Field(None, alias="levelAfter")
    reason: Optional[str] = None
    double_checked_by: Optional[str] = Field(None, alias="doubleCheckedBy")
    applied_by_user_id: Optional[UUID] = Field(None, alias="appliedByUserId")
    applied_by_user_name: Optional[str] = Field(None, alias="appliedByUserName")
    applied_at: Optional[datetime] = Field(None, alias="appliedAt")
    changed_at: datetime = Field(..., alias="changedAt")

    model_config = {"populate_by_name": True}


class ComprehensiveManualDecisionHistoryResponse(BaseModel):
    items: List[ComprehensiveManualDecisionHistoryEntry]
    meta: ComprehensiveEvaluationListMeta
