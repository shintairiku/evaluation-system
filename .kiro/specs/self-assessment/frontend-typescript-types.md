# Frontend TypeScript Types: Self-Assessment

**Status:** Updated
**Last Updated:** 2025-01-05
**Related Issues:** #416

---

## 1. Overview

This document defines the TypeScript types for the Self-Assessment feature, ensuring alignment with the API Contract and backend Pydantic schemas. The types support:

- **4-state system**: draft → submitted → approved/rejected
- **Letter grade system**: SS, S, A+, A, A-, B, C, D (0.0-7.0)
- **Rejection history tracking**: via `previousSelfAssessmentId`
- **Supervisor feedback**: with action (PENDING/APPROVED/REJECTED) and status (incomplete/draft/submitted)

---

## 2. Current Implementation Analysis

**File:** `frontend/src/api/types/self-assessment.ts`

### 2.1. Existing Types (Before Update)

```typescript
// ❌ Current: Uses 0-100 scale
selfRating?: number; // 0-100

// ❌ Current: Only 2 states
status: SubmissionStatus; // 'draft' | 'submitted'

// ❌ Missing: previousSelfAssessmentId
// ❌ Missing: selfRatingCode (letter grade)
// ❌ Missing: approved/rejected states
```

### 2.2. Required Changes

| Change | Current | Updated |
|--------|---------|---------|
| Rating system | `selfRating: number (0-100)` | `selfRatingCode: RatingCode` + `selfRating: number (0-7)` |
| Status enum | `draft \| submitted` | `draft \| submitted \| approved \| rejected` |
| History tracking | ❌ Missing | `previousSelfAssessmentId?: UUID` |
| Goal relation | `goal?: unknown` | `goal?: GoalResponse` (typed) |

---

## 3. Type Definitions (Updated)

### 3.1. Common Types

```typescript
// frontend/src/api/types/common.ts

export type UUID = string;

/**
 * Self-Assessment status enum (4 states)
 * @see domain-model.md Section 5 - State Transitions
 */
export enum SelfAssessmentStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Letter grade rating codes
 * Maps to numeric values 0.0-7.0
 * @see domain-model.md Section 2.1 - Grading System
 */
export type RatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';

/**
 * Rating code to numeric value mapping
 */
export const RATING_CODE_VALUES: Record<RatingCode, number> = {
  'SS': 7.0,
  'S': 6.0,
  'A+': 5.0,
  'A': 4.0,
  'A-': 3.0,
  'B': 2.0,
  'C': 1.0,
  'D': 0.0,
};

/**
 * Rating code display labels (Japanese)
 */
export const RATING_CODE_LABELS: Record<RatingCode, string> = {
  'SS': 'SS - 卓越',
  'S': 'S - 優秀',
  'A+': 'A+ - 非常に良い+',
  'A': 'A - 非常に良い',
  'A-': 'A- - 良い',
  'B': 'B - 標準',
  'C': 'C - 期待以下',
  'D': 'D - 不十分',
};

/**
 * Supervisor feedback action enum
 */
export enum SupervisorFeedbackAction {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Supervisor feedback workflow status enum
 */
export enum SupervisorFeedbackStatus {
  INCOMPLETE = 'incomplete',
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

/**
 * Goal category types (Japanese)
 */
export type GoalCategory = '業績目標' | 'コンピテンシー' | 'コアバリュー';
```

### 3.2. Self-Assessment Types

