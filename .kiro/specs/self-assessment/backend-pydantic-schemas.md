# Backend Pydantic Schemas: Self-Assessment

**Status:** Updated
**Last Updated:** 2025-01-05
**Related Issues:** #417

---

## 1. Overview

This document defines the Pydantic schemas for the Self-Assessment feature, ensuring alignment with the API Contract and frontend TypeScript types. The schemas support:

- **4-state system**: draft → submitted → approved/rejected
- **Letter grade system**:
  - **Input Scale (Individual Goals)**: SS, S, A, B, C, D (6 levels) - for self-assessments and supervisor feedbacks
  - **Output Scale (Final Calculation)**: SS, S, A+, A, A-, B, C, D (8 levels) - for overall period ratings
- **Rejection history tracking**: via `previous_self_assessment_id`
- **Supervisor feedback**: with action (PENDING/APPROVED/REJECTED) and status (incomplete/draft/submitted)

---

## 2. Current Implementation Analysis

**File:** `backend/app/schemas/self_assessment.py`

### 2.1. Existing Schemas (Before Update)

```python
# ❌ Current: Uses 0-100 scale
self_rating: Optional[float] = Field(None, ge=0, le=100)

# ❌ Current: Only SubmissionStatus (draft/submitted)
status: SubmissionStatus

# ❌ Missing: previous_self_assessment_id
# ❌ Missing: self_rating_code (letter grade)
# ❌ Missing: SelfAssessmentStatus (4 states)
```

### 2.2. Required Changes

| Change | Current | Updated |
|--------|---------|---------|
| Rating system | `self_rating: float (0-100)` | `self_rating_code: RatingCode` + `self_rating: float (0-7)` |
| Status enum | `SubmissionStatus` | `SelfAssessmentStatus` (4 states) |
| History tracking | ❌ Missing | `previous_self_assessment_id: UUID` |
| Goal relation | ❌ Missing | `goal: Optional[GoalResponse]` |

---

## 3. Enum Definitions

### 3.1. SelfAssessmentStatus (NEW)

```python
# backend/app/schemas/common.py (ADD)

class SelfAssessmentStatus(str, Enum):
    """
    4-state self-assessment status.
    @see domain-model.md Section 5 - State Transitions
    """
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
```

### 3.2. RatingCode (Individual Goal Input - 5 levels)

```python
# backend/app/schemas/common.py (ADD)

class RatingCode(str, Enum):
    """
    Individual goal rating codes (5-level input scale).
    Used for self-assessments and supervisor feedbacks on individual goals.
    @see domain-model.md Section 4.2 - Rating Validation
    """
    SS = "SS"   # 7.0 - Exceptional
    S = "S"     # 6.0 - Excellent
    A = "A"     # 4.0 - Good
    B = "B"     # 2.0 - Acceptable
    C = "C"     # 1.0 - Below Expectations

# Rating code to numeric value mapping (5-level scale)
RATING_CODE_VALUES: dict[RatingCode, float] = {
    RatingCode.SS: 7.0,
    RatingCode.S: 6.0,
    RatingCode.A: 4.0,
    RatingCode.B: 2.0,
    RatingCode.C: 1.0,
}

def rating_code_to_value(code: RatingCode) -> float:
    """Convert rating code to numeric value (5-level scale)."""
    return RATING_CODE_VALUES.get(code, 0.0)
```

### 3.3. FinalRatingCode (Final Calculation Output - 7 levels)

```python
# backend/app/schemas/common.py (ADD)

class FinalRatingCode(str, Enum):
    """
    Final calculated rating codes (7-level output scale).
    Used for overall period performance ratings calculated by system.
    Includes intermediate grades A+, A- for more precise evaluation.
    @see domain-model.md Section 4.2 - Rating Validation
    """
    SS = "SS"       # 7.0 - Exceptional
    S = "S"         # 6.0 - Excellent
    A_PLUS = "A+"   # 5.0 - Very Good+
    A = "A"         # 4.0 - Good
    A_MINUS = "A-"  # 3.0 - Fairly Good
    B = "B"         # 2.0 - Acceptable
    C = "C"         # 1.0 - Below Expectations

# Final rating code to numeric value mapping (7-level scale)
FINAL_RATING_CODE_VALUES: dict[FinalRatingCode, float] = {
    FinalRatingCode.SS: 7.0,
    FinalRatingCode.S: 6.0,
    FinalRatingCode.A_PLUS: 5.0,
    FinalRatingCode.A: 4.0,
    FinalRatingCode.A_MINUS: 3.0,
    FinalRatingCode.B: 2.0,
    FinalRatingCode.C: 1.0,
}

def final_rating_code_to_value(code: FinalRatingCode) -> float:
    """Convert final rating code to numeric value (7-level scale)."""
    return FINAL_RATING_CODE_VALUES.get(code, 0.0)
```

