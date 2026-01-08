# API Contract: Self-Assessment Feature

**Version:** 2.0
**Status:** Draft
**Last Updated:** 2025-01-05
**Related Issues:** #415

---

## 1. Overview

This document defines the API contract for the Self-Assessment feature, which allows employees to evaluate their own performance against approved goals. The API provides endpoints for:

- **Self-Assessments**: Employee self-evaluations for approved goals
- **Supervisor Feedbacks**: Supervisor reviews and decisions on self-assessments

### Key Business Rules

1. **Auto-creation**: Self-assessments are automatically created when a goal is approved by supervisor
2. **4 Status States**: `draft` → `submitted` → `approved` OR `rejected`
3. **Letter Grade System**:
   - **Input Scale (Individual Goals)**: SS, S, A, B, C, D (6 levels) - what users select per goal
     - 業績目標 with 定量目標: all 6 levels
     - 業績目標 with 定性目標: only SS, S, A, B, C (no D)
     - コンピテンシー: all 6 levels
   - **Output Scale (Final Calculation)**: SS, S, A+, A, A-, B, C, D (8 levels) - system calculates from weighted average
4. **Rejection History**: When rejected, original self-assessment becomes immutable, new draft is created with `previousSelfAssessmentId`
5. **Sequential Flow**: Core Value self-assessments only available after ALL Performance + Competency are approved

---

## 2. Authentication

All endpoints require Clerk JWT authentication via `Authorization: Bearer <token>` header.

**Headers Required:**
```
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json
```

---

## 3. Base URLs

- **Self-Assessments**: `/api/v1/self-assessments`
- **Supervisor Feedbacks**: `/api/v1/supervisor-feedbacks`

---

## 4. Self-Assessment Endpoints

### 4.1. List Self-Assessments

```http
GET /self-assessments
```

**Description:** Get self-assessments based on current user's permissions and filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | No | Filter by evaluation period ID |
| `userId` | UUID | No | Filter by user ID (supervisor/admin only) |
| `status` | string | No | Filter by status: `draft`, `submitted`, `approved`, `rejected` |
| `goalCategory` | string | No | Filter by goal category: `業績目標`, `コンピテンシー`, `コアバリュー` |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 10, max: 100) |

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "goalId": "uuid",
      "periodId": "uuid",
      "previousSelfAssessmentId": null,
      "selfRatingCode": "A+",
      "selfRating": 5.0,
      "selfComment": "I exceeded my targets by 20%...",
      "status": "submitted",
      "submittedAt": "2025-01-05T10:30:00Z",
      "createdAt": "2025-01-01T09:00:00Z",
      "updatedAt": "2025-01-05T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 10,
  "pages": 2
}
```

**Response 403:**
```json
{
  "detail": "Permission denied: Cannot view self-assessments for this user"
}
```

**Permission Rules:**
- **Employee**: Can only see their own self-assessments
- **Supervisor**: Can see subordinates' self-assessments + their own
- **Admin**: Can see all self-assessments in organization

---

### 4.2. Get Self-Assessments by Period

```http
GET /self-assessments/period/{period_id}
```

**Description:** Get all self-assessments for a specific evaluation period.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period_id` | UUID | Yes | Evaluation period ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | No | Filter by user ID (supervisor/admin only) |
| `status` | string | No | Filter by status |
| `page` | number | No | Page number |
| `limit` | number | No | Items per page |

**Response 200:** Same as List Self-Assessments

---

### 4.3. Get Self-Assessment by Goal

```http
GET /self-assessments/goal/{goal_id}
```

**Description:** Get the active self-assessment for a specific goal.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `goal_id` | UUID | Yes | Goal ID |

**Response 200:**
```json
{
  "id": "uuid",
  "goalId": "uuid",
  "periodId": "uuid",
  "previousSelfAssessmentId": null,
  "selfRatingCode": "A",
  "selfRating": 4.0,
  "selfComment": "My assessment...",
  "status": "draft",
  "submittedAt": null,
  "createdAt": "2025-01-01T09:00:00Z",
  "updatedAt": "2025-01-03T14:30:00Z"
}
```

**Response 404:**
```json
{
  "detail": "Self-assessment not found for goal"
}
```

---

### 4.4. Get Self-Assessment by ID

```http
GET /self-assessments/{assessment_id}
```

