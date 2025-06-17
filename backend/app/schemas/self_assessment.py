from typing import Optional
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime

# Self Assessment related schemas
class SelfAssessmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


class SelfAssessmentBase(BaseModel):
    """Base schema for self-assessment."""
    self_rating: Optional[float] = Field(None, ge=0, le=100, alias="selfRating")
    self_comment: str = Field(..., alias="selfComment")


class SelfAssessmentCreate(SelfAssessmentBase):
    period_id: UUID = Field(..., alias="periodId")
    goal_id: UUID = Field(..., alias="goalId")
    status: SelfAssessmentStatus = Field(..., description="Assessment status based on button clicked: 'draft' or 'submitted'")


class SelfAssessmentUpdate(BaseModel):
    """
    Schema for updating a self-assessment.
    All fields are optional, allowing for partial updates.
    The status can be changed to 'submitted' to finalize the assessment.
    """
    self_rating: Optional[float] = Field(None, ge=0, le=100, alias="selfRating")
    self_comment: Optional[str] = Field(None, alias="selfComment")
    status: Optional[SelfAssessmentStatus] = Field(None, description="Assessment status based on button clicked: 'draft' or 'submitted'")


class SelfAssessmentInDB(SelfAssessmentBase):
    id: UUID
    period_id: UUID
    goal_id: UUID
    status: SelfAssessmentStatus = SelfAssessmentStatus.DRAFT
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SelfAssessment(SelfAssessmentInDB):
    """
    Represents a self-assessment in API responses.
    This schema defines the structure of a self-assessment object as it is sent to the client.
    It inherits from SelfAssessmentInDB and can be extended with additional fields
    (e.g., joined data from other tables) without altering the core database schema.
    This separation provides flexibility to tailor API responses based on UI requirements.
    """
    pass
