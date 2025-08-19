from typing import Optional, TYPE_CHECKING, List
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from .common import SubmissionStatus, PaginatedResponse

if TYPE_CHECKING:
    from .self_assessment import SelfAssessment
    from .evaluation import EvaluationPeriod
    from .user import UserProfile


class SupervisorFeedbackBase(BaseModel):
    rating: Optional[float] = Field(None, ge=0, le=100, description="Supervisor rating from 0-100")
    comment: Optional[str] = Field(None, description="Supervisor feedback comment")


class SupervisorFeedbackCreate(SupervisorFeedbackBase):
    """Request schema for creating a supervisor feedback, matches endpoints_v2.md."""
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    status: SubmissionStatus = Field(..., description="Feedback status based on button clicked: 'draft' or 'submitted'")


class SupervisorFeedbackUpdate(BaseModel):
    rating: Optional[float] = Field(None, ge=0, le=100, description="Supervisor rating from 0-100")
    comment: Optional[str] = Field(None, description="Supervisor feedback comment")
    status: Optional[SubmissionStatus] = Field(None, description="Feedback status based on button clicked: 'draft' or 'submitted'")


class SupervisorFeedbackInDB(SupervisorFeedbackBase):
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
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class SupervisorFeedbackDetail(SupervisorFeedbackInDB):
    """
    Detailed supervisor feedback schema for single item views.
    Supervisor evaluation feedback on employee self-assessment.
    """
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    # Related self-assessment information (the specific assessment this feedback is for)
    # self_assessment: Optional['SelfAssessment'] = Field(None, description="The self-assessment this feedback is for")
    
    # Related evaluation period information
    # evaluation_period: Optional['EvaluationPeriod'] = Field(
    #     None, 
    #     alias="evaluationPeriod",
    #     description="The evaluation period this feedback belongs to"
    # )
    
    # Employee information (assessment owner)
    # employee: Optional['UserProfile'] = Field(None, description="The employee who created the self-assessment")
    
    # Feedback state information
    is_editable: bool = Field(True, alias="isEditable", description="Whether this feedback can still be edited")
    is_overdue: bool = Field(False, alias="isOverdue", description="Whether this feedback is past the deadline")
    days_until_deadline: Optional[int] = Field(None, alias="daysUntilDeadline", description="Days remaining until feedback deadline")
    
    # Assessment context
    employee_name: Optional[str] = Field(None, alias="employeeName", description="Name of the employee being evaluated")
    goal_category: Optional[str] = Field(None, alias="goalCategory", description="Category of the goal being evaluated")
    goal_title: Optional[str] = Field(None, alias="goalTitle", description="Title of the goal being evaluated")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class SupervisorFeedbackList(PaginatedResponse):
    """Schema for paginated supervisor feedback list responses"""
    data: List[SupervisorFeedback]


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    SupervisorFeedbackDetail.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in supervisor_feedback schemas: {e}")
    pass