### 3.4. SupervisorFeedbackAction (EXISTING)

```python
# backend/app/schemas/supervisor_review.py (Already exists)

class SupervisorAction(str, Enum):
    """Supervisor decision action."""
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PENDING = "PENDING"
```

### 3.4. SupervisorFeedbackStatus (EXISTING)

```python
# backend/app/schemas/common.py (Already exists as SubmissionStatus)

class SubmissionStatus(str, Enum):
    """Workflow status for supervisor feedback."""
    INCOMPLETE = "incomplete"
    DRAFT = "draft"
    SUBMITTED = "submitted"
```

---

## 4. Self-Assessment Schemas

### 4.1. Base Schema

```python
# backend/app/schemas/self_assessment.py

from typing import Optional, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from .common import (
    SelfAssessmentStatus,
    RatingCode,
    RATING_CODE_VALUES,
    PaginatedResponse
)
from .supervisor_review import SupervisorAction

if TYPE_CHECKING:
    from .goal import GoalResponse
    from .evaluation import EvaluationPeriod
    from .user import UserProfileOption


class SelfAssessmentBase(BaseModel):
    """
    Base self-assessment fields (editable by employee).
    @see api-contract.md Section 4.5
    """
    self_rating_code: Optional[RatingCode] = Field(
        None,
        alias="selfRatingCode",
        description="Letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    self_comment: Optional[str] = Field(
        None,
        alias="selfComment",
        max_length=5000,
        description="Employee's narrative self-assessment comment"
    )
```

### 4.2. Update Schema (Request)

```python
class SelfAssessmentUpdate(BaseModel):
    """
    Request schema for updating a self-assessment.
    All fields optional - partial updates allowed.
    @see api-contract.md Section 4.5
    """
    self_rating_code: Optional[RatingCode] = Field(
        None,
        alias="selfRatingCode",
        description="Letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    self_comment: Optional[str] = Field(
        None,
        alias="selfComment",
        max_length=5000,
        description="Employee's narrative self-assessment comment"
    )

    model_config = {"populate_by_name": True}
```

### 4.3. InDB Schema (Database)

```python
class SelfAssessmentInDB(SelfAssessmentBase):
    """
    Self-assessment as stored in database.
    Includes all system-managed fields.
    """
    id: UUID
    goal_id: UUID = Field(..., alias="goalId")
    period_id: UUID = Field(..., alias="periodId")
    previous_self_assessment_id: Optional[UUID] = Field(
        None,
        alias="previousSelfAssessmentId",
        description="Reference to previous self-assessment (for rejection history)"
    )
    self_rating: Optional[float] = Field(
        None,
        alias="selfRating",
        ge=0,
        le=7,
        description="Numeric rating (0.0-7.0), auto-calculated from selfRatingCode"
    )
    status: SelfAssessmentStatus = Field(
        default=SelfAssessmentStatus.DRAFT,
        description="Current status: draft, submitted, approved, or rejected"
    )
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}
```

### 4.4. Response Schema (API)

```python
class SelfAssessment(SelfAssessmentInDB):
    """
    Basic self-assessment schema for API responses (list views, simple references).
    Contains core self-assessment information without expensive joins.
    @see api-contract.md Section 4.1
    """
    pass
```

### 4.5. Detail Schema (Single Item)

