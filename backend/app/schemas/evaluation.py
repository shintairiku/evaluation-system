from datetime import datetime, date
from enum import Enum
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EvaluationPeriodStatus(str, Enum):
    UPCOMING = "準備中"
    ACTIVE = "実施中"
    COMPLETED = "完了"


class EvaluationPeriodType(str, Enum):
    HALF_TERM = "半期"
    MONTHLY = "月次"
    QUARTERLY = "四半期"
    YEARLY = "年次"
    OTHER = "その他"


# Base schema  
class EvaluationPeriodBase(BaseModel):
    name: str = Field(..., description="Name of the evaluation period")
    period_type: str = Field(..., description="Type of evaluation period")
    start_date: date = Field(..., description="Start date of the evaluation period")
    end_date: date = Field(..., description="End date of the evaluation period")
    goal_submission_deadline: date = Field(..., description="Deadline for goal submission")
    evaluation_deadline: date = Field(..., description="Deadline for evaluation completion")
    status: EvaluationPeriodStatus = Field(default=EvaluationPeriodStatus.UPCOMING, description="Current status of the evaluation period")

    @field_validator('end_date')
    @classmethod
    def end_date_must_be_after_start_date(cls, v, info):
        if info.data.get('start_date') and v <= info.data['start_date']:
            raise ValueError('End date must be after start date')
        return v

    @field_validator('goal_submission_deadline')
    @classmethod
    def goal_submission_deadline_must_be_valid(cls, v, info):
        if info.data.get('start_date') and v < info.data['start_date']:
            raise ValueError('Goal submission deadline must be after start date')
        if info.data.get('end_date') and v > info.data['end_date']:
            raise ValueError('Goal submission deadline must be before end date')
        return v

    @field_validator('evaluation_deadline')
    @classmethod
    def evaluation_deadline_must_be_valid(cls, v, info):
        if info.data.get('end_date') and v < info.data['end_date']:
            raise ValueError('Evaluation deadline must be after end date')
        return v


# Schema for creating an evaluation period
class EvaluationPeriodCreate(EvaluationPeriodBase):
    pass


# Schema for updating an evaluation period
class EvaluationPeriodUpdate(BaseModel):
    name: Optional[str] = None
    period_type: Optional[EvaluationPeriodType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    goal_submission_deadline: Optional[date] = None
    evaluation_deadline: Optional[date] = None
    status: Optional[EvaluationPeriodStatus] = None

    @field_validator('end_date')
    @classmethod
    def end_date_must_be_after_start_date(cls, v, info):
        if v is not None and info.data.get('start_date') is not None and v <= info.data['start_date']:
            raise ValueError('End date must be after start date')
        return v


# Schema for database representation
class EvaluationPeriodInDB(EvaluationPeriodBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    updated_at: datetime


# Schema for API responses
class EvaluationPeriod(EvaluationPeriodInDB):
    pass


# Schema for detailed responses (with related data)
class EvaluationPeriodDetail(EvaluationPeriod):
    """Detailed evaluation period schema with statistics and additional information."""
    
    # Goal statistics
    total_goals_count: Optional[int] = Field(None, description="Total number of goals in this period")
    active_goals_count: Optional[int] = Field(None, description="Number of active/approved goals")
    pending_goals_count: Optional[int] = Field(None, description="Number of goals pending approval")
    
    # Assessment statistics
    total_assessments_count: Optional[int] = Field(None, description="Total number of self-assessments")
    completed_assessments_count: Optional[int] = Field(None, description="Number of completed self-assessments")
    pending_assessments_count: Optional[int] = Field(None, description="Number of pending self-assessments")
    
    # Review statistics
    total_reviews_count: Optional[int] = Field(None, description="Total number of supervisor reviews")
    completed_reviews_count: Optional[int] = Field(None, description="Number of completed supervisor reviews")
    pending_reviews_count: Optional[int] = Field(None, description="Number of pending supervisor reviews")
    
    # Feedback statistics
    total_feedback_count: Optional[int] = Field(None, description="Total number of supervisor feedback")
    completed_feedback_count: Optional[int] = Field(None, description="Number of completed supervisor feedback")
    
    # User participation statistics
    total_participants_count: Optional[int] = Field(None, description="Total number of users participating in this period")
    active_participants_count: Optional[int] = Field(None, description="Number of users with active goals/assessments")
    
    # Department breakdown (could be added in the future)
    # department_statistics: Optional[List[DepartmentStats]] = Field(None, description="Statistics by department")
    
    # Timeline information
    is_goals_submission_open: Optional[bool] = Field(None, description="Whether goal submission is still open")
    is_evaluation_open: Optional[bool] = Field(None, description="Whether evaluation is still open")
    days_remaining: Optional[int] = Field(None, description="Days remaining until period end (if active)")
    completion_percentage: Optional[float] = Field(None, description="Overall completion percentage (0-100)")
    
    # TODO: Add department-level statistics when department model relationships are established
    # TODO: Add stage-level statistics for competency evaluation breakdown


# Schema for list responses
class EvaluationPeriodList(BaseModel):
    evaluation_periods: List[EvaluationPeriod]
    total: int
    page: int
    size: int
    has_next: bool
    has_prev: bool