# Frontend TypeScript Types: Self-Assessment

**Status:** Updated
**Last Updated:** 2025-02-03
**Related Issues:** #416, #453

---

## 1. Overview

This document defines the TypeScript types for the Self-Assessment feature, ensuring alignment with the API Contract and backend Pydantic schemas. The types support:

- **3-state system**: draft → submitted → approved
  - Employees can edit self-assessments until supervisor approves
  - No formal rejection - supervisor provides feedback via comments
- **Letter grade system**:
  - **Input Scale (Competency)**: SS, S, A, B, C (5 levels) - for competency evaluations
  - **Input Scale (Quantitative Goals)**: SS, S, A, B, C, D (6 levels) - for quantitative performance goals
  - **Input Scale (Qualitative Goals)**: SS, S, A, B, C (5 levels) - for qualitative performance goals
  - **Output Scale (Final Calculation)**: SS, S, A+, A, A-, B, C (7 levels) - for overall period ratings
- **Supervisor feedback**: with action (PENDING/APPROVED) and status (incomplete/draft/submitted)

---

## 2. Current Implementation Analysis

**File:** `frontend/src/api/types/self-assessment.ts`

### 2.1. Existing Types (Before Update)

```typescript
// ❌ Current: Uses 0-100 scale
selfRating?: number; // 0-100

// ❌ Current: Only 2 states
status: SubmissionStatus; // 'draft' | 'submitted'

// ❌ Missing: selfRatingCode (letter grade)
// ❌ Missing: approved state
```

### 2.2. Required Changes

| Change | Current | Updated |
|--------|---------|---------|
| Rating system | `selfRating: number (0-100)` | `selfRatingCode: RatingCode` + `selfRating: number (0-7)` |
| Status enum | `draft \| submitted` | `draft \| submitted \| approved` (3 states) |
| Editability | Fixed after submission | Editable until supervisor approves |
| Goal relation | `goal?: unknown` | `goal?: GoalResponse` (typed) |

---

## 3. Type Definitions (Updated)

### 3.1. Common Types

```typescript
// frontend/src/api/types/common.ts

export type UUID = string;

/**
 * Self-Assessment status enum (3 states)
 * Employee can edit until supervisor approves
 * @see domain-model.md Section 5 - State Transitions
 */
export enum SelfAssessmentStatus {
  DRAFT = 'draft',          // Employee is still working on it
  SUBMITTED = 'submitted',  // Submitted for supervisor review, but still editable by employee
  APPROVED = 'approved',    // Approved by supervisor, locked from editing
}

/**
 * Competency rating codes (5 levels - no D grade)
 * Used for コンピテンシー (Competency) evaluations
 * Maps to numeric values 1.0-7.0
 * @see domain-model.md Section 4.2 - Rating Validation
 */
export type CompetencyRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C';

/**
 * Final calculated rating codes (System Output Scale - 7 levels)
 * Includes intermediate grades A+, A- for precise final evaluation
 * Used for overall period performance ratings
 * @see domain-model.md Section 4.2 - Rating Validation
 */
export type FinalRatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C';

/**
 * Qualitative goal rating codes (5 levels - no D grade)
 * Used for 定性目標 (Qualitative Performance Goals) assessments
 */
export type QualitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C';

/**
 * Quantitative goal rating codes (6 levels - includes D grade)
 * Used for 定量目標 (Quantitative Performance Goals) assessments
 */
export type QuantitativeRatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

/**
 * General rating code type (union of all rating codes)
 * Use specific types (CompetencyRatingCode, QualitativeRatingCode, QuantitativeRatingCode) when possible
 */
export type RatingCode = CompetencyRatingCode | QuantitativeRatingCode;

/**
 * Competency rating code to numeric value mapping (5 levels)
 */
export const COMPETENCY_RATING_VALUES: Record<CompetencyRatingCode, number> = {
  'SS': 7.0,
  'S': 6.0,
  'A': 4.0,
  'B': 2.0,
  'C': 1.0,
};

/**
 * Quantitative rating code to numeric value mapping (6 levels)
 */
export const QUANTITATIVE_RATING_VALUES: Record<QuantitativeRatingCode, number> = {
  'SS': 7.0,
  'S': 6.0,
  'A': 4.0,
  'B': 2.0,
  'C': 1.0,
  'D': 0.0,
};

/**
 * Final rating code to numeric value mapping (7-level output scale)
 */
export const FINAL_RATING_CODE_VALUES: Record<FinalRatingCode, number> = {
  'SS': 7.0,
  'S': 6.0,
  'A+': 5.0,
  'A': 4.0,
  'A-': 3.0,
  'B': 2.0,
  'C': 1.0,
};

/**
 * Competency rating codes array (for コンピテンシー)
 */
export const COMPETENCY_RATING_CODES: CompetencyRatingCode[] = ['SS', 'S', 'A', 'B', 'C'];

/**
 * Qualitative rating codes array (for 定性目標)
 */
export const QUALITATIVE_RATING_CODES: QualitativeRatingCode[] = ['SS', 'S', 'A', 'B', 'C'];

/**
 * Quantitative rating codes array (for 定量目標)
 */
export const QUANTITATIVE_RATING_CODES: QuantitativeRatingCode[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

/**
 * Supervisor feedback action enum
 * Note: REJECTED removed - supervisor provides feedback via comments,
 * employee can edit until approval
 */
export enum SupervisorFeedbackAction {
  PENDING = 'PENDING',      // Supervisor reviewing, no decision yet
  APPROVED = 'APPROVED',    // Supervisor approved, locks the self-assessment
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

/**
 * Granular per-action ratings for コンピテンシー goals (JSONB).
 * Each ideal action gets an individual rating, averaged per competency, then overall.
 */
export interface RatingData {
  /** Individual rating per ideal action, keyed by competency UUID then action number (1-5) */
  action_ratings: Record<string, Record<string, { code: RatingCode; value: number }>>;
  /** Calculated average per competency */
  competency_averages: Record<string, number>;
  /** Calculated average across all competencies */
  overall_average: number;
}
```