```python
class SelfAssessmentDetail(SelfAssessmentInDB):
    """
    Detailed self-assessment schema for single item views.
    Includes embedded relationships and computed fields.
    @see api-contract.md Section 4.4

    NOTE: Goal title should be extracted using get_goal_title() helper:
    - Performance goals: use goal.title
    - Competency goals: use competency names or fallback
    """
    # Assessment state information
    is_editable: bool = Field(
        True,
        alias="isEditable",
        description="Whether this assessment can still be edited"
    )
    is_overdue: bool = Field(
        False,
        alias="isOverdue",
        description="Whether this assessment is past the deadline"
    )
    days_until_deadline: Optional[int] = Field(
        None,
        alias="daysUntilDeadline",
        description="Days remaining until assessment deadline"
    )

    # Goal context (convenience fields, extracted from goal relationship)
    goal_category: Optional[str] = Field(
        None,
        alias="goalCategory",
        description="Category of the goal being assessed"
    )
    goal_status: Optional[str] = Field(
        None,
        alias="goalStatus",
        description="Current status of the goal"
    )

    # Embedded relationships
    goal: Optional['GoalResponse'] = Field(
        None,
        description="The goal being assessed - use get_goal_title() helper to extract title"
    )
    evaluation_period: Optional['EvaluationPeriod'] = Field(
        None,
        alias="evaluationPeriod",
        description="The evaluation period this assessment belongs to"
    )
    employee: Optional['UserProfileOption'] = Field(
        None,
        description="The employee who owns this assessment"
    )

    model_config = {"from_attributes": True, "populate_by_name": True}
```

### 4.6. WithGoal Schema (List Views)

```python
class SelfAssessmentWithGoal(SelfAssessment):
    """
    Self-assessment with embedded goal information (for list views).
    Goal title should be extracted using get_goal_title() helper.
    """
    goal: 'GoalResponse' = Field(
        ...,
        description="The goal being assessed"
    )
```

### 4.7. List Schema (Paginated)

```python
class SelfAssessmentList(PaginatedResponse[SelfAssessment]):
    """Schema for paginated self-assessment list responses."""
    pass
```

### 4.8. History Item Schema

```python
class SelfAssessmentHistoryItem(BaseModel):
    """
    Rejection history item (for history chain display).
    @see api-contract.md Section 4.8
    """
    id: UUID
    status: SelfAssessmentStatus
    self_rating_code: Optional[RatingCode] = Field(None, alias="selfRatingCode")
    self_comment: Optional[str] = Field(None, alias="selfComment")
    previous_self_assessment_id: Optional[UUID] = Field(
        None,
        alias="previousSelfAssessmentId"
    )
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    # From SupervisorFeedback
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        description="Supervisor's comment (from SupervisorFeedback)"
    )
    supervisor_action: Optional[SupervisorAction] = Field(
        None,
        alias="supervisorAction",
        description="Supervisor's action (from SupervisorFeedback)"
    )

    model_config = {"from_attributes": True, "populate_by_name": True}


class SelfAssessmentHistory(BaseModel):
    """Rejection history response."""
    items: list[SelfAssessmentHistoryItem]
    total: int
```

---

## 5. Supervisor Feedback Schemas (Updated)

### 5.1. Base Schema

```python
# backend/app/schemas/supervisor_feedback.py

from typing import Optional, TYPE_CHECKING
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from .common import SubmissionStatus, RatingCode, PaginatedResponse
from .supervisor_review import SupervisorAction

if TYPE_CHECKING:
    from .self_assessment import SelfAssessmentWithGoal
    from .evaluation import EvaluationPeriod
    from .user import UserProfileOption


class SupervisorFeedbackBase(BaseModel):
    """
    Base supervisor feedback fields (editable by supervisor).
    @see api-contract.md Section 5
    """
    supervisor_rating_code: Optional[RatingCode] = Field(
        None,
        alias="supervisorRatingCode",
        description="Supervisor's letter grade: SS, S, A, B, C, D (6-level input scale)"
    )
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        max_length=5000,
        description="Supervisor's feedback comment"
    )
```

### 5.2. Create Schema (Request)

```python
class SupervisorFeedbackCreate(SupervisorFeedbackBase):
    """
    Request schema for creating supervisor feedback.
    @see api-contract.md Section 5.2
    """
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    action: SupervisorAction = Field(
        default=SupervisorAction.PENDING,
        description="Initial action (usually PENDING)"
    )
    status: SubmissionStatus = Field(
        default=SubmissionStatus.INCOMPLETE,
        description="Initial status"
    )

    model_config = {"populate_by_name": True}
```

### 5.3. Update Schema (Request)

