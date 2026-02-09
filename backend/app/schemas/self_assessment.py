from typing import Optional, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from .common import SelfAssessmentStatus, RatingCode, PaginatedResponse

if TYPE_CHECKING:
    pass


class SelfAssessmentBase(BaseModel):
    self_rating_code: Optional[RatingCode] = Field(
        None,
        alias="selfRatingCode",
        description="Letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    self_comment: Optional[str] = Field(
        None,
        alias="selfComment",
        max_length=5000,
        description="Employee's narrative self-assessment comment"
    )


class SelfAssessmentCreate(SelfAssessmentBase):
    """Request schema for creating a self-assessment (system auto-creates when goal approved)."""
    status: SelfAssessmentStatus = Field(
        default=SelfAssessmentStatus.DRAFT,
        description="Assessment status: draft, submitted, or approved"
    )

    model_config = {"populate_by_name": True}


class SelfAssessmentUpdate(BaseModel):
    """Request schema for updating a self-assessment."""
    self_rating_code: Optional[RatingCode] = Field(
        None,
        alias="selfRatingCode",
        description="Letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    self_comment: Optional[str] = Field(
        None,
        alias="selfComment",
        max_length=5000,
        description="Employee's narrative self-assessment comment"
    )
    rating_data: Optional[dict] = Field(
        None,
        alias="ratingData",
        description="Granular per-action ratings for コンピテンシー goals (JSONB). NULL for 業績目標."
    )

    model_config = {"populate_by_name": True}


class SelfAssessmentInDB(SelfAssessmentBase):
    id: UUID
    goal_id: UUID
    period_id: UUID
    self_rating: Optional[float] = Field(
        None,
        alias="selfRating",
        ge=0,
        le=7,
        description="Numeric rating (0.0-7.0), auto-calculated from selfRatingCode"
    )
    rating_data: Optional[dict] = Field(
        None,
        alias="ratingData",
        description="Granular per-action ratings for コンピテンシー goals (JSONB). NULL for 業績目標."
    )
    status: SelfAssessmentStatus = SelfAssessmentStatus.DRAFT
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class SelfAssessment(SelfAssessmentInDB):
    """
    Basic self-assessment schema for API responses (list views, simple references).
    """
    goal_id: UUID = Field(..., alias="goalId")
    period_id: UUID = Field(..., alias="periodId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class SelfAssessmentDetail(SelfAssessmentInDB):
    """
    Detailed self-assessment schema for single item views.
    """
    goal_id: UUID = Field(..., alias="goalId")
    period_id: UUID = Field(..., alias="periodId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    # Assessment state information
    is_editable: bool = Field(True, alias="isEditable", description="Whether this assessment can still be edited")
    is_overdue: bool = Field(False, alias="isOverdue", description="Whether this assessment is past the deadline")
    days_until_deadline: Optional[int] = Field(None, alias="daysUntilDeadline", description="Days remaining until assessment deadline")

    # Goal context
    goal_category: Optional[str] = Field(None, alias="goalCategory", description="Category of the goal being assessed")
    goal_status: Optional[str] = Field(None, alias="goalStatus", description="Current status of the goal")

    model_config = {"from_attributes": True, "populate_by_name": True}


class SelfAssessmentList(PaginatedResponse[SelfAssessment]):
    """Schema for paginated self-assessment list responses"""
    pass


class SubordinateAssessmentStatus(BaseModel):
    """Assessment status for a single subordinate."""
    user_id: UUID = Field(..., alias="userId")
    total_count: int = Field(..., alias="totalCount", description="Total number of assessments")
    submitted_count: int = Field(..., alias="submittedCount", description="Number of submitted/approved assessments")
    all_submitted: bool = Field(..., alias="allSubmitted", description="Whether all assessments are submitted")
    approved_count: int = Field(..., alias="approvedCount", description="Number of approved assessments")
    all_approved: bool = Field(..., alias="allApproved", description="Whether all assessments are approved (evaluation complete)")

    model_config = {"populate_by_name": True}


class SubordinatesAssessmentStatusResponse(BaseModel):
    """Response schema for subordinates assessment status endpoint."""
    items: list[SubordinateAssessmentStatus] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

try:
    SelfAssessmentDetail.model_rebuild()
except Exception as e:
    print(f"Warning: Could not rebuild forward references in self_assessment schemas: {e}")
    pass
