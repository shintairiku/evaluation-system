from typing import Optional, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from .common import SubmissionStatus, RatingCode, PaginatedResponse
from .supervisor_review import SupervisorAction

if TYPE_CHECKING:
    from .self_assessment import SelfAssessment
    from .evaluation import EvaluationPeriod
    from .user import UserProfileOption


class SupervisorFeedbackBase(BaseModel):
    supervisor_rating_code: Optional[RatingCode] = Field(
        None,
        alias="supervisorRatingCode",
        description="Supervisor's letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        max_length=5000,
        description="Supervisor's feedback comment"
    )


class SupervisorFeedbackCreate(SupervisorFeedbackBase):
    """Request schema for creating supervisor feedback."""
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    rating_data: Optional[dict] = Field(
        None,
        alias="ratingData",
        description="Granular per-action ratings for コンピテンシー goals (JSONB). NULL for 業績目標."
    )
    action: SupervisorAction = Field(
        default=SupervisorAction.PENDING,
        description="Decision: PENDING or APPROVED"
    )
    status: SubmissionStatus = Field(
        default=SubmissionStatus.DRAFT,
        description="Workflow status: incomplete, draft, or submitted"
    )

    model_config = {"populate_by_name": True}


class SupervisorFeedbackUpdate(BaseModel):
    """Request schema for updating supervisor feedback."""
    supervisor_rating_code: Optional[RatingCode] = Field(
        None,
        alias="supervisorRatingCode",
        description="Supervisor's letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        max_length=5000,
        description="Supervisor's feedback comment"
    )
    rating_data: Optional[dict] = Field(
        None,
        alias="ratingData",
        description="Granular per-action ratings for コンピテンシー goals (JSONB). NULL for 業績目標."
    )

    model_config = {"populate_by_name": True}


class SupervisorFeedbackSubmit(BaseModel):
    """Request schema for submitting supervisor feedback."""
    action: SupervisorAction = Field(
        ...,
        description="Decision: PENDING or APPROVED (REJECTED is not supported)"
    )
    supervisor_rating_code: Optional[RatingCode] = Field(
        None,
        alias="supervisorRatingCode",
        description="Supervisor's letter grade (optional)"
    )
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        max_length=5000,
        description="Supervisor's feedback comment (optional)"
    )
    rating_data: Optional[dict] = Field(
        None,
        alias="ratingData",
        description="Granular per-action ratings for コンピテンシー goals (JSONB). NULL for 業績目標."
    )

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: SupervisorAction) -> SupervisorAction:
        if value not in (SupervisorAction.PENDING, SupervisorAction.APPROVED):
            raise ValueError("action must be PENDING or APPROVED")
        return value

    model_config = {"populate_by_name": True}


class SupervisorFeedbackInDB(SupervisorFeedbackBase):
    id: UUID
    self_assessment_id: UUID
    period_id: UUID
    supervisor_id: UUID
    subordinate_id: Optional[UUID] = None
    supervisor_rating: Optional[float] = Field(
        None,
        alias="supervisorRating",
        ge=0,
        le=7,
        description="Numeric rating (0.0-7.0), auto-calculated"
    )
    rating_data: Optional[dict] = Field(
        None,
        alias="ratingData",
        description="Granular per-action ratings for コンピテンシー goals (JSONB). NULL for 業績目標."
    )
    action: SupervisorAction = Field(
        default=SupervisorAction.PENDING,
        description="Decision: PENDING or APPROVED"
    )
    status: SubmissionStatus = Field(
        default=SubmissionStatus.INCOMPLETE,
        description="Workflow status: incomplete, draft, or submitted"
    )
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class SupervisorFeedback(SupervisorFeedbackInDB):
    """
    Basic supervisor feedback schema for API responses (list views, simple references).
    """
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    subordinate_id: Optional[UUID] = Field(None, alias="subordinateId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    reviewed_at: Optional[datetime] = Field(None, alias="reviewedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class SupervisorFeedbackDetail(SupervisorFeedbackInDB):
    """
    Detailed supervisor feedback schema for single item views.
    """
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    subordinate_id: Optional[UUID] = Field(None, alias="subordinateId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    reviewed_at: Optional[datetime] = Field(None, alias="reviewedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    # Related self-assessment information
    self_assessment: Optional['SelfAssessment'] = Field(None, alias="selfAssessment")

    # Related evaluation period information
    evaluation_period: Optional['EvaluationPeriod'] = Field(
        None,
        alias="evaluationPeriod",
    )

    # User information
    subordinate_info: Optional['UserProfileOption'] = Field(None, alias="subordinateInfo")
    supervisor_info: Optional['UserProfileOption'] = Field(None, alias="supervisorInfo")

    # Feedback state information
    is_editable: bool = Field(True, alias="isEditable")
    is_overdue: bool = Field(False, alias="isOverdue")
    days_until_deadline: Optional[int] = Field(None, alias="daysUntilDeadline")

    # Assessment context
    goal_category: Optional[str] = Field(None, alias="goalCategory")
    goal_title: Optional[str] = Field(None, alias="goalTitle")

    model_config = {"from_attributes": True, "populate_by_name": True}


class SupervisorFeedbackList(PaginatedResponse[SupervisorFeedback]):
    """Schema for paginated supervisor feedback list responses"""
    pass


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

def rebuild_models():
    """Rebuild models with forward references when all schemas are loaded."""
    try:
        from .self_assessment import SelfAssessment
        from .evaluation import EvaluationPeriod
        from .user import UserProfileOption

        _ = SelfAssessment, EvaluationPeriod, UserProfileOption

        SupervisorFeedbackDetail.model_rebuild()
    except ImportError:
        pass
    except Exception as e:
        print(f"Warning: Could not rebuild forward references in supervisor_feedback schemas: {e}")

rebuild_models()