**Description:** Get detailed self-assessment information by ID.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assessment_id` | UUID | Yes | Self-assessment ID |

**Response 200:**
```json
{
  "id": "uuid",
  "goalId": "uuid",
  "periodId": "uuid",
  "previousSelfAssessmentId": null,
  "selfRatingCode": "S",
  "selfRating": 6.0,
  "selfComment": "I exceeded expectations...",
  "status": "approved",
  "submittedAt": "2025-01-05T10:30:00Z",
  "createdAt": "2025-01-01T09:00:00Z",
  "updatedAt": "2025-01-06T15:00:00Z",
  "isEditable": false,
  "isOverdue": false,
  "daysUntilDeadline": null,
  "goalCategory": "業績目標",
  "goalStatus": "approved"
}
```

---

### 4.5. Update Self-Assessment

```http
PUT /self-assessments/{assessment_id}
```

**Description:** Update a self-assessment (draft status only).

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assessment_id` | UUID | Yes | Self-assessment ID |

**Request Body:**
```json
{
  "selfRatingCode": "A+",
  "selfComment": "Updated assessment comment..."
}
```

**Validation Rules:**
- `selfRatingCode`: Must be one of `SS`, `S`, `A+`, `A`, `A-`, `B`, `C`, `D`
- `selfComment`: String, max 5000 characters

**Response 200:**
```json
{
  "id": "uuid",
  "goalId": "uuid",
  "periodId": "uuid",
  "selfRatingCode": "A+",
  "selfRating": 5.0,
  "selfComment": "Updated assessment comment...",
  "status": "draft",
  "submittedAt": null,
  "createdAt": "2025-01-01T09:00:00Z",
  "updatedAt": "2025-01-05T11:00:00Z"
}
```

**Response 400:**
```json
{
  "detail": "Cannot update self-assessment: Status is not draft"
}
```

**Response 403:**
```json
{
  "detail": "Permission denied: You can only update your own self-assessments"
}
```

**Response 422:**
```json
{
  "detail": "Invalid rating code. Must be one of: SS, S, A+, A, A-, B, C, D"
}
```

---

### 4.6. Submit Self-Assessment

```http
POST /self-assessments/{assessment_id}/submit
```

**Description:** Submit a self-assessment for supervisor review.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assessment_id` | UUID | Yes | Self-assessment ID |

**Validation Rules:**
- `selfRatingCode` must be provided (required for submission)
- `selfComment` must be provided (required for submission)
- Status must be `draft`

**Response 200:**
```json
{
  "id": "uuid",
  "goalId": "uuid",
  "periodId": "uuid",
  "selfRatingCode": "A+",
  "selfRating": 5.0,
  "selfComment": "My assessment...",
  "status": "submitted",
  "submittedAt": "2025-01-05T10:30:00Z",
  "createdAt": "2025-01-01T09:00:00Z",
  "updatedAt": "2025-01-05T10:30:00Z"
}
```

**Response 400:**
```json
{
  "detail": "Cannot submit self-assessment: Already submitted"
}
```

**Response 422:**
```json
{
  "detail": "Cannot submit: selfRatingCode and selfComment are required"
}
```

---

### 4.7. Delete Self-Assessment

```http
DELETE /self-assessments/{assessment_id}
```

**Description:** Delete a self-assessment (draft status only).

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assessment_id` | UUID | Yes | Self-assessment ID |

**Response 200:**
```json
{
  "message": "Self-assessment deleted successfully"
}
```

**Response 400:**
```json
{
  "detail": "Cannot delete self-assessment: Status is not draft"
}
```

---

### 4.8. Get Rejection History

```http
GET /self-assessments/{assessment_id}/history
```

