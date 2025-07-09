from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from .common import SubmissionStatus

if TYPE_CHECKING:
    from .goal import Goal
    from .supervisor_feedback import SupervisorFeedback


class SelfAssessmentBase(BaseModel):
    """Base schema for self-assessment."""
    self_rating: Optional[float] = Field(None, ge=0, le=100, alias="selfRating")
    self_comment: str = Field(..., alias="selfComment")


class SelfAssessmentCreate(SelfAssessmentBase):
    period_id: UUID = Field(..., alias="periodId")
    goal_id: UUID = Field(..., alias="goalId")
    status: SubmissionStatus = Field(..., description="Assessment status based on button clicked: 'draft' or 'submitted'")


class SelfAssessmentUpdate(BaseModel):
    """
    Schema for updating a self-assessment.
    All fields are optional, allowing for partial updates.
    The status can be changed to 'submitted' to finalize the assessment.
    """
    self_rating: Optional[float] = Field(None, ge=0, le=100, alias="selfRating")
    self_comment: Optional[str] = Field(None, alias="selfComment")
    status: Optional[SubmissionStatus] = Field(None, description="Assessment status based on button clicked: 'draft' or 'submitted'")


class SelfAssessmentInDB(SelfAssessmentBase):
    id: UUID
    period_id: UUID
    goal_id: UUID
    status: SubmissionStatus = SubmissionStatus.DRAFT
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SelfAssessment(SelfAssessmentInDB):
    """
    Self-assessment schema for API responses.
    Includes related goal and supervisor feedback information by default.
    """
    # Related goal information
    goal: Optional['Goal'] = Field(None, description="The goal this assessment is for")
    
    # Supervisor feedback if it exists
    supervisor_feedback: Optional['SupervisorFeedback'] = Field(
        None, 
        alias="supervisorFeedback",
        description="Supervisor feedback on this assessment (if submitted)"
    )
    
    # Assessment progress indicators
    has_supervisor_feedback: bool = Field(
        False, 
        alias="hasSupervisorFeedback",
        description="Whether supervisor feedback has been provided"
    )
    
    # Evaluation period information (optional, for context)
    period_name: Optional[str] = Field(None, alias="periodName", description="Name of the evaluation period")
    period_status: Optional[str] = Field(None, alias="periodStatus", description="Status of the evaluation period")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class SelfAssessmentDetail(SelfAssessment):
    """
    Detailed self-assessment schema for future scalability.
    Currently identical to SelfAssessment but can be extended with additional fields
    without breaking existing API contracts.
    """
    pass


class SelfAssessmentList(BaseModel):
    """Schema for paginated self-assessment list responses"""
    assessments: List[SelfAssessment]
    total: int