```typescript
// frontend/src/api/types/self-assessment.ts

import type {
  UUID,
  RatingCode,
  SelfAssessmentStatus,
  GoalCategory,
  PaginatedResponse
} from './common';

/**
 * Base self-assessment fields (editable by employee)
 */
export interface SelfAssessmentBase {
  /** Letter grade: SS, S, A+, A, A-, B, C, D */
  selfRatingCode?: RatingCode;
  /** Employee's narrative self-assessment comment */
  selfComment?: string;
}

/**
 * Self-assessment entity (API response)
 * @see api-contract.md Section 4.1
 */
export interface SelfAssessment extends SelfAssessmentBase {
  /** Unique identifier */
  id: UUID;
  /** Reference to the goal being assessed */
  goalId: UUID;
  /** Reference to the evaluation period */
  periodId: UUID;
  /** Reference to previous self-assessment (for rejection history) */
  previousSelfAssessmentId?: UUID;
  /** Numeric rating (0.0-7.0), auto-calculated from selfRatingCode */
  selfRating?: number;
  /** Current status: draft, submitted, approved, or rejected */
  status: SelfAssessmentStatus;
  /** Timestamp when assessment was submitted */
  submittedAt?: string;
  /** Record creation timestamp */
  createdAt: string;
  /** Last modification timestamp */
  updatedAt: string;
}

/**
 * Detailed self-assessment with additional context
 * Used for single item views (GET /self-assessments/:id)
 * @see api-contract.md Section 4.4
 */
export interface SelfAssessmentDetail extends SelfAssessment {
  // Assessment state information
  /** Whether this assessment can still be edited */
  isEditable: boolean;
  /** Whether this assessment is past the deadline */
  isOverdue: boolean;
  /** Days remaining until assessment deadline */
  daysUntilDeadline?: number;

  // Goal context (extracted from goal relationship)
  /** Category of the goal being assessed */
  goalCategory?: GoalCategory;
  /** Current status of the goal */
  goalStatus?: string;

  // Related information (optional, may be populated by backend)
  /** The goal being assessed - use goal.title for Performance, calculate for Competency */
  goal?: GoalResponse;
  evaluationPeriod?: unknown;
  employee?: unknown;
}

/**
 * Self-assessment with embedded goal information (for list views)
 * Goal title should be extracted using getGoalTitle() helper
 */
export interface SelfAssessmentWithGoal extends SelfAssessment {
  goal: GoalResponse;
}

/**
 * Request body for updating a self-assessment
 * @see api-contract.md Section 4.5
 */
export interface SelfAssessmentUpdate {
  /** Letter grade: SS, S, A+, A, A-, B, C, D */
  selfRatingCode?: RatingCode;
  /** Employee's narrative self-assessment comment */
  selfComment?: string;
}

/**
 * Paginated list of self-assessments
 * @see api-contract.md Section 4.1
 */
export interface SelfAssessmentList extends PaginatedResponse<SelfAssessment> {}

/**
 * Query parameters for fetching self-assessments
 */
export interface SelfAssessmentQueryParams {
  periodId?: UUID;
  userId?: UUID;
  status?: SelfAssessmentStatus;
  goalCategory?: GoalCategory;
  page?: number;
  limit?: number;
}

/**
 * Rejection history item (for history chain display)
 * @see api-contract.md Section 4.8
 */
export interface SelfAssessmentHistoryItem {
  id: UUID;
  status: SelfAssessmentStatus;
  selfRatingCode?: RatingCode;
  selfComment?: string;
  previousSelfAssessmentId?: UUID;
  submittedAt?: string;
  /** Supervisor's comment (from SupervisorFeedback) */
  supervisorComment?: string;
  /** Supervisor's action (from SupervisorFeedback) */
  supervisorAction?: SupervisorFeedbackAction;
}

/**
 * Rejection history response
 */
export interface SelfAssessmentHistory {
  items: SelfAssessmentHistoryItem[];
  total: number;
}
```

### 3.3. Supervisor Feedback Types