**Description:** Get the rejection history chain for a self-assessment.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assessment_id` | UUID | Yes | Self-assessment ID (current or any in chain) |

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid-3",
      "status": "approved",
      "selfRatingCode": "A+",
      "selfComment": "Final revised version...",
      "previousSelfAssessmentId": "uuid-2",
      "submittedAt": "2025-01-10T10:00:00Z",
      "supervisorComment": "Approved, well documented",
      "supervisorAction": "APPROVED"
    },
    {
      "id": "uuid-2",
      "status": "rejected",
      "selfRatingCode": "A",
      "selfComment": "Second attempt...",
      "previousSelfAssessmentId": "uuid-1",
      "submittedAt": "2025-01-07T10:00:00Z",
      "supervisorComment": "Please add more details",
      "supervisorAction": "REJECTED"
    },
    {
      "id": "uuid-1",
      "status": "rejected",
      "selfRatingCode": "A-",
      "selfComment": "Initial assessment...",
      "previousSelfAssessmentId": null,
      "submittedAt": "2025-01-03T10:00:00Z",
      "supervisorComment": "Needs improvement",
      "supervisorAction": "REJECTED"
    }
  ],
  "total": 3
}
```

---

## 5. Supervisor Feedback Endpoints

### 5.1. List Supervisor Feedbacks

```http
GET /supervisor-feedbacks
```

**Description:** Get supervisor feedbacks based on current user's permissions.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | No | Filter by evaluation period ID |
| `supervisorId` | UUID | No | Filter by supervisor ID (feedback creator) |
| `subordinateId` | UUID | No | Filter by subordinate ID (feedback recipient) |
| `status` | string | No | Filter by status: `incomplete`, `draft`, `submitted` |
| `action` | string | No | Filter by action: `PENDING`, `APPROVED`, `REJECTED` |
| `page` | number | No | Page number |
| `limit` | number | No | Items per page |

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "selfAssessmentId": "uuid",
      "periodId": "uuid",
      "supervisorId": "uuid",
      "subordinateId": "uuid",
      "supervisorRatingCode": "A",
      "supervisorRating": 4.0,
      "supervisorComment": "Good work, but...",
      "action": "PENDING",
      "status": "draft",
      "submittedAt": null,
      "reviewedAt": null,
      "createdAt": "2025-01-05T10:30:00Z",
      "updatedAt": "2025-01-05T14:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

---

### 5.2. Create Supervisor Feedback

```http
POST /supervisor-feedbacks
```

**Description:** Create supervisor feedback on a submitted self-assessment.

**Request Body:**
```json
{
  "selfAssessmentId": "uuid",
  "periodId": "uuid",
  "supervisorRatingCode": "A+",
  "supervisorComment": "Excellent work!",
  "action": "PENDING",
  "status": "draft"
}
```

**Validation Rules:**
- `selfAssessmentId`: Must reference a submitted self-assessment
- `supervisorRatingCode`: Must be one of `SS`, `S`, `A+`, `A`, `A-`, `B`, `C`, `D`
- `action`: Must be `PENDING`, `APPROVED`, or `REJECTED`
- `status`: Must be `incomplete`, `draft`, or `submitted`

**Response 201:**
```json
{
  "id": "uuid",
  "selfAssessmentId": "uuid",
  "periodId": "uuid",
  "supervisorId": "uuid",
  "supervisorRatingCode": "A+",
  "supervisorRating": 5.0,
  "supervisorComment": "Excellent work!",
  "action": "PENDING",
  "status": "draft",
  "submittedAt": null,
  "reviewedAt": null,
  "createdAt": "2025-01-05T15:00:00Z",
  "updatedAt": "2025-01-05T15:00:00Z"
}
```

**Response 409:**
```json
{
  "detail": "Supervisor feedback already exists for this self-assessment"
}
```

---

### 5.3. Get Feedback for Self-Assessment

```http
GET /supervisor-feedbacks/assessment/{self_assessment_id}
```

**Description:** Get supervisor feedback for a specific self-assessment.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `self_assessment_id` | UUID | Yes | Self-assessment ID |

**Response 200:**
```json
{
  "id": "uuid",
  "selfAssessmentId": "uuid",
  "periodId": "uuid",
  "supervisorId": "uuid",
  "supervisorRatingCode": "A",
  "supervisorRating": 4.0,
  "supervisorComment": "Good work overall",
  "action": "APPROVED",
  "status": "submitted",
  "submittedAt": "2025-01-06T10:00:00Z",
  "reviewedAt": "2025-01-06T10:00:00Z",
  "createdAt": "2025-01-05T15:00:00Z",
  "updatedAt": "2025-01-06T10:00:00Z"
}
```

**Response 404:** Returns `null` if no feedback exists yet

---

### 5.4. Update Supervisor Feedback

```http
PUT /supervisor-feedbacks/{feedback_id}
```

