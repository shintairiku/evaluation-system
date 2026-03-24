from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field
from enum import Enum

T = TypeVar('T')

# Submission Status (used in supervisor review and supervisor feedback: incomplete/draft/submitted)
class SubmissionStatus(str, Enum):
    INCOMPLETE = "incomplete"
    DRAFT = "draft"
    SUBMITTED = "submitted"


# Self-Assessment Status (3-state: draft/submitted/approved)
class SelfAssessmentStatus(str, Enum):
    """
    Self-assessment lifecycle status (3-state system).
    Employees can edit until supervisor approves.
    """
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"


# Individual goal rating codes (up to 8-level input scale)
class RatingCode(str, Enum):
    """
    Individual goal rating codes.
    DB stores all 8 values; service layer validates per goal type:
      - 定量目標: SS, S, A, B, C, D (6 levels)
      - 定性目標: SS, S, A, B, C (5 levels, no D)
      - コンピテンシー: SS, S, A+, A, A-, B, C (7 levels)
    """
    SS = "SS"       # 7.0
    S = "S"         # 6.0
    A_PLUS = "A+"   # 5.0 (コンピテンシー only)
    A = "A"         # 4.0
    A_MINUS = "A-"  # 3.0 (コンピテンシー only)
    B = "B"         # 2.0
    C = "C"         # 1.0
    D = "D"         # 0.0 (定量目標 only)


# Rating code to numeric value mapping
RATING_CODE_VALUES: dict[RatingCode, float] = {
    RatingCode.SS: 7.0,
    RatingCode.S: 6.0,
    RatingCode.A_PLUS: 5.0,
    RatingCode.A: 4.0,
    RatingCode.A_MINUS: 3.0,
    RatingCode.B: 2.0,
    RatingCode.C: 1.0,
    RatingCode.D: 0.0,
}


def rating_code_to_value(code: RatingCode) -> float:
    """Convert rating code to numeric value."""
    return RATING_CODE_VALUES.get(code, 0.0)


# Final calculated output scale (7 levels, system-calculated)
class FinalRatingCode(str, Enum):
    """
    Final overall period rating codes (7-level output scale).
    Calculated by the system from weighted individual goal ratings.
    """
    SS = "SS"       # Exceptional
    S = "S"         # Excellent
    A_PLUS = "A+"   # Very Good
    A = "A"         # Good
    A_MINUS = "A-"  # Above Average
    B = "B"         # Acceptable
    C = "C"         # Below Expectations

class Permission(BaseModel):
    """
    Permission for a role.
    Check the following files:
    - name: app/security/permissions.py
    - description: To be decided later
    """
    name: str
    description: str

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    limit: int = Field(default=20, ge=1, le=200, description="Items per page")
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int
    
    @classmethod
    def create(cls, items: List[T], total: int, pagination: PaginationParams):
        pages = (total + pagination.limit - 1) // pagination.limit
        return cls(
            items=items,
            total=total,
            page=pagination.page,
            limit=pagination.limit,
            pages=pages
        )


class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    error: bool = True
    message: str
    status_code: int


class HealthCheckResponse(BaseModel):
    status: str = "healthy"
    timestamp: str
    version: str = "1.0.0"