### 3.2. Self-Assessment Types

```typescript
// frontend/src/api/types/self-assessment.ts

import type {
  UUID,
  RatingCode,
  SelfAssessmentStatus,
  SupervisorFeedbackAction,
  PaginatedResponse
} from './common';
import type { GoalResponse } from './goal';
import type { EvaluationPeriod } from './evaluation-period';
import type { UserProfileOption } from './user';

/**
 * Base self-assessment fields (editable by employee)
 */
export interface SelfAssessmentBase {
  /** Letter grade: SS, S, A, B, C, D (6-level input scale) */
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
  /** Numeric rating (0.0-7.0), auto-calculated from selfRatingCode */
  selfRating?: number;
  /** Granular per-action ratings for コンピテンシー goals (JSONB). null for 業績目標. */
  ratingData?: RatingData | null;
  /** Current status: draft, submitted, or approved */
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
 *
 * NOTE: Goal title should be extracted using getGoalTitle() helper:
 * - Performance goals: use goal.title
 * - Competency goals: use competency names or fallback
 */
export interface SelfAssessmentDetail extends SelfAssessment {
  // Assessment state information
  /** Whether this assessment can still be edited */
  isEditable: boolean;
  /** Whether this assessment is past the deadline */
  isOverdue: boolean;
  /** Days remaining until assessment deadline */
  daysUntilDeadline?: number;

  // Goal context (convenience fields, extracted from goal relationship)
  /** Category of the goal being assessed (e.g., '業績目標', 'コンピテンシー') */
  goalCategory?: string;
  /** Current status of the goal */
  goalStatus?: string;

  // Embedded relationships
  /** The goal being assessed - use getGoalTitle() helper to extract title */
  goal?: GoalResponse;
  /** The evaluation period this assessment belongs to */
  evaluationPeriod?: EvaluationPeriod;
  /** The employee who owns this assessment */
  employee?: UserProfileOption;
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
  /** Letter grade: SS, S, A, B, C, D (6-level input scale) */
  selfRatingCode?: RatingCode;
  /** Employee's narrative self-assessment comment */
  selfComment?: string;
  /** Granular per-action ratings for コンピテンシー goals */
  ratingData?: RatingData | null;
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
  goalCategory?: string;
  page?: number;
  limit?: number;
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
  PaginatedResponse
} from './common';
import type { SelfAssessmentWithGoal } from './self-assessment';
import type { EvaluationPeriod } from './evaluation-period';
import type { UserProfileOption } from './user';

/**
 * Base supervisor feedback fields (editable by supervisor)
 */
export interface SupervisorFeedbackBase {
  /** Supervisor's letter grade: SS, S, A, B, C, D (6-level input scale) */
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
  /** Supervisor's per-action rating suggestions for コンピテンシー goals. Rarely used. null for 業績目標. */
  ratingData?: RatingData | null;
  /** Decision: PENDING or APPROVED */
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
 *
 * NOTE: Goal title/description should be extracted from selfAssessment.goal
 * using getGoalTitle() and getGoalDescription() helpers.
 * Period name should be extracted from evaluationPeriod.name.
 */
export interface SupervisorFeedbackDetail extends SupervisorFeedback {
  /** The self-assessment this feedback is for (includes goal) */
  selfAssessment?: SelfAssessmentWithGoal;
  /** The evaluation period this feedback belongs to */
  evaluationPeriod?: EvaluationPeriod;
  /** Whether this feedback can still be edited */
  isEditable: boolean;
  /** Whether this feedback is past the deadline */
  isOverdue: boolean;
  /** Days remaining until feedback deadline */
  daysUntilDeadline?: number;
  /** Subordinate who created the self-assessment */
  subordinate?: UserProfileOption;
  /** Supervisor providing the feedback */
  supervisor?: UserProfileOption;
}

// NOTE: EvaluationPeriod and UserProfileOption are imported from existing types:
// - EvaluationPeriod from './evaluation-period'
// - UserProfileOption from './user'

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
  /** Supervisor's letter grade: SS, S, A, B, C, D (6-level input scale) */
  supervisorRatingCode?: RatingCode;
  /** Supervisor's feedback comment */
  supervisorComment?: string;
  /** Supervisor's per-action rating suggestions for コンピテンシー goals */
  ratingData?: RatingData | null;
}

/**
 * Request body for submitting supervisor feedback (approve/reject)
 * @see api-contract.md Section 5.5
 */
export interface SupervisorFeedbackSubmit {
  /** Decision: APPROVED (no REJECTED - supervisor provides feedback via comments) */
  action: 'APPROVED';
  /** Rating code: SS, S, A, B, C, D (6-level input scale, required for APPROVED) */
  supervisorRatingCode?: RatingCode;
  /** Comment (optional for APPROVED) */
  supervisorComment?: string;
  /** Supervisor's per-action rating suggestions for コンピテンシー goals */
  ratingData?: RatingData | null;
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
 * Employee can edit until supervisor approves
 */
export function isEditable(assessment: SelfAssessment): boolean {
  return assessment.status !== 'approved';
}

/**
 * Check if self-assessment is pending supervisor review
 */
export function isPendingReview(assessment: SelfAssessment): boolean {
  return assessment.status === 'submitted';
}

/**
 * Check if self-assessment is finalized (approved and locked)
 */
export function isFinalized(assessment: SelfAssessment): boolean {
  return assessment.status === 'approved';
}

/**
 * Get status badge variant for UI
 */
export function getStatusBadgeVariant(
  status: SelfAssessmentStatus
): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'submitted':
      return 'outline';
    case 'approved':
      return 'default';
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
  }
}

/**
 * Categorize self-assessments by status
 */
export function categorizeSelfAssessments(assessments: SelfAssessment[]): {
  draft: SelfAssessment[];     // drafts (not yet submitted)
  submitted: SelfAssessment[]; // awaiting supervisor
  approved: SelfAssessment[];  // finalized
} {
  return {
    draft: assessments.filter(sa => sa.status === 'draft'),
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
| `selfRatingCode` | `RatingCode` | ✅ **NEW** |
| `selfRating` | `number (0-7)` | ✅ **UPDATED** |
| `selfComment` | `string \| undefined` | ✅ Aligned |
| `ratingData` | `RatingData \| null` | ✅ **NEW** (competency per-action JSONB) |
| `status` | `SelfAssessmentStatus` | ✅ **UPDATED** (3 states) |
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
| `ratingData` | `RatingData \| null` | ✅ **NEW** (competency per-action JSONB) |
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
| `ratingData: RatingData` | `rating_data: dict` | ✅ |
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
  const { draft, submitted, approved } =
    categorizeSelfAssessments(result.data.items);

  console.log(`Draft (to fill): ${draft.length}`);
  console.log(`Submitted (awaiting review): ${submitted.length}`);
  console.log(`Approved: ${approved.length}`);
}
```