**Description:** Update supervisor feedback (draft status only).

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feedback_id` | UUID | Yes | Supervisor feedback ID |

**Request Body:**
```json
{
  "supervisorRatingCode": "A+",
  "supervisorComment": "Updated feedback..."
}
```

**Response 200:** Updated feedback object

---

### 5.5. Submit Supervisor Feedback (Approve/Reject)

```http
POST /supervisor-feedbacks/{feedback_id}/submit
```

**Description:** Submit supervisor feedback and finalize the decision (approve or reject).

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feedback_id` | UUID | Yes | Supervisor feedback ID |

**Request Body:**
```json
{
  "action": "APPROVED",
  "supervisorRatingCode": "A+",
  "supervisorComment": "Great work!"
}
```

**OR for rejection:**
```json
{
  "action": "REJECTED",
  "supervisorComment": "Please add more specific examples..."
}
```

**Validation Rules:**
- **For APPROVED**: `supervisorRatingCode` is **required**, `supervisorComment` is optional
- **For REJECTED**: `supervisorComment` is **required**, `supervisorRatingCode` is optional

**Side Effects:**
- **APPROVED**:
  - SupervisorFeedback.status → `submitted`
  - SupervisorFeedback.action → `APPROVED`
  - SelfAssessment.status → `approved`
- **REJECTED**:
  - SupervisorFeedback.status → `submitted`
  - SupervisorFeedback.action → `REJECTED`
  - SelfAssessment.status → `rejected`
  - System creates NEW SelfAssessment with `previousSelfAssessmentId`

**Response 200:**
```json
{
  "id": "uuid",
  "selfAssessmentId": "uuid",
  "supervisorRatingCode": "A+",
  "supervisorRating": 5.0,
  "supervisorComment": "Great work!",
  "action": "APPROVED",
  "status": "submitted",
  "submittedAt": "2025-01-06T10:00:00Z",
  "reviewedAt": "2025-01-06T10:00:00Z"
}
```

**Response 422 (for rejection without comment):**
```json
{
  "detail": "supervisorComment is required when rejecting"
}
```

---

### 5.6. Change to Draft

```http
POST /supervisor-feedbacks/{feedback_id}/draft
```

**Description:** Change supervisor feedback status back to draft.

**Response 200:** Updated feedback object with `status: "draft"`

---

### 5.7. Delete Supervisor Feedback

```http
DELETE /supervisor-feedbacks/{feedback_id}
```

**Description:** Delete supervisor feedback (non-submitted only).

**Response 200:**
```json
{
  "message": "Supervisor feedback deleted successfully"
}
```

---

## 6. Schemas

**IMPORTANT - Rating Code Scales:**
- **Individual Goal Input**: Use `RatingCode` (6-level scale: SS, S, A, B, C, D)
  - For self-assessments and supervisor feedbacks on individual goals
- **Final Calculation Output**: Use `FinalRatingCode` (8-level scale: SS, S, A+, A, A-, B, C, D)
  - For overall period performance ratings calculated by system

### Request Schemas

```typescript
// ========================================
// Self-Assessment Request Schemas
// ========================================

interface SelfAssessmentUpdate {
  selfRatingCode?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';  // 6-level input scale
  selfComment?: string;
}

// ========================================
// Supervisor Feedback Request Schemas
// ========================================

interface SupervisorFeedbackCreate {
  selfAssessmentId: UUID;
  periodId: UUID;
  supervisorRatingCode?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';  // 6-level input scale
  supervisorComment?: string;
  action: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'incomplete' | 'draft' | 'submitted';
}

interface SupervisorFeedbackUpdate {
  supervisorRatingCode?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';  // 6-level input scale
  supervisorComment?: string;
}

interface SupervisorFeedbackSubmit {
  action: 'APPROVED' | 'REJECTED';
  supervisorRatingCode?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';  // 6-level input scale
  supervisorComment?: string;
}
```

### Response Schemas