```python
class SupervisorFeedbackUpdate(BaseModel):
    """
    Request schema for updating supervisor feedback.
    @see api-contract.md Section 5.4
    """
    supervisor_rating_code: Optional[RatingCode] = Field(
        None,
        alias="supervisorRatingCode"
    )
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        max_length=5000
    )

    model_config = {"populate_by_name": True}
```

### 5.4. Submit Schema (Request)

```python
class SupervisorFeedbackSubmit(BaseModel):
    """
    Request schema for submitting supervisor feedback (approve/reject).
    @see api-contract.md Section 5.5
    """
    action: SupervisorAction = Field(
        ...,
        description="Decision: APPROVED or REJECTED"
    )
    supervisor_rating_code: Optional[RatingCode] = Field(
        None,
        alias="supervisorRatingCode",
        description="Rating code: SS, S, A, B, C, D (6-level input scale, required for APPROVED)"
    )
    supervisor_comment: Optional[str] = Field(
        None,
        alias="supervisorComment",
        max_length=5000,
        description="Comment (required for REJECTED, optional for APPROVED)"
    )

    model_config = {"populate_by_name": True}

    @model_validator(mode='after')
    def validate_submit_requirements(self) -> 'SupervisorFeedbackSubmit':
        """
        Validate submission requirements based on action.
        - APPROVED: supervisor_rating_code required
        - REJECTED: supervisor_comment required
        """
        if self.action == SupervisorAction.APPROVED:
            if not self.supervisor_rating_code:
                raise ValueError(
                    "supervisor_rating_code is required when approving"
                )
        elif self.action == SupervisorAction.REJECTED:
            if not self.supervisor_comment:
                raise ValueError(
                    "supervisor_comment is required when rejecting"
                )
        return self
```

### 5.5. InDB Schema (Database)

```python
class SupervisorFeedbackInDB(SupervisorFeedbackBase):
    """
    Supervisor feedback as stored in database.
    """
    id: UUID
    self_assessment_id: UUID = Field(..., alias="selfAssessmentId")
    period_id: UUID = Field(..., alias="periodId")
    supervisor_id: UUID = Field(..., alias="supervisorId")
    subordinate_id: UUID = Field(..., alias="subordinateId")
    supervisor_rating: Optional[float] = Field(
        None,
        alias="supervisorRating",
        ge=0,
        le=7,
        description="Numeric rating (0.0-7.0), auto-calculated"
    )
    action: SupervisorAction = Field(
        default=SupervisorAction.PENDING,
        description="Decision: PENDING, APPROVED, or REJECTED"
    )
    status: SubmissionStatus = Field(
        default=SubmissionStatus.INCOMPLETE,
        description="Workflow status: incomplete, draft, or submitted"
    )
    submitted_at: Optional[datetime] = Field(None, alias="submittedAt")
    reviewed_at: Optional[datetime] = Field(None, alias="reviewedAt")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"from_attributes": True, "populate_by_name": True}
```

### 5.6. Response Schema (API)

```python
class SupervisorFeedback(SupervisorFeedbackInDB):
    """
    Basic supervisor feedback schema for API responses.
    @see api-contract.md Section 5.1
    """
    pass
```

### 5.7. Detail Schema (Single Item)

```python
class SupervisorFeedbackDetail(SupervisorFeedbackInDB):
    """
    Detailed supervisor feedback schema for single item views.
    @see api-contract.md Section 5.3

    NOTE: Goal title/description should be extracted from self_assessment.goal
    using get_goal_title() and get_goal_description() helpers.
    Period name should be extracted from evaluation_period.name.
    """
    # Embedded relationships
    self_assessment: Optional['SelfAssessmentWithGoal'] = Field(
        None,
        alias="selfAssessment",
        description="The self-assessment this feedback is for (includes embedded goal)"
    )
    evaluation_period: Optional['EvaluationPeriod'] = Field(
        None,
        alias="evaluationPeriod",
        description="The evaluation period this feedback belongs to"
    )
    subordinate: Optional['UserProfileOption'] = Field(
        None,
        description="Subordinate who created the self-assessment"
    )
    supervisor: Optional['UserProfileOption'] = Field(
        None,
        description="Supervisor providing the feedback"
    )

    # Feedback state information
    is_editable: bool = Field(
        True,
        alias="isEditable",
        description="Whether this feedback can still be edited"
    )
    is_overdue: bool = Field(
        False,
        alias="isOverdue",
        description="Whether this feedback is past the deadline"
    )
    days_until_deadline: Optional[int] = Field(
        None,
        alias="daysUntilDeadline",
        description="Days remaining until feedback deadline"
    )

    model_config = {"from_attributes": True, "populate_by_name": True}
```

