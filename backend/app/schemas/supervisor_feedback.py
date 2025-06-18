from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum
from .common import SubmissionStatus


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
    Represents supervisor feedback in API responses.
    This schema defines the structure of a feedback object as it is sent to the client.
    It inherits from SupervisorFeedbackInDB and can be extended with additional fields
    (e.g., joined data from other tables) without altering the core database schema.
    This separation provides flexibility to tailor API responses independently of the
    internal data model.
    """
    pass
