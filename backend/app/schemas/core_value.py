from typing import Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

from .common import SelfAssessmentStatus, SubmissionStatus


# ============================================================
# Enums
# ============================================================

class CoreValueRatingCode(str, Enum):
    """
    Core value rating codes (7-level scale).
    Different from goal RatingCode which has 6 levels.
    """
    SS = "SS"       # 7.0
    S = "S"         # 6.0
    A_PLUS = "A+"   # 5.0
    A = "A"         # 4.0
    A_MINUS = "A-"  # 3.0
    B = "B"         # 2.0
    C = "C"         # 1.0


CORE_VALUE_RATING_VALUES: dict[CoreValueRatingCode, float] = {
    CoreValueRatingCode.SS: 7.0,
    CoreValueRatingCode.S: 6.0,
    CoreValueRatingCode.A_PLUS: 5.0,
    CoreValueRatingCode.A: 4.0,
    CoreValueRatingCode.A_MINUS: 3.0,
    CoreValueRatingCode.B: 2.0,
    CoreValueRatingCode.C: 1.0,
}


class CoreValueFeedbackAction(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"


# ============================================================
# Definition schemas
# ============================================================

class CoreValueDefinitionResponse(BaseModel):
    id: UUID
    organization_id: str = Field(..., alias="organizationId")
    display_order: int = Field(..., alias="displayOrder")
    name: str
    description: Optional[str] = None
    is_active: bool = Field(..., alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================
# Evaluation schemas (employee self-evaluation)
# ============================================================

class CoreValueEvaluationUpdate(BaseModel):
    """Request schema for saving (auto-save) core value evaluation."""
    scores: Optional[Dict[str, str]] = Field(
        None,
        description="Map of core value definition ID to rating code (e.g. {'uuid': 'A+'})"
    )
    comment: Optional[str] = Field(
        None,
        max_length=5000,
        description="Employee comment"
    )

    model_config = {"populate_by_name": True}


class CoreValueEvaluationResponse(BaseModel):
    """Response schema for core value evaluation."""
    id: UUID
    period_id: UUID = Field(..., alias="periodId")
    user_id: UUID = Field(..., alias="userId")
    scores: Optional[Dict[str, str]] = None
    comment: Optional[str] = None
    status: SelfAssessmentStatus
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================
# Feedback schemas (supervisor)
# ============================================================

class CoreValueFeedbackUpdate(BaseModel):
    """Request schema for saving (auto-save) core value feedback."""
    scores: Optional[Dict[str, str]] = Field(
        None,
        description="Map of core value definition ID to rating code"
    )
    comment: Optional[str] = Field(
        None,
        max_length=5000,
        description="Supervisor comment"
    )

    model_config = {"populate_by_name": True}


class CoreValueFeedbackSubmit(BaseModel):
    """Request schema for submitting/approving core value feedback."""
    action: CoreValueFeedbackAction = Field(
        ...,
        description="Decision: APPROVED"
    )
    scores: Optional[Dict[str, str]] = Field(
        None,
        description="Map of core value definition ID to rating code"
    )
    comment: Optional[str] = Field(
        None,
        max_length=5000,
        description="Supervisor comment"
    )

    model_config = {"populate_by_name": True}


class CoreValueFeedbackReturn(BaseModel):
    """Request schema for returning feedback for correction (差し戻し)."""
    return_comment: str = Field(
        ...,
        alias="returnComment",
        max_length=5000,
        description="Feedback from supervisor requesting subordinate to make corrections"
    )

    model_config = {"populate_by_name": True}


class CoreValueFeedbackResponse(BaseModel):
    """Response schema for core value feedback."""
    id: UUID
    core_value_evaluation_id: UUID = Field(..., alias="coreValueEvaluationId")
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    subordinate_id: Optional[UUID] = Field(None, alias="subordinateId")
    scores: Optional[Dict[str, str]] = None
    comment: Optional[str] = None
    return_comment: Optional[str] = Field(None, alias="returnComment")
    action: CoreValueFeedbackAction
    status: SubmissionStatus
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    reviewed_at: Optional[datetime] = Field(None, alias="reviewedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ============================================================
# Combined response for subordinate view
# ============================================================

class CoreValueSubordinateDataResponse(BaseModel):
    """Response containing both evaluation and feedback for a subordinate."""
    evaluation: Optional[CoreValueEvaluationResponse] = None
    feedback: Optional[CoreValueFeedbackResponse] = None

    model_config = {"populate_by_name": True}