### 5.8. List Schema (Paginated)

```python
class SupervisorFeedbackList(PaginatedResponse[SupervisorFeedback]):
    """Schema for paginated supervisor feedback list responses."""
    pass
```

---

## 6. Helper Functions

### 6.1. Goal Title Extraction

```python
# backend/app/schemas/helpers.py

from typing import Optional
from .goal import GoalResponse


def get_goal_title(goal: GoalResponse, competency_names: Optional[list[str]] = None) -> str:
    """
    Extract goal title based on goal category.
    - Performance goals: use goal.title
    - Competency goals: use competency names or fallback
    """
    if goal.goal_category == 'コンピテンシー':
        if competency_names:
            return ', '.join(competency_names)
        return 'コンピテンシー目標'
    else:
        return goal.title or '業績目標'


def get_goal_description(goal: GoalResponse) -> Optional[str]:
    """
    Extract goal description based on goal category.
    - Performance goals: use specific_goal_text
    - Competency goals: use action_plan
    """
    if goal.goal_category == 'コンピテンシー':
        return goal.action_plan
    else:
        return goal.specific_goal_text
```

### 6.2. Status Helpers

```python
# backend/app/schemas/helpers.py

from .common import SelfAssessmentStatus


def is_self_assessment_editable(status: SelfAssessmentStatus) -> bool:
    """Check if self-assessment can be edited."""
    return status == SelfAssessmentStatus.DRAFT


def is_self_assessment_finalized(status: SelfAssessmentStatus) -> bool:
    """Check if self-assessment is finalized (approved or rejected)."""
    return status in (SelfAssessmentStatus.APPROVED, SelfAssessmentStatus.REJECTED)


def is_resubmission(previous_id: Optional[str]) -> bool:
    """Check if self-assessment is a resubmission (has rejection history)."""
    return previous_id is not None
```

---

## 7. Field Validators

### 7.1. Rating Code Auto-Calculation

```python
# In SelfAssessmentInDB or service layer

from pydantic import field_validator
from .common import RatingCode, RATING_CODE_VALUES


class SelfAssessmentInDB(SelfAssessmentBase):
    # ... fields ...

    @field_validator('self_rating', mode='before')
    @classmethod
    def calculate_rating_from_code(cls, v, info):
        """
        Auto-calculate self_rating from self_rating_code.
        If self_rating_code is provided, calculate the numeric value.
        """
        data = info.data
        if 'self_rating_code' in data and data['self_rating_code']:
            code = data['self_rating_code']
            if isinstance(code, str):
                code = RatingCode(code)
            return RATING_CODE_VALUES.get(code, v)
        return v
```

### 7.2. Submission Validation

```python
# In service layer (not schema)

def validate_self_assessment_submission(
    self_rating_code: Optional[RatingCode],
    self_comment: Optional[str]
) -> None:
    """
    Validate self-assessment before submission.
    Both rating code and comment are required.
    """
    errors = []
    if not self_rating_code:
        errors.append("selfRatingCode is required for submission")
    if not self_comment:
        errors.append("selfComment is required for submission")
    if errors:
        raise ValueError("; ".join(errors))
```

---

## 8. API Contract Alignment

### 8.1. Self-Assessment Type Comparison

| API Contract Field | Pydantic Field | Type | Status |
|-------------------|----------------|------|--------|
| `id` | `id` | `UUID` | ✅ Aligned |
| `goalId` | `goal_id` | `UUID` | ✅ Aligned |
| `periodId` | `period_id` | `UUID` | ✅ Aligned |
| `previousSelfAssessmentId` | `previous_self_assessment_id` | `UUID \| None` | ✅ **NEW** |
| `selfRatingCode` | `self_rating_code` | `RatingCode` | ✅ **NEW** |
| `selfRating` | `self_rating` | `float (0-7)` | ✅ **UPDATED** |
| `selfComment` | `self_comment` | `str \| None` | ✅ Aligned |
| `status` | `status` | `SelfAssessmentStatus` | ✅ **UPDATED** (4 states) |
| `submittedAt` | `submitted_at` | `datetime \| None` | ✅ Aligned |
| `createdAt` | `created_at` | `datetime` | ✅ Aligned |
| `updatedAt` | `updated_at` | `datetime` | ✅ Aligned |

