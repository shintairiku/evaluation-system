from typing import Optional, TYPE_CHECKING, List
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from .common import SubmissionStatus, PaginatedResponse

if TYPE_CHECKING:
    from .self_assessment import SelfAssessment
    from .evaluation import EvaluationPeriod
    from .user import UserProfileOption


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
    # Add aliases for API compatibility without duplicating fields
    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class SupervisorFeedbackDetail(SupervisorFeedbackInDB):
    """
    Detailed supervisor feedback schema for single item views.
    Supervisor evaluation feedback on employee self-assessment.
    """
    # Field aliases for API compatibility
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId") 
    supervisor_id: UUID = Field(..., alias="supervisorId")
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    # Related self-assessment information (the specific assessment this feedback is for)
    self_assessment: Optional['SelfAssessment'] = Field(None, alias="selfAssessment", description="The self-assessment this feedback is for")
    
    # Related evaluation period information
    evaluation_period: Optional['EvaluationPeriod'] = Field(
        None, 
        alias="evaluationPeriod",
        description="The evaluation period this feedback belongs to"
    )
    
    # User information
    subordinate: Optional['UserProfileOption'] = Field(None, description="The subordinate who created the self-assessment")
    supervisor: Optional['UserProfileOption'] = Field(None, description="The supervisor providing the feedback")
    
    # Feedback state information
    is_editable: bool = Field(True, alias="isEditable", description="Whether this feedback can still be edited")
    is_overdue: bool = Field(False, alias="isOverdue", description="Whether this feedback is past the deadline")
    days_until_deadline: Optional[int] = Field(None, alias="daysUntilDeadline", description="Days remaining until feedback deadline")
    
    # Assessment context
    goal_category: Optional[str] = Field(None, alias="goalCategory", description="Category of the goal being evaluated")
    goal_title: Optional[str] = Field(None, alias="goalTitle", description="Title of the goal being evaluated")
    goal_description: Optional[str] = Field(None, alias="goalDescription", description="Description of the goal for better context")
    evaluation_period_name: Optional[str] = Field(None, alias="evaluationPeriodName", description="Name of the evaluation period")
    
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
def rebuild_models():
    """Rebuild models with forward references when all schemas are loaded."""
    try:
        # Import the actual classes to ensure they're available
        from .self_assessment import SelfAssessment
        from .evaluation import EvaluationPeriod  
        from .user import UserProfileOption
        
        # Use the imports to satisfy the linter
        _ = SelfAssessment, EvaluationPeriod, UserProfileOption
        
        # Rebuild the model
        SupervisorFeedbackDetail.model_rebuild()
    except ImportError:
        # Models not available yet, will be rebuilt later
        pass
    except Exception as e:
        # Log the error but don't fail the import
        print(f"Warning: Could not rebuild forward references in supervisor_feedback schemas: {e}")

# Try to rebuild immediately
rebuild_models()
