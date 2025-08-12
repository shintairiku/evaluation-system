from typing import Optional, TYPE_CHECKING, List
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from .common import SubmissionStatus, PaginatedResponse

if TYPE_CHECKING:
    from .goal import Goal
    from .evaluation import EvaluationPeriod
    from .user import UserProfile

class SupervisorAction(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING = "pending"


class SupervisorReviewBase(BaseModel):
    action: SupervisorAction
    comment: str


class SupervisorReviewCreate(SupervisorReviewBase):
    """Request schema for creating a supervisor review, matches endpoints_v2.md."""
    goal_id: UUID = Field(..., alias="goalId")
    period_id: UUID = Field(..., alias="periodId")
    status: SubmissionStatus = Field(..., description="Review status based on button clicked: 'draft' or 'submitted'")


class SupervisorReviewUpdate(BaseModel):
    action: Optional[SupervisorAction] = None
    comment: Optional[str] = None
    status: Optional[SubmissionStatus] = Field(None, description="Review status based on button clicked: 'draft' or 'submitted'")


class SupervisorReviewInDB(SupervisorReviewBase):
    id: UUID
    goal_id: UUID
    period_id: UUID
    supervisor_id: UUID
    status: SubmissionStatus = SubmissionStatus.DRAFT
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupervisorReview(SupervisorReviewInDB):
    """
    Basic supervisor review schema for API responses (list views, simple references).
    Contains core supervisor review information without expensive joins.
    """
    pass


class SupervisorReviewDetail(SupervisorReviewInDB):
    """
    Detailed supervisor review schema for single item views.
    Supervisor reviews a specific goal to approve or deny it.
    """
    # Related goal information (the specific goal this review is for)
    # goal: Optional['Goal'] = Field(None, description="The specific goal this review is for")
    
    # Related evaluation period information
    # evaluation_period: Optional['EvaluationPeriod'] = Field(
    #     None, 
    #     alias="evaluationPeriod",
    #     description="The evaluation period this review belongs to"
    # )
    
    # Employee information (goal owner)
    # employee: Optional['UserProfile'] = Field(None, description="The employee whose goal is being reviewed")
    
    # Timeline information
    is_overdue: bool = Field(False, alias="isOverdue", description="Whether this review is past the deadline")
    days_until_deadline: Optional[int] = Field(None, alias="daysUntilDeadline", description="Days remaining until review deadline")
    
    class Config:
        from_attributes = True
        populate_by_name = True


class SupervisorReviewList(PaginatedResponse[SupervisorReview]):
    """Schema for paginated supervisor review list responses"""
    pass


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    SupervisorReviewDetail.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in supervisor_review schemas: {e}")
    pass