### 8.2. Supervisor Feedback Type Comparison

| API Contract Field | Pydantic Field | Type | Status |
|-------------------|----------------|------|--------|
| `id` | `id` | `UUID` | ✅ Aligned |
| `selfAssessmentId` | `self_assessment_id` | `UUID` | ✅ Aligned |
| `periodId` | `period_id` | `UUID` | ✅ Aligned |
| `supervisorId` | `supervisor_id` | `UUID` | ✅ Aligned |
| `subordinateId` | `subordinate_id` | `UUID` | ✅ **NEW** |
| `supervisorRatingCode` | `supervisor_rating_code` | `RatingCode` | ✅ **NEW** |
| `supervisorRating` | `supervisor_rating` | `float (0-7)` | ✅ **UPDATED** |
| `supervisorComment` | `supervisor_comment` | `str \| None` | ✅ Aligned |
| `action` | `action` | `SupervisorAction` | ✅ **NEW** |
| `status` | `status` | `SubmissionStatus` | ✅ Aligned |
| `submittedAt` | `submitted_at` | `datetime \| None` | ✅ Aligned |
| `reviewedAt` | `reviewed_at` | `datetime \| None` | ✅ **NEW** |
| `createdAt` | `created_at` | `datetime` | ✅ Aligned |
| `updatedAt` | `updated_at` | `datetime` | ✅ Aligned |

---

## 9. Frontend Type Alignment

### 9.1. Field Mapping (Pydantic ↔ TypeScript)

| Pydantic (Backend) | TypeScript (Frontend) | Alias | Aligned? |
|-------------------|----------------------|-------|----------|
| `self_rating_code: RatingCode` | `selfRatingCode: RatingCode` | `selfRatingCode` | ✅ |
| `self_rating: float` | `selfRating: number` | `selfRating` | ✅ |
| `self_comment: str` | `selfComment: string` | `selfComment` | ✅ |
| `previous_self_assessment_id: UUID` | `previousSelfAssessmentId: UUID` | `previousSelfAssessmentId` | ✅ |
| `status: SelfAssessmentStatus` | `status: SelfAssessmentStatus` | - | ✅ |
| `goal_id: UUID` | `goalId: UUID` | `goalId` | ✅ |
| `period_id: UUID` | `periodId: UUID` | `periodId` | ✅ |

---

## 10. Validation Examples

### 10.1. Valid Self-Assessment Update

```python
from app.schemas.self_assessment import SelfAssessmentUpdate
from app.schemas.common import RatingCode

# Valid update - using rating code
valid_update = SelfAssessmentUpdate(
    self_rating_code=RatingCode.A_PLUS,
    self_comment="目標を120%達成しました。具体的には..."
)

# Using alias (from frontend)
valid_update_alias = SelfAssessmentUpdate.model_validate({
    "selfRatingCode": "A+",
    "selfComment": "目標を120%達成しました。"
})
```

### 10.2. Invalid - Rating Code

```python
# Invalid rating code - should raise ValidationError
try:
    invalid = SelfAssessmentUpdate.model_validate({
        "selfRatingCode": "X"  # Invalid code
    })
except ValidationError as e:
    print(e)  # "Input should be 'SS', 'S', 'A+', 'A', 'A-', 'B', 'C' or 'D'"
```

### 10.3. Supervisor Feedback Submit - Approval

```python
from app.schemas.supervisor_feedback import SupervisorFeedbackSubmit
from app.schemas.supervisor_review import SupervisorAction
from app.schemas.common import RatingCode

# Valid approval - rating code required
valid_approval = SupervisorFeedbackSubmit(
    action=SupervisorAction.APPROVED,
    supervisor_rating_code=RatingCode.A,
    supervisor_comment="良い成果です。"  # Optional for approval
)

# Invalid approval - missing rating code
try:
    invalid_approval = SupervisorFeedbackSubmit(
        action=SupervisorAction.APPROVED,
        supervisor_comment="良い成果です。"
        # Missing supervisor_rating_code
    )
except ValidationError as e:
    print(e)  # "supervisor_rating_code is required when approving"
```

### 10.4. Supervisor Feedback Submit - Rejection

