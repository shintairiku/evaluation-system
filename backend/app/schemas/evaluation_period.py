from datetime import datetime, date
from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from pydantic import BaseModel, Field
from uuid import UUID

if TYPE_CHECKING:
    from .user import UserProfile


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


# === Base Schemas ===

class EvaluationPeriodBase(BaseModel):
    """Base schema with common evaluation period fields"""
    name: str = Field(..., min_length=1, max_length=200)
    period_type: EvaluationPeriodType
    start_date: date
    end_date: date
    goal_submission_deadline: date
    evaluation_deadline: date
    description: Optional[str] = Field(None, max_length=500)


# === Input Schemas (API Request) ===

class EvaluationPeriodCreate(EvaluationPeriodBase):
    """Schema for creating evaluation period via API; same format as EvaluationPeriodBase"""
    pass


class EvaluationPeriodUpdate(BaseModel):
    """Schema for updating evaluation period via API"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    period_type: Optional[EvaluationPeriodType] = Field(None, alias="periodType")
    start_date: Optional[date] = Field(None, alias="startDate")
    end_date: Optional[date] = Field(None, alias="endDate")
    goal_submission_deadline: Optional[date] = Field(None, alias="goalSubmissionDeadline")
    evaluation_deadline: Optional[date] = Field(None, alias="evaluationDeadline")
    status: Optional[EvaluationPeriodStatus] = None


# === Database Schema ===

class EvaluationPeriodInDB(EvaluationPeriodBase):
    """Internal database representation of evaluation period"""
    id: UUID
    status: EvaluationPeriodStatus = EvaluationPeriodStatus.UPCOMING
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# === Output Schemas (API Response) ===

class EvaluationPeriod(EvaluationPeriodInDB):
    """
    Basic evaluation period schema for API responses (list views, simple references).
    Contains core information without expensive joins.
    """
    # Statistics for overview
    total_users: Optional[int] = Field(None, description="Total number of users in this period")
    total_goals: Optional[int] = Field(None, description="Total number of goals in this period")
    completed_assessments: Optional[int] = Field(None, description="Number of completed self-assessments")
    pending_assessments: Optional[int] = Field(None, description="Number of pending self-assessments")


class EvaluationPeriodDetail(EvaluationPeriodInDB):
    """
    Detailed evaluation period schema for single item views.
    Includes comprehensive information with related entities.
    """
    # Users involved in this evaluation period (via goals)
    # users: List['UserProfile'] = Field(default_factory=list, description="Users who have goals in this period")
    
    # Comprehensive statistics
    statistics: Optional['EvaluationPeriodStatistics'] = None
    
    # Timeline information
    is_active: bool = Field(description="Whether the period is currently active")
    is_goal_submission_open: bool = Field(description="Whether goal submission is still open")
    is_evaluation_open: bool = Field(description="Whether evaluation is still open")
    days_remaining: Optional[int] = Field(None, description="Days remaining until period ends")


class EvaluationPeriodStatistics(BaseModel):
    """Statistics for evaluation period detail view"""
    total_users: int = 0
    total_goals: int = 0
    
    # Assessment statistics
    total_assessments: int = 0
    completed_assessments: int = 0
    pending_assessments: int = 0
    draft_assessments: int = 0
    
    # Feedback statistics
    total_feedback_required: int = 0
    completed_feedback: int = 0
    pending_feedback: int = 0
    
    # Progress percentages
    assessment_completion_rate: float = Field(0.0, ge=0.0, le=100.0, description="Percentage of completed assessments")
    feedback_completion_rate: float = Field(0.0, ge=0.0, le=100.0, description="Percentage of completed feedback")
    
    # Department breakdown
    department_progress: List['DepartmentProgress'] = Field(default_factory=list)


class DepartmentProgress(BaseModel):
    """Progress statistics by department within an evaluation period"""
    department_id: UUID
    department_name: str
    user_count: int
    goals_count: int
    completed_assessments: int
    pending_assessments: int
    completion_rate: float = Field(ge=0.0, le=100.0)


# === List Response Schema ===

class EvaluationPeriodList(BaseModel):
    """Schema for paginated evaluation period list responses"""
    periods: List[EvaluationPeriod]
    total: int


# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

# Update forward references for models with forward references (Pydantic v2)
# This needs to be done after all models are defined
try:
    # Rebuild models that have forward references
    EvaluationPeriodDetail.model_rebuild()
    EvaluationPeriodStatistics.model_rebuild()
except Exception as e:
    # Log the error but don't fail the import
    print(f"Warning: Could not rebuild forward references in evaluation_period schemas: {e}")
    pass
