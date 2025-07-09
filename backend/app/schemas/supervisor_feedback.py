from pydantic import BaseModel, Field
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from uuid import UUID
from .common import SubmissionStatus

if TYPE_CHECKING:
    from .self_assessment import SelfAssessment
    from .evaluation_period import EvaluationPeriod


class SupervisorFeedbackBase(BaseModel):
    rating: Optional[float] = Field(None, ge=0, le=100)
    comment: str


class SupervisorFeedbackCreate(SupervisorFeedbackBase):
    """Schema for creating supervisor feedback via API"""
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    status: SubmissionStatus = Field(..., description="Feedback status based on button clicked: 'draft' or 'submitted'")


class SupervisorFeedbackUpdate(BaseModel):
    """Request schema for updating supervisor feedback."""
    rating: Optional[float] = Field(None, ge=0, le=100)
    comment: Optional[str] = None
    status: Optional[SubmissionStatus] = Field(None, description="Feedback status based on button clicked: 'draft' or 'submitted'")


class SupervisorFeedbackInDB(SupervisorFeedbackBase):
    """Internal database representation of supervisor feedback."""
    id: UUID
    self_assessment_id: UUID
    period_id: UUID
    supervisor_id: UUID
    status: SubmissionStatus = SubmissionStatus.DRAFT
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupervisorFeedback(SupervisorFeedbackInDB):
    """
    Basic supervisor feedback schema for API responses (list views, simple references).
    Contains core supervisor feedback information without expensive joins.
    """
    pass


class SupervisorFeedbackDetail(SupervisorFeedbackInDB):
    """
    Detailed supervisor feedback schema for single item views.
    Includes comprehensive information with related entities.
    """
    # Related self-assessment information
    # self_assessment: Optional['SelfAssessment'] = Field(
    #     None, 
    #     alias="selfAssessment",
    #     description="The self-assessment this feedback is for"
    # )
    
    # Related evaluation period information
    # evaluation_period: Optional['EvaluationPeriod'] = Field(
    #     None, 
    #     alias="evaluationPeriod",
    #     description="The evaluation period this feedback belongs to"
    # )
    
    # Employee information (from self-assessment)
    employee_name: Optional[str] = Field(None, alias="employeeName", description="Name of the employee being evaluated")
    employee_id: Optional[UUID] = Field(None, alias="employeeId", description="ID of the employee being evaluated")
    
    # Goal information (from from self-self_assessment.goal)
    goal_title: Optional[str] = Field(None, alias="goalTitle", description="Title/description of the goal being evaluated")
    goal_category: Optional[str] = Field(None, alias="goalCategory", description="Category of the goal (performance, competency, core value)")
    goal_weight: Optional[float] = Field(None, alias="goalWeight", description="Weight of the goal in the evaluation")
    
    # Feedback context
    is_overdue: bool = Field(False, alias="isOverdue", description="Whether this feedback is past the evaluation deadline")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class SupervisorFeedbackList(BaseModel):
    """Schema for paginated supervisor feedback list responses"""
    feedback_items: list[SupervisorFeedback] = Field(alias="feedbackItems")
    total: int


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    SupervisorFeedbackDetail.model_rebuild()
    SupervisorFeedbackList.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in supervisor_feedback schemas: {e}")
    pass