```python
# Valid rejection - comment required
valid_rejection = SupervisorFeedbackSubmit(
    action=SupervisorAction.REJECTED,
    supervisor_comment="具体的な数字を追加してください。"
)

# Invalid rejection - missing comment
try:
    invalid_rejection = SupervisorFeedbackSubmit(
        action=SupervisorAction.REJECTED
        # Missing supervisor_comment
    )
except ValidationError as e:
    print(e)  # "supervisor_comment is required when rejecting"
```

---

## 11. Unit Tests

**File:** `backend/tests/schemas/test_self_assessment_schemas.py`

```python
import pytest
from uuid import uuid4
from datetime import datetime
from app.schemas.self_assessment import (
    SelfAssessmentUpdate,
    SelfAssessmentInDB,
    SelfAssessment,
    SelfAssessmentDetail,
)
from app.schemas.supervisor_feedback import (
    SupervisorFeedbackCreate,
    SupervisorFeedbackUpdate,
    SupervisorFeedbackSubmit,
)
from app.schemas.common import (
    SelfAssessmentStatus,
    RatingCode,
    RATING_CODE_VALUES,
)
from app.schemas.supervisor_review import SupervisorAction
from pydantic import ValidationError


class TestSelfAssessmentSchemas:
    """Tests for SelfAssessment Pydantic schemas."""

    def test_rating_code_values(self):
        """Test rating code to numeric value mapping."""
        assert RATING_CODE_VALUES[RatingCode.SS] == 7.0
        assert RATING_CODE_VALUES[RatingCode.S] == 6.0
        assert RATING_CODE_VALUES[RatingCode.A] == 4.0
        assert RATING_CODE_VALUES[RatingCode.B] == 2.0
        assert RATING_CODE_VALUES[RatingCode.C] == 1.0

    def test_update_with_valid_rating_code(self):
        """Test SelfAssessmentUpdate with valid rating code."""
        update = SelfAssessmentUpdate(
            self_rating_code=RatingCode.A_PLUS,
            self_comment="Great achievement"
        )
        assert update.self_rating_code == RatingCode.A_PLUS
        assert update.self_comment == "Great achievement"

    def test_update_with_alias(self):
        """Test SelfAssessmentUpdate using camelCase aliases."""
        update = SelfAssessmentUpdate.model_validate({
            "selfRatingCode": "A+",
            "selfComment": "Great achievement"
        })
        assert update.self_rating_code == RatingCode.A_PLUS

    def test_update_with_invalid_rating_code(self):
        """Test SelfAssessmentUpdate rejects invalid rating code."""
        with pytest.raises(ValidationError) as exc_info:
            SelfAssessmentUpdate.model_validate({
                "selfRatingCode": "X"
            })
        assert "Input should be" in str(exc_info.value)

    def test_self_assessment_status_enum(self):
        """Test 4-state SelfAssessmentStatus enum."""
        assert SelfAssessmentStatus.DRAFT.value == "draft"
        assert SelfAssessmentStatus.SUBMITTED.value == "submitted"
        assert SelfAssessmentStatus.APPROVED.value == "approved"
        assert SelfAssessmentStatus.REJECTED.value == "rejected"


class TestSupervisorFeedbackSchemas:
    """Tests for SupervisorFeedback Pydantic schemas."""

    def test_submit_approval_requires_rating(self):
        """Test approval requires rating code."""
        with pytest.raises(ValidationError) as exc_info:
            SupervisorFeedbackSubmit(
                action=SupervisorAction.APPROVED,
                supervisor_comment="Good work"
            )
        assert "supervisor_rating_code is required" in str(exc_info.value)

    def test_submit_approval_valid(self):
        """Test valid approval submission."""
        submit = SupervisorFeedbackSubmit(
            action=SupervisorAction.APPROVED,
            supervisor_rating_code=RatingCode.A,
            supervisor_comment="Good work"
        )
        assert submit.action == SupervisorAction.APPROVED
        assert submit.supervisor_rating_code == RatingCode.A

    def test_submit_rejection_requires_comment(self):
        """Test rejection requires comment."""
        with pytest.raises(ValidationError) as exc_info:
            SupervisorFeedbackSubmit(
                action=SupervisorAction.REJECTED
            )
        assert "supervisor_comment is required" in str(exc_info.value)

    def test_submit_rejection_valid(self):
        """Test valid rejection submission."""
        submit = SupervisorFeedbackSubmit(
            action=SupervisorAction.REJECTED,
            supervisor_comment="Please add more details"
        )
        assert submit.action == SupervisorAction.REJECTED
        assert submit.supervisor_comment == "Please add more details"
```

