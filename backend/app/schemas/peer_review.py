from typing import Optional, Dict, List
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


# ============================================================
# Enums
# ============================================================

class PeerReviewStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


# ============================================================
# Assignment schemas
# ============================================================

class PeerReviewAssignReviewersRequest(BaseModel):
    """Request schema for assigning reviewers to a reviewee."""
    reviewer_ids: List[UUID] = Field(
        ...,
        alias="reviewerIds",
        description="List of exactly 2 reviewer user IDs"
    )

    model_config = {"populate_by_name": True}


class PeerReviewAssignmentResponse(BaseModel):
    """Response schema for a single peer review assignment."""
    id: UUID
    period_id: UUID = Field(..., alias="periodId")
    reviewee_id: UUID = Field(..., alias="revieweeId")
    reviewer_id: UUID = Field(..., alias="reviewerId")
    reviewer_name: Optional[str] = Field(None, alias="reviewerName")
    assigned_by: UUID = Field(..., alias="assignedBy")
    evaluation_status: Optional[str] = Field(None, alias="evaluationStatus")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class PeerReviewAssignmentsByReviewee(BaseModel):
    """Grouped assignments by reviewee (admin view)."""
    reviewee_id: UUID = Field(..., alias="revieweeId")
    reviewee_name: str = Field(..., alias="revieweeName")
    department_name: Optional[str] = Field(None, alias="departmentName")
    assignments: List[PeerReviewAssignmentResponse]

    model_config = {"populate_by_name": True}


# ============================================================
# Evaluation schemas
# ============================================================

class PeerReviewEvaluationUpdate(BaseModel):
    """Request schema for auto-save of peer review evaluation."""
    scores: Optional[Dict[str, str]] = Field(
        None,
        description="Map of core value definition ID to rating code (e.g. {'uuid': 'A+'})"
    )
    comment: Optional[str] = Field(
        None,
        max_length=5000,
        description="General comment"
    )

    model_config = {"populate_by_name": True}


class PeerReviewEvaluationResponse(BaseModel):
    """Response schema for peer review evaluation (reviewer view)."""
    id: UUID
    assignment_id: UUID = Field(..., alias="assignmentId")
    period_id: UUID = Field(..., alias="periodId")
    reviewee_id: UUID = Field(..., alias="revieweeId")
    reviewee_name: Optional[str] = Field(None, alias="revieweeName")
    reviewer_id: UUID = Field(..., alias="reviewerId")
    scores: Optional[Dict[str, str]] = None
    comment: Optional[str] = None
    status: PeerReviewStatus
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================
# Averaged scores (reviewee view - anonymized)
# ============================================================

class PeerReviewCoreValueAverage(BaseModel):
    """Average score for a single core value from peer reviews."""
    core_value_definition_id: str = Field(..., alias="coreValueDefinitionId")
    average_score: float = Field(..., alias="averageScore")
    rating_code: str = Field(..., alias="ratingCode")

    model_config = {"populate_by_name": True}


class PeerReviewAveragedScores(BaseModel):
    """Anonymized averaged peer review scores for a reviewee."""
    reviewee_id: UUID = Field(..., alias="revieweeId")
    period_id: UUID = Field(..., alias="periodId")
    completed_reviews: int = Field(..., alias="completedReviews")
    averages: List[PeerReviewCoreValueAverage]

    model_config = {"populate_by_name": True}


# ============================================================
# Core Value Summary (admin - 総合評価)
# ============================================================

class CoreValueSummarySource(BaseModel):
    """A single source in the core value summary."""
    label: str
    rating_code: Optional[str] = Field(None, alias="ratingCode")
    score: Optional[float] = None

    model_config = {"populate_by_name": True}


class CoreValueSummaryResponse(BaseModel):
    """Response for admin core value summary (総合評価)."""
    self_rating: Optional[str] = Field(None, alias="selfRating")
    self_score: Optional[float] = Field(None, alias="selfScore")
    peer_sources: List[CoreValueSummarySource] = Field(default_factory=list, alias="peerSources")
    supervisor_rating: Optional[str] = Field(None, alias="supervisorRating")
    supervisor_score: Optional[float] = Field(None, alias="supervisorScore")
    overall_rating: Optional[str] = Field(None, alias="overallRating")
    overall_score: Optional[float] = Field(None, alias="overallScore")

    model_config = {"populate_by_name": True}