```typescript
// frontend/src/api/types/supervisor-feedback.ts

import type {
  UUID,
  RatingCode,
  SupervisorFeedbackAction,
  SupervisorFeedbackStatus,
  GoalCategory,
  PaginatedResponse
} from './common';
import type { SelfAssessment } from './self-assessment';

/**
 * Base supervisor feedback fields (editable by supervisor)
 */
export interface SupervisorFeedbackBase {
  /** Supervisor's letter grade: SS, S, A+, A, A-, B, C, D */
  supervisorRatingCode?: RatingCode;
  /** Supervisor's feedback comment */
  supervisorComment?: string;
}

/**
 * Supervisor feedback entity (API response)
 * @see api-contract.md Section 5.1
 */
export interface SupervisorFeedback extends SupervisorFeedbackBase {
  /** Unique identifier */
  id: UUID;
  /** Reference to the self-assessment */
  selfAssessmentId: UUID;
  /** Reference to the evaluation period */
  periodId: UUID;
  /** Supervisor who created this feedback */
  supervisorId: UUID;
  /** Subordinate who created the self-assessment */
  subordinateId: UUID;
  /** Numeric rating (0.0-7.0), auto-calculated */
  supervisorRating?: number;
  /** Decision: PENDING, APPROVED, or REJECTED */
  action: SupervisorFeedbackAction;
  /** Workflow status: incomplete, draft, or submitted */
  status: SupervisorFeedbackStatus;
  /** Timestamp when feedback was submitted */
  submittedAt?: string;
  /** Timestamp when review was completed */
  reviewedAt?: string;
  /** Record creation timestamp */
  createdAt: string;
  /** Last modification timestamp */
  updatedAt: string;
}

/**
 * Detailed supervisor feedback with additional context
 * @see api-contract.md Section 5.3
 */
export interface SupervisorFeedbackDetail extends SupervisorFeedback {
  /** The self-assessment this feedback is for */
  selfAssessment?: SelfAssessment;
  /** Whether this feedback can still be edited */
  isEditable: boolean;
  /** Whether this feedback is past the deadline */
  isOverdue: boolean;
  /** Days remaining until feedback deadline */
  daysUntilDeadline?: number;
  /** Category of the goal being evaluated */
  goalCategory?: GoalCategory;
  /** Title of the goal being evaluated */
  goalTitle?: string;
  /** Name of the evaluation period */
  evaluationPeriodName?: string;
  /** Subordinate information */
  subordinate?: {
    id: UUID;
    name: string;
    email?: string;
  };
  /** Supervisor information */
  supervisor?: {
    id: UUID;
    name: string;
    email?: string;
  };
}

/**
 * Request body for creating supervisor feedback
 * @see api-contract.md Section 5.2
 */
export interface SupervisorFeedbackCreate extends SupervisorFeedbackBase {
  /** Reference to the self-assessment */
  selfAssessmentId: UUID;
  /** Reference to the evaluation period */
  periodId: UUID;
  /** Initial action (usually PENDING) */
  action: SupervisorFeedbackAction;
  /** Initial status */
  status: SupervisorFeedbackStatus;
}

/**
 * Request body for updating supervisor feedback
 * @see api-contract.md Section 5.4
 */
export interface SupervisorFeedbackUpdate {
  /** Supervisor's letter grade */
  supervisorRatingCode?: RatingCode;
  /** Supervisor's feedback comment */
  supervisorComment?: string;
}

/**
 * Request body for submitting supervisor feedback (approve/reject)
 * @see api-contract.md Section 5.5
 */
export interface SupervisorFeedbackSubmit {
  /** Decision: APPROVED or REJECTED */
  action: 'APPROVED' | 'REJECTED';
  /** Rating code (required for APPROVED) */
  supervisorRatingCode?: RatingCode;
  /** Comment (required for REJECTED, optional for APPROVED) */
  supervisorComment?: string;
}

/**
 * Paginated list of supervisor feedbacks
 */
export interface SupervisorFeedbackList extends PaginatedResponse<SupervisorFeedback> {}

/**
 * Query parameters for fetching supervisor feedbacks
 */
export interface SupervisorFeedbackQueryParams {
  periodId?: UUID;
  supervisorId?: UUID;
  subordinateId?: UUID;
  status?: SupervisorFeedbackStatus;
  action?: SupervisorFeedbackAction;
  page?: number;
  limit?: number;
}
```

### 3.4. Helper Types and Utilities

```typescript
// frontend/src/api/types/self-assessment-helpers.ts

import type { SelfAssessment, SelfAssessmentStatus } from './self-assessment';

import type { GoalResponse } from './goal';

/**
 * Extract goal title based on goal category
 * - Performance goals: use goal.title
 * - Competency goals: use competency names (requires competency lookup) or fallback
 */
export function getGoalTitle(goal: GoalResponse, competencyNames?: string[]): string {
  if (goal.goalCategory === 'コンピテンシー') {
    // For competency goals, use competency names if available
    if (competencyNames && competencyNames.length > 0) {
      return competencyNames.join(', ');
    }
    return 'コンピテンシー目標';
  } else {
    // For performance goals, use title
    return goal.title || '業績目標';
  }
}

/**
 * Extract goal description based on goal category
 * - Performance goals: use specificGoalText
 * - Competency goals: use actionPlan
 */
export function getGoalDescription(goal: GoalResponse): string | undefined {
  if (goal.goalCategory === 'コンピテンシー') {
    return goal.actionPlan;
  } else {
    return goal.specificGoalText;
  }
}

/**
 * Check if self-assessment is editable
 */
export function isEditable(assessment: SelfAssessment): boolean {
  return assessment.status === 'draft';
}

/**
 * Check if self-assessment is a resubmission (has rejection history)
 */
export function isResubmission(assessment: SelfAssessment): boolean {
  return assessment.previousSelfAssessmentId !== undefined &&
         assessment.previousSelfAssessmentId !== null;
}

/**
 * Check if self-assessment is pending supervisor review
 */
export function isPendingReview(assessment: SelfAssessment): boolean {
  return assessment.status === 'submitted';
}

/**
 * Check if self-assessment is finalized (approved or rejected)
 */
export function isFinalized(assessment: SelfAssessment): boolean {
  return assessment.status === 'approved' || assessment.status === 'rejected';
}

/**
 * Get status badge variant for UI
 */
export function getStatusBadgeVariant(
  status: SelfAssessmentStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'submitted':
      return 'outline';
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
  }
}

/**
 * Get status display label (Japanese)
 */
export function getStatusLabel(status: SelfAssessmentStatus): string {
  switch (status) {
    case 'draft':
      return '下書き';
    case 'submitted':
      return '提出済み';
    case 'approved':
      return '承認済み';
    case 'rejected':
      return '差し戻し';
  }
}

/**
 * Categorize self-assessments by status
 */
export function categorizeSelfAssessments(assessments: SelfAssessment[]): {
  rejected: SelfAssessment[];  // drafts with previousSelfAssessmentId (needs revision)
  pending: SelfAssessment[];   // drafts without previousSelfAssessmentId (not started/in progress)
  submitted: SelfAssessment[]; // awaiting supervisor
  approved: SelfAssessment[];  // finalized
} {
  return {
    rejected: assessments.filter(
      sa => sa.status === 'draft' && sa.previousSelfAssessmentId
    ),
    pending: assessments.filter(
      sa => sa.status === 'draft' && !sa.previousSelfAssessmentId
    ),
    submitted: assessments.filter(sa => sa.status === 'submitted'),
    approved: assessments.filter(sa => sa.status === 'approved'),
  };
}
```

