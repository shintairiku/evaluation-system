from uuid import UUID
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ReviewUser(BaseModel):
    id: UUID
    name: Optional[str] = None

    class Config:
        populate_by_name = True
        from_attributes = True


class SelfAssessmentReview(BaseModel):
    id: UUID
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    status: str
    subordinate: Optional[ReviewUser] = None
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        populate_by_name = True
        from_attributes = True


class SelfAssessmentReviewList(BaseModel):
    items: List[SelfAssessmentReview]
    total: int
    page: int
    limit: int
    pages: int

    class Config:
        populate_by_name = True
        from_attributes = True