---

## 12. Migration Notes

### 12.1. Breaking Changes

1. **Status enum changed**: `SubmissionStatus` → `SelfAssessmentStatus` for self-assessments
   - Added: `approved`, `rejected` states

2. **Rating system changed**: `self_rating (0-100)` → `self_rating_code + self_rating (0-7)`
   - Need to migrate existing data

3. **New required field**: `subordinate_id` on SupervisorFeedback

### 12.2. Database Migration

```python
# Alembic migration example

def upgrade():
    # Add new columns
    op.add_column('self_assessments', sa.Column(
        'previous_self_assessment_id',
        postgresql.UUID(as_uuid=True),
        nullable=True
    ))
    op.add_column('self_assessments', sa.Column(
        'self_rating_code',
        sa.String(2),
        nullable=True
    ))

    # Update status column to support 4 states
    op.execute("""
        ALTER TABLE self_assessments
        DROP CONSTRAINT IF EXISTS self_assessments_status_check;

        ALTER TABLE self_assessments
        ADD CONSTRAINT self_assessments_status_check
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
    """)

    # Add subordinate_id to supervisor_feedbacks
    op.add_column('supervisor_feedbacks', sa.Column(
        'subordinate_id',
        postgresql.UUID(as_uuid=True),
        nullable=True
    ))
    op.add_column('supervisor_feedbacks', sa.Column(
        'supervisor_rating_code',
        sa.String(2),
        nullable=True
    ))
    op.add_column('supervisor_feedbacks', sa.Column(
        'action',
        sa.String(10),
        nullable=False,
        server_default='PENDING'
    ))
    op.add_column('supervisor_feedbacks', sa.Column(
        'reviewed_at',
        sa.DateTime(timezone=True),
        nullable=True
    ))


def downgrade():
    # Remove new columns
    op.drop_column('self_assessments', 'previous_self_assessment_id')
    op.drop_column('self_assessments', 'self_rating_code')
    op.drop_column('supervisor_feedbacks', 'subordinate_id')
    op.drop_column('supervisor_feedbacks', 'supervisor_rating_code')
    op.drop_column('supervisor_feedbacks', 'action')
    op.drop_column('supervisor_feedbacks', 'reviewed_at')
```

---

## 13. Validation Checklist

- [x] All fields match API Contract
- [x] Field names use snake_case (Python convention)
- [x] Aliases configured for camelCase JSON (using `alias=`)
- [x] Field validators added for all business rules
- [x] Model validators added for complex rules (SupervisorFeedbackSubmit)
- [x] Docstrings added to all schemas
- [x] Config classes properly set (`from_attributes`, `populate_by_name`)
- [x] Schema examples added
- [x] Unit test examples provided
- [ ] Types exported in `__init__.py`
- [ ] All tests passing (pending implementation)
- [ ] Database migration created (pending implementation)

---

## 14. Forward References

```python
# backend/app/schemas/self_assessment.py (at the end of file)

# ========================================
# FORWARD REFERENCES UPDATE
# ========================================

def rebuild_models():
    """Rebuild models with forward references when all schemas are loaded."""
    try:
        from .goal import GoalResponse
        from .evaluation import EvaluationPeriod
        from .user import UserProfileOption

        # Use imports to satisfy linter
        _ = GoalResponse, EvaluationPeriod, UserProfileOption

        # Rebuild models
        SelfAssessmentDetail.model_rebuild()
        SelfAssessmentWithGoal.model_rebuild()
    except ImportError:
        pass
    except Exception as e:
        print(f"Warning: Could not rebuild forward references: {e}")


rebuild_models()
```

---

## References

- API Contract: [api-contract.md](./api-contract.md)
- Domain Model: [domain-model.md](./domain-model.md)
- Frontend Types: [frontend-typescript-types.md](./frontend-typescript-types.md)
- Current Schema: `backend/app/schemas/self_assessment.py`
- SupervisorReview Pattern: `backend/app/schemas/supervisor_review.py`
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)