---

## 4. API Contract Alignment

### 4.1. Self-Assessment Type Comparison

| API Contract Field | TypeScript Type | Status |
|-------------------|-----------------|--------|
| `id` | `UUID` | ✅ Aligned |
| `goalId` | `UUID` | ✅ Aligned |
| `periodId` | `UUID` | ✅ Aligned |
| `previousSelfAssessmentId` | `UUID \| undefined` | ✅ **NEW** |
| `selfRatingCode` | `RatingCode` | ✅ **NEW** |
| `selfRating` | `number (0-7)` | ✅ **UPDATED** |
| `selfComment` | `string \| undefined` | ✅ Aligned |
| `status` | `SelfAssessmentStatus` | ✅ **UPDATED** (4 states) |
| `submittedAt` | `string \| undefined` | ✅ Aligned |
| `createdAt` | `string` | ✅ Aligned |
| `updatedAt` | `string` | ✅ Aligned |

### 4.2. Supervisor Feedback Type Comparison

| API Contract Field | TypeScript Type | Status |
|-------------------|-----------------|--------|
| `id` | `UUID` | ✅ Aligned |
| `selfAssessmentId` | `UUID` | ✅ Aligned |
| `periodId` | `UUID` | ✅ Aligned |
| `supervisorId` | `UUID` | ✅ Aligned |
| `subordinateId` | `UUID` | ✅ **NEW** |
| `supervisorRatingCode` | `RatingCode` | ✅ **NEW** |
| `supervisorRating` | `number (0-7)` | ✅ **UPDATED** |
| `supervisorComment` | `string \| undefined` | ✅ Aligned |
| `action` | `SupervisorFeedbackAction` | ✅ **NEW** |
| `status` | `SupervisorFeedbackStatus` | ✅ Aligned |
| `submittedAt` | `string \| undefined` | ✅ Aligned |
| `reviewedAt` | `string \| undefined` | ✅ **NEW** |
| `createdAt` | `string` | ✅ Aligned |
| `updatedAt` | `string` | ✅ Aligned |

---

## 5. Backend Schema Alignment

### 5.1. Field Mapping (TypeScript ↔ Pydantic)

| TypeScript (Frontend) | Pydantic (Backend) | Aligned? |
|----------------------|-------------------|----------|
| `selfRatingCode: RatingCode` | `self_rating_code: str` | ✅ |
| `selfRating: number` | `self_rating: Decimal` | ✅ |
| `selfComment: string` | `self_comment: str` | ✅ |
| `previousSelfAssessmentId: UUID` | `previous_self_assessment_id: UUID` | ✅ |
| `status: SelfAssessmentStatus` | `status: SelfAssessmentStatus` | ✅ |
| `supervisorRatingCode: RatingCode` | `supervisor_rating_code: str` | ✅ |
| `action: SupervisorFeedbackAction` | `action: str` | ✅ |

---

## 6. Usage Examples

### 6.1. Fetching Self-Assessments