```typescript
// ========================================
// Common Types
// ========================================

type UUID = string;

type SelfAssessmentStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

// Individual goal input scale (6 levels)
type RatingCode = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

// Final calculated output scale (8 levels)
type FinalRatingCode = 'SS' | 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C' | 'D';

type SupervisorFeedbackAction = 'PENDING' | 'APPROVED' | 'REJECTED';

type SupervisorFeedbackStatus = 'incomplete' | 'draft' | 'submitted';

// ========================================
// Self-Assessment Response Schemas
// ========================================

interface SelfAssessment {
  id: UUID;
  goalId: UUID;
  periodId: UUID;
  previousSelfAssessmentId?: UUID;
  selfRatingCode?: RatingCode;
  selfRating?: number; // 0.0-7.0, auto-calculated
  selfComment?: string;
  status: SelfAssessmentStatus;
  submittedAt?: string; // ISO 8601 datetime
  createdAt: string;
  updatedAt: string;
}

/**
 * Detailed self-assessment with embedded relationships.
 *
 * NOTE: Goal title should be extracted using getGoalTitle() helper:
 * - Performance goals: use goal.title
 * - Competency goals: use competency names or fallback
 */
interface SelfAssessmentDetail extends SelfAssessment {
  /** Whether this assessment can still be edited */
  isEditable: boolean;
  /** Whether this assessment is past the deadline */
  isOverdue: boolean;
  /** Days remaining until assessment deadline */
  daysUntilDeadline?: number;
  /** Category of the goal being assessed (convenience field) */
  goalCategory?: string;
  /** Current status of the goal (convenience field) */
  goalStatus?: string;
  /** The goal being assessed - use getGoalTitle() helper to extract title */
  goal?: GoalResponse;
  /** The evaluation period this assessment belongs to */
  evaluationPeriod?: EvaluationPeriod;
  /** The employee who owns this assessment */
  employee?: UserProfile;
}

interface SelfAssessmentList {
  items: SelfAssessment[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ========================================
// Supervisor Feedback Response Schemas
// ========================================

interface SupervisorFeedback {
  id: UUID;
  selfAssessmentId: UUID;
  periodId: UUID;
  supervisorId: UUID;
  subordinateId: UUID;
  supervisorRatingCode?: RatingCode;
  supervisorRating?: number; // 0.0-7.0, auto-calculated
  supervisorComment?: string;
  action: SupervisorFeedbackAction;
  status: SupervisorFeedbackStatus;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detailed supervisor feedback with embedded relationships.
 *
 * NOTE: Goal title/description should be extracted from selfAssessment.goal
 * using getGoalTitle() and getGoalDescription() helpers.
 * Period name should be extracted from evaluationPeriod.name.
 */
interface SupervisorFeedbackDetail extends SupervisorFeedback {
  /** The self-assessment this feedback is for (includes embedded goal) */
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
  subordinate?: UserProfile;
  /** Supervisor providing the feedback */
  supervisor?: UserProfile;
}

interface SelfAssessmentWithGoal extends SelfAssessment {
  goal: GoalResponse;
}

interface UserProfile {
  id: UUID;
  name: string;
  email?: string;
}

interface EvaluationPeriod {
  id: UUID;
  name: string;
  startDate: string;
  endDate: string;
  deadline?: string;
}

interface SupervisorFeedbackList {
  items: SupervisorFeedback[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

### Rating Code Mapping

| Code | Numeric Value | Meaning |
|------|---------------|---------|
| SS | 7.0 | Exceptional |
| S | 6.0 | Excellent |
| A+ | 5.0 | Very Good+ |
| A | 4.0 | Very Good |
| A- | 3.0 | Good |
| B | 2.0 | Acceptable |
| C | 1.0 | Below Expectations |
| D | 0.0 | Unsatisfactory |

---

## 7. Error Responses

```typescript
interface ApiError {
  detail: string;
  errorCode?: string;
}
```

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid operation (e.g., cannot update submitted) |
| 403 | Forbidden - Permission denied |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 500 | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request body validation failed |
| `NOT_FOUND` | Resource not found |
| `ALREADY_SUBMITTED` | Cannot modify submitted/approved resource |
| `ALREADY_EXISTS` | Resource already exists (e.g., feedback for assessment) |
| `PERMISSION_DENIED` | User lacks required permissions |
| `INVALID_STATUS` | Invalid status transition |
| `MISSING_REQUIRED_FIELD` | Required field not provided |
| `GOAL_NOT_APPROVED` | Cannot create self-assessment for non-approved goal |
| `PERIOD_NOT_ACTIVE` | Evaluation period is not active |
| `COMMENT_REQUIRED_FOR_REJECTION` | Supervisor comment required when rejecting |

---

## 8. Validation Rules

### Self-Assessment

| Field | Rule |
|-------|------|
| `selfRatingCode` | Optional in draft, **REQUIRED** for submission. Must be valid code. |
| `selfComment` | Optional in draft, **REQUIRED** for submission. Max 5000 chars. |
| `status` | Can only transition: draft → submitted. |

### Supervisor Feedback

| Field | Rule |
|-------|------|
| `supervisorRatingCode` | Optional in draft, **REQUIRED** for approval. Must be valid code. |
| `supervisorComment` | Optional in draft and approval, **REQUIRED** for rejection. Max 5000 chars. |
| `action` | Must be PENDING, APPROVED, or REJECTED. |
| `status` | Can transition: incomplete → draft → submitted. |

### Status Transition Rules

**Self-Assessment:**
```
(none) → draft       : System auto-creates when goal approved
draft → submitted    : Employee submits (requires rating + comment)
submitted → approved : System sets when SupervisorFeedback.action = APPROVED
submitted → rejected : System sets when SupervisorFeedback.action = REJECTED
approved → (none)    : Immutable, no transitions
rejected → (none)    : Immutable, no transitions (new draft created instead)
```

**Supervisor Feedback:**
```
(none) → incomplete  : Supervisor opens review
incomplete → draft   : Supervisor starts editing
draft → submitted    : Supervisor finalizes decision
submitted → (none)   : Immutable, no transitions
```

---

## 9. Rate Limiting

| Endpoint | Rate Limit |
|----------|------------|
| GET endpoints | 100 requests/minute |
| POST/PUT endpoints | 30 requests/minute |
| DELETE endpoints | 10 requests/minute |

---

## 10. Permissions

### Role-Based Access

| Role | Self-Assessment | Supervisor Feedback |
|------|-----------------|---------------------|
| **Employee** | Own only (read, update draft, submit, delete draft) | Read feedback received |
| **Supervisor** | Own + subordinates (read only) | Create, update, submit for subordinates |
| **Admin** | All (read only) | All (read only) |

### Endpoint Permissions

| Endpoint | Employee | Supervisor | Admin |
|----------|----------|------------|-------|
| `GET /self-assessments` | Own | Own + subordinates | All |
| `PUT /self-assessments/:id` | Own draft | ❌ | ❌ |
| `POST /self-assessments/:id/submit` | Own | ❌ | ❌ |
| `DELETE /self-assessments/:id` | Own draft | ❌ | ❌ |
| `GET /supervisor-feedbacks` | Received only | Created | All |
| `POST /supervisor-feedbacks` | ❌ | Subordinates | ❌ |
| `PUT /supervisor-feedbacks/:id` | ❌ | Own draft | ❌ |
| `POST /supervisor-feedbacks/:id/submit` | ❌ | Own | ❌ |
| `DELETE /supervisor-feedbacks/:id` | ❌ | Own draft | ❌ |

---

## 11. Webhook Events (Future)

The following events may trigger webhooks:

| Event | Description |
|-------|-------------|
| `self_assessment.submitted` | Employee submitted self-assessment |
| `self_assessment.approved` | Supervisor approved self-assessment |
| `self_assessment.rejected` | Supervisor rejected self-assessment |
| `core_value.unlocked` | All Performance + Competency approved, Core Value available |

---

## References

- Domain Model: [domain-model.md](./domain-model.md)
- Backend API: `backend/app/api/v1/self_assessments.py`
- Backend Schemas: `backend/app/schemas/self_assessment.py`
- Frontend Types: `frontend/src/api/types/self-assessment.ts`
- Guide: [MOCK_DATA_IMPLEMENTATION_GUIDE.md](../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md)

---

## Changelog

### Version 2.0 (2025-01-05)
- Added 4-state system: draft, submitted, approved, rejected
- Added `previousSelfAssessmentId` for rejection history tracking
- Added letter grade system (SS, S, A+, A, A-, B, C, D)
- Added SupervisorFeedback `action` field (PENDING, APPROVED, REJECTED)
- Added rejection history endpoint
- Updated validation rules for approval/rejection
- Documented side effects of approval/rejection actions
- Added auto-creation of self-assessment when goal approved

### Version 1.0 (2024-12-18)
- Initial draft
