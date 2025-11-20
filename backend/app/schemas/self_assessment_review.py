from uuid import UUID
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field

from .user import UserDetailResponse


class BucketDecision(BaseModel):
    """Individual bucket decision data for supervisor review"""
    bucket: str  # "performance" or "competency"
    employee_weight: float = Field(..., alias="employeeWeight")
    employee_contribution: float = Field(..., alias="employeeContribution")
    employee_rating: str = Field(..., alias="employeeRating")
    status: str  # "pending", "approved", "rejected"
    supervisor_rating: Optional[str] = Field(None, alias="supervisorRating")
    comment: Optional[str] = None

    model_config = {"populate_by_name": True, "from_attributes": True}


class SelfAssessmentReview(BaseModel):
    """
    Pending self-assessment review item for supervisor approval.
    Represents a bucket-based supervisor feedback record.
    """
    id: UUID  # supervisor_feedback.id
    user_id: UUID = Field(..., alias="userId")  # Employee being reviewed
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    status: str
    bucket_decisions: List[BucketDecision] = Field(default_factory=list, alias="bucketDecisions")
    subordinate: Optional[UserDetailResponse] = None  # Employee details (full user info)
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True, "from_attributes": True}


class SelfAssessmentReviewList(BaseModel):
    """Paginated list of pending self-assessment reviews"""
    items: List[SelfAssessmentReview]
    total: int
    page: int
    limit: int
    pages: int

    model_config = {"populate_by_name": True, "from_attributes": True}
