from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


class BucketBreakdown(BaseModel):
    bucket: str
    weight: float
    avg_score: float = Field(..., alias="avgScore")
    contribution: float

    class Config:
        populate_by_name = True


class StageWeights(BaseModel):
    quantitative: float = 0
    qualitative: float = 0
    competency: float = 0


class SelfAssessmentDraftEntry(BaseModel):
    goal_id: UUID = Field(..., alias="goalId")
    bucket: str
    rating_code: Optional[str] = Field(None, alias="ratingCode")
    comment: Optional[str] = None

    class Config:
        populate_by_name = True


class SelfAssessmentContext(BaseModel):
    goals: List[Dict[str, Any]]
    draft: Optional[List[SelfAssessmentDraftEntry]] = None
    stage_weights: StageWeights = Field(..., alias="stageWeights")
    thresholds: List[Dict[str, Any]]
    summary: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True


class SelfAssessmentSummary(BaseModel):
    stage_weights: StageWeights = Field(..., alias="stageWeights")
    per_bucket: List[BucketBreakdown] = Field(..., alias="perBucket")
    weighted_total: float = Field(..., alias="weightedTotal")
    final_rating: str = Field(..., alias="finalRating")
    flags: Dict[str, Any]
    level_adjustment_preview: Optional[Dict[str, Any]] = Field(None, alias="levelAdjustmentPreview")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")

    class Config:
        populate_by_name = True