```typescript
import { getSelfAssessmentsAction } from '@/api/server-actions/self-assessments';
import type { SelfAssessmentQueryParams } from '@/api/types';
import { categorizeSelfAssessments } from '@/api/types/self-assessment-helpers';

// Fetch self-assessments for current period
const params: SelfAssessmentQueryParams = {
  periodId: currentPeriodId,
  limit: 100,
};

const result = await getSelfAssessmentsAction(params);

if (result.success && result.data) {
  const { rejected, pending, submitted, approved } =
    categorizeSelfAssessments(result.data.items);

  console.log(`Rejected (needs revision): ${rejected.length}`);
  console.log(`Pending (to fill): ${pending.length}`);
  console.log(`Submitted (awaiting review): ${submitted.length}`);
  console.log(`Approved: ${approved.length}`);
}
```

### 6.2. Updating Self-Assessment

```typescript
import { updateSelfAssessmentAction } from '@/api/server-actions/self-assessments';
import type { SelfAssessmentUpdate, RatingCode } from '@/api/types';

const update: SelfAssessmentUpdate = {
  selfRatingCode: 'A+' as RatingCode,
  selfComment: '目標を120%達成しました。具体的には...',
};

const result = await updateSelfAssessmentAction(assessmentId, update);

if (result.success) {
  console.log('Self-assessment updated successfully');
}
```

### 6.3. Submitting Self-Assessment

```typescript
import { submitSelfAssessmentAction } from '@/api/server-actions/self-assessments';

// Submit for supervisor review
const result = await submitSelfAssessmentAction(assessmentId);

if (result.success) {
  // Status changed from 'draft' to 'submitted'
  console.log('Self-assessment submitted for review');
} else {
  // Validation error: selfRatingCode and selfComment are required
  console.error(result.error);
}
```

### 6.4. Supervisor Approving/Rejecting

```typescript
import { submitSupervisorFeedbackAction } from '@/api/server-actions/supervisor-feedbacks';
import type { SupervisorFeedbackSubmit } from '@/api/types';

// Approve
const approveData: SupervisorFeedbackSubmit = {
  action: 'APPROVED',
  supervisorRatingCode: 'A',
  supervisorComment: '良い成果です。', // Optional for approval
};

// Reject (comment is required)
const rejectData: SupervisorFeedbackSubmit = {
  action: 'REJECTED',
  supervisorComment: '具体的な数字を追加してください。',
};

const result = await submitSupervisorFeedbackAction(feedbackId, rejectData);

if (result.success) {
  // Side effects:
  // - SelfAssessment.status → 'rejected'
  // - New draft created with previousSelfAssessmentId
  // - Badge counter updated for employee
}
```

### 6.5. Displaying Rating Badge

```typescript
import { RATING_CODE_VALUES, RATING_CODE_LABELS } from '@/api/types/common';
import type { RatingCode } from '@/api/types';

function RatingBadge({ ratingCode }: { ratingCode: RatingCode }) {
  const value = RATING_CODE_VALUES[ratingCode];
  const label = RATING_CODE_LABELS[ratingCode];

  return (
    <Badge variant={value >= 5 ? 'default' : value >= 3 ? 'secondary' : 'destructive'}>
      {ratingCode} ({value.toFixed(1)})
    </Badge>
  );
}
```

---

## 7. Validation Checklist

- [x] All fields match API Contract
- [x] Field names use camelCase (TypeScript convention)
- [x] Optional/required fields match backend
- [x] JSDoc comments added
- [x] Type mappings documented
- [x] Enums defined for status and rating codes
- [x] Helper functions for common operations
- [x] Usage examples provided
- [ ] Types exported in `index.ts`
- [ ] No TypeScript errors (pending implementation)

---

## 8. Migration Notes

### 8.1. Breaking Changes

1. **Status enum expanded**: `SubmissionStatus` → `SelfAssessmentStatus`
   - Added: `approved`, `rejected`

2. **Rating system changed**: `selfRating (0-100)` → `selfRatingCode + selfRating (0-7)`
   - Need to update all components using `selfRating`

3. **New required field for submission**: `selfComment` is now required

### 8.2. Migration Steps

1. Update `common.ts` with new enums and types
2. Update `self-assessment.ts` with new interface definitions
3. Create `supervisor-feedback.ts` with feedback types
4. Update all components using old `selfRating` (0-100) to use `selfRatingCode`
5. Update form validation to require `selfComment` on submission
6. Add UI for displaying `previousSelfAssessmentId` (rejection indicator)

---

## References

- API Contract: [api-contract.md](./api-contract.md)
- Domain Model: [domain-model.md](./domain-model.md)
- Backend Schema: `backend/app/schemas/self_assessment.py`
- Current Types: `frontend/src/api/types/self-assessment.ts`
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)