### 6.2. Updating Self-Assessment

```typescript
import { updateSelfAssessmentAction } from '@/api/server-actions/self-assessments';
import type { SelfAssessmentUpdate, RatingCode } from '@/api/types';

const update: SelfAssessmentUpdate = {
  selfRatingCode: 'A' as RatingCode, // 6-level input scale: SS, S, A, B, C, D
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

### 6.4. Supervisor Approving

```typescript
import { submitSupervisorFeedbackAction } from '@/api/server-actions/supervisor-feedbacks';
import type { SupervisorFeedbackSubmit } from '@/api/types';

// Approve (rating code required, comment optional)
const approveData: SupervisorFeedbackSubmit = {
  action: 'APPROVED',
  supervisorRatingCode: 'A',
  supervisorComment: '良い成果です。', // Optional for approval
};

const result = await submitSupervisorFeedbackAction(feedbackId, approveData);

if (result.success) {
  // Side effects:
  // - SelfAssessment.status → 'approved' (locked permanently)
  // - SupervisorFeedback.reviewed_at set
  // - Badge counter updated
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
   - Added: `approved` (3-state: draft/submitted/approved, no rejected)

2. **Rating system changed**: `selfRating (0-100)` → `selfRatingCode + selfRating (0-7)`
   - Need to update all components using `selfRating`

3. **New required field for submission**: `selfComment` is now required

### 8.2. Migration Steps

1. Update `common.ts` with new enums, types, and `RatingData` interface
2. Update `self-assessment.ts` with new interface definitions (remove `previousSelfAssessmentId`, add `ratingData`)
3. Create `supervisor-feedback.ts` with feedback types (add `ratingData`)
4. Update all components using old `selfRating` (0-100) to use `selfRatingCode`
5. Update form validation to require `selfComment` on submission
6. Add UI for competency granular ratings (per-action rating inputs)

---

## References

- API Contract: [api-contract.md](./api-contract.md)
- Domain Model: [domain-model.md](./domain-model.md)
- Backend Schema: `backend/app/schemas/self_assessment.py`
- Current Types: `frontend/src/api/types/self-assessment.ts`
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)
