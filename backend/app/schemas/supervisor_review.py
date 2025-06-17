from typing import Optional
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime

# Supervisor Review related schemas  
class SupervisorReviewStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


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
    status: SupervisorReviewStatus = Field(..., description="Review status based on button clicked: 'draft' or 'submitted'")


class SupervisorReviewUpdate(BaseModel):
    action: Optional[SupervisorAction] = None
    comment: Optional[str] = None
    status: Optional[SupervisorReviewStatus] = Field(None, description="Review status based on button clicked: 'draft' or 'submitted'")


class SupervisorReviewInDB(SupervisorReviewBase):
    id: UUID
    goal_id: UUID
    period_id: UUID
    supervisor_id: UUID
    status: SupervisorReviewStatus = SupervisorReviewStatus.DRAFT
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupervisorReview(SupervisorReviewInDB):
    """
    Represents a supervisor's review in API responses.
    This schema defines the structure of a review object as it is sent to the client.
    It inherits from SupervisorReviewInDB and can be extended with additional fields
    (e.g., joined data from other tables) without altering the core database schema.
    This separation provides flexibility to tailor API responses independently of the
    internal data model.
    """
    pass

