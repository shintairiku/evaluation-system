from datetime import datetime, date
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID

class EvaluationPeriodStatus(str, Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"


class EvaluationPeriodType(str, Enum):
    HALF_TERM = "half-term"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    OTHER = "other"


class EvaluationPeriodBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    period_type: EvaluationPeriodType
    start_date: date
    end_date: date
    goal_submission_deadline: date
    evaluation_deadline: date


class EvaluationPeriodCreate(EvaluationPeriodBase):
    """Schema for creating evaluation period via API"""
    description: Optional[str] = Field(None, max_length=500)
    


class EvaluationPeriodUpdate(BaseModel):
    """Schema for updating evaluation period via API"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    start_date: Optional[date] = Field(None, alias="startDate")
    end_date: Optional[date] = Field(None, alias="endDate")
    goal_submission_deadline: Optional[date] = Field(None, alias="goalSubmissionDeadline")
    evaluation_deadline: Optional[date] = Field(None, alias="evaluationDeadline")
    status: Optional[EvaluationPeriodStatus] = None


class EvaluationPeriodInDB(EvaluationPeriodBase):
    """Internal database representation of evaluation period"""
    id: UUID
    status: EvaluationPeriodStatus = EvaluationPeriodStatus.UPCOMING
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvaluationPeriod(EvaluationPeriodInDB):
    """
    Represents evaluation period in API responses.
    This schema defines the structure of an evaluation period object as it is sent to the client.
    It inherits from EvaluationPeriodInDB and can be extended with additional fields
    (e.g., joined data from other tables) without altering the core database schema.
    This separation provides flexibility to tailor API responses independently of the
    internal data model.
    """
    pass
