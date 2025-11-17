from typing import Optional, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from .common import SubmissionStatus, PaginatedResponse

if TYPE_CHECKING:
    pass


class SelfAssessmentBase(BaseModel):
    self_rating: Optional[float] = Field(None, ge=0, le=100, alias="selfRating", description="Self-rating from 0-100")
    self_rating_text: Optional[str] = Field(None, alias="selfRatingText", description="Self-rating code (SS..D)")
    self_comment: Optional[str] = Field(None, alias="selfComment", description="Self-assessment comment")


class SelfAssessmentCreate(SelfAssessmentBase):
    """Request schema for creating a self-assessment, matches endpoints_v2.md."""
    status: SubmissionStatus = Field(..., description="Assessment status based on button clicked: 'draft' or 'submitted'")


class SelfAssessmentUpdate(BaseModel):
    self_rating: Optional[float] = Field(None, ge=0, le=100, alias="selfRating", description="Self-rating from 0-100")
    self_comment: Optional[str] = Field(None, alias="selfComment", description="Self-assessment comment")
    status: Optional[SubmissionStatus] = Field(None, description="Assessment status based on button clicked: 'draft' or 'submitted'")


class SelfAssessmentInDB(SelfAssessmentBase):
    id: UUID
    goal_id: UUID
    period_id: UUID
    status: SubmissionStatus = SubmissionStatus.DRAFT
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SelfAssessment(SelfAssessmentInDB):
    """
    Basic self-assessment schema for API responses (list views, simple references).
    Contains core self-assessment information without expensive joins.
    """
    goal_id: UUID = Field(..., alias="goalId")
    period_id: UUID = Field(..., alias="periodId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class SelfAssessmentDetail(SelfAssessmentInDB):
    """
    Detailed self-assessment schema for single item views.
    Employee self-evaluation for a specific goal.
    """
    goal_id: UUID = Field(..., alias="goalId")
    period_id: UUID = Field(..., alias="periodId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    # Related goal information (the specific goal this assessment is for)
    # goal: Optional['Goal'] = Field(None, description="The specific goal this assessment is for")
    
    # Related evaluation period information
    # evaluation_period: Optional['EvaluationPeriod'] = Field(
    #     None, 
    #     alias="evaluationPeriod",
    #     description="The evaluation period this assessment belongs to"
    # )
    
    # Employee information (assessment owner)
    # employee: Optional['UserProfileOption'] = Field(None, description="The employee who created this assessment")
    
    # Assessment state information
    is_editable: bool = Field(True, alias="isEditable", description="Whether this assessment can still be edited")
    is_overdue: bool = Field(False, alias="isOverdue", description="Whether this assessment is past the deadline")
    days_until_deadline: Optional[int] = Field(None, alias="daysUntilDeadline", description="Days remaining until assessment deadline")
    
    # Goal context
    goal_category: Optional[str] = Field(None, alias="goalCategory", description="Category of the goal being assessed")
    goal_status: Optional[str] = Field(None, alias="goalStatus", description="Current status of the goal")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class SelfAssessmentList(PaginatedResponse[SelfAssessment]):
    """Schema for paginated self-assessment list responses"""
    pass


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    SelfAssessmentDetail.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in self_assessment schemas: {e}")
    pass
