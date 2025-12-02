# API Contract: Self-Assessment Feature

**Feature:** Self-Assessment UI with Mock Data
**Branch:** `feat/self-assessment-ui-mock`
**Date:** 2024-12-02
**Version:** 1.0
**Status:** Draft
**Phase:** Phase 2 - API Contract Definition

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Endpoints](#endpoints)
5. [TypeScript Schemas](#typescript-schemas)
6. [Error Responses](#error-responses)
7. [Validation Rules](#validation-rules)
8. [Rate Limiting](#rate-limiting)
9. [Changelog](#changelog)

---

## 📖 Overview

This API contract defines the REST endpoints for the Self-Assessment feature. It serves as the **source of truth** for both frontend TypeScript types and backend Pydantic schemas.

### Purpose

Enable employees to:
1. View their approved goals and create self-assessments
2. Save draft assessments (auto-save)
3. Submit completed assessments for supervisor review

Enable supervisors to:
1. View pending self-assessments from subordinates
2. Review and provide ratings per category (bucket)
3. Approve or reject assessments with feedback

---

## 🔐 Authentication

All endpoints require **Clerk JWT authentication** via the `Authorization` header:

```http
Authorization: Bearer <clerk_jwt_token>
```

### Organization Scoping

All requests are automatically scoped to the user's organization based on the authenticated user's `organizationId`.

---

## 🌐 Base URL

```
/api/v1/self-assessments
```

For organization-scoped requests, the HTTP client automatically prepends:
```
/api/org/{orgSlug}/v1/self-assessments
```

---

## 🔌 Endpoints

### 1. Get Self-Assessment Context

**Purpose**: Fetch all data needed for employee to complete self-assessment page.

```http
GET /self-assessments/context
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | No | Evaluation period ID. Defaults to current active period. |

#### Success Response (200 OK)

```typescript
{
  "goals": Goal[],
  "draft": DraftEntry[],
  "summary": SelfAssessmentSummary | null,
  "stageWeights": StageWeights,
  "reviewStatus": "pending" | "approved" | "rejected" | null
}
```

**Field Descriptions**:
- `goals`: All approved goals for the employee in this period
- `draft`: Existing draft entries (empty array if new assessment)
- `summary`: Summary data if assessment was previously submitted (null if draft or never submitted)
- `stageWeights`: Weight distribution based on employee's stage
- `reviewStatus`: Current status of the assessment (null if never submitted)

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Invalid or missing authentication token |
| 404 | `NOT_FOUND` | No active evaluation period found |
| 404 | `NO_APPROVED_GOALS` | Employee has no approved goals for this period |

#### Example Request

```http
GET /api/org/acme-corp/v1/self-assessments/context?periodId=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Example Response

```json
{
  "goals": [
    {
      "id": "goal-001",
      "goalCategory": "業績目標",
      "performanceGoalType": "quantitative",
      "weight": 60,
      "status": "approved",
      "title": "Increase sales by 20%",
      "specificGoalText": "Achieve $500K in Q4 sales",
      "achievementCriteriaText": "Measured by revenue in Salesforce",
      "submittedAt": "2024-10-01T10:00:00Z"
    }
  ],
  "draft": [
    {
      "goalId": "goal-001",
      "bucket": "quantitative",
      "ratingCode": "A",
      "comment": "Achieved $480K, 96% of target"
    }
  ],
  "summary": null,
  "stageWeights": {
    "quantitative": 40,
    "qualitative": 40,
    "competency": 20
  },
  "reviewStatus": null
}
```

---

### 2. Save Draft

**Purpose**: Auto-save employee's work-in-progress (idempotent operation).

```http
POST /self-assessments/draft
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | Yes | Evaluation period ID |

#### Request Body

```typescript
{
  "entries": DraftEntry[]
}
```

**Note**: `ratingCode` and `comment` are optional for draft.

#### Success Response (200 OK)

```typescript
{
  "success": true,
  "updatedAt": string // ISO8601 timestamp
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid entry data (wrong bucket, invalid rating code, etc.) |
| 401 | `UNAUTHORIZED` | Invalid authentication |
| 404 | `NOT_FOUND` | Period or goal not found |
| 409 | `ALREADY_SUBMITTED` | Assessment already submitted, cannot edit draft |

#### Example Request

```http
POST /api/org/acme-corp/v1/self-assessments/draft?periodId=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "entries": [
    {
      "goalId": "goal-001",
      "bucket": "quantitative",
      "ratingCode": "A",
      "comment": "Achieved 96% of target"
    },
    {
      "goalId": "goal-002",
      "bucket": "qualitative",
      "ratingCode": null,
      "comment": null
    }
  ]
}
```

#### Example Response

```json
{
  "success": true,
  "updatedAt": "2024-12-02T14:30:00Z"
}
```

---

### 3. Submit Self-Assessment

**Purpose**: Finalize assessment and send to supervisor for review.

```http
POST /self-assessments/submit
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | Yes | Evaluation period ID |

#### Request Body

```typescript
{
  "entries": DraftEntry[] // All entries MUST have ratingCode
}
```

**Validation**: All entries must have `ratingCode` (no nulls allowed).

#### Success Response (200 OK)

```typescript
{
  "id": UUID,
  "submittedAt": string, // ISO8601 timestamp
  "finalRating": string, // SS, S, A+, A, A-, B, C, D
  "weightedTotal": number, // 0-7 scale
  "perBucket": BucketContribution[],
  "flags": {
    "fail": boolean,
    "notes": string[]
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `MISSING_RATINGS` | One or more entries missing rating code |
| 400 | `VALIDATION_ERROR` | Invalid entry data |
| 401 | `UNAUTHORIZED` | Invalid authentication |
| 404 | `NOT_FOUND` | Period or goal not found |
| 409 | `ALREADY_SUBMITTED` | Assessment already submitted for this period |
| 422 | `INCOMPLETE_GOALS` | Not all approved goals have entries |

#### Example Request

```http
POST /api/org/acme-corp/v1/self-assessments/submit?periodId=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "entries": [
    {
      "goalId": "goal-001",
      "bucket": "quantitative",
      "ratingCode": "A",
      "comment": "Achieved 96% of sales target ($480K of $500K)"
    },
    {
      "goalId": "goal-002",
      "bucket": "qualitative",
      "ratingCode": "A+",
      "comment": "Led 3 successful product launches"
    },
    {
      "goalId": "goal-003",
      "bucket": "competency",
      "ratingCode": "A",
      "comment": "Improved team collaboration through weekly syncs"
    }
  ]
}
```

#### Example Response

```json
{
  "id": "assessment-001",
  "submittedAt": "2024-12-02T15:00:00Z",
  "finalRating": "A",
  "weightedTotal": 4.2,
  "perBucket": [
    {
      "bucket": "quantitative",
      "weight": 40,
      "avgScore": 4.0,
      "contribution": 1.6
    },
    {
      "bucket": "qualitative",
      "weight": 40,
      "avgScore": 5.0,
      "contribution": 2.0
    },
    {
      "bucket": "competency",
      "weight": 20,
      "avgScore": 4.0,
      "contribution": 0.8
    }
  ],
  "flags": {
    "fail": false,
    "notes": []
  }
}
```

---

### 4. Get Self-Assessment Summary

**Purpose**: Retrieve summary of a submitted assessment (employee view).

```http
GET /self-assessments/summary/{periodId}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | Yes | Evaluation period ID |

#### Success Response (200 OK)

```typescript
{
  "id": UUID,
  "status": "submitted" | "approved" | "rejected",
  "submittedAt": string,
  "finalRating": string,
  "weightedTotal": number,
  "perBucket": BucketContribution[],
  "supervisorFeedback": {
    "bucket": string,
    "supervisorRating": string | null,
    "supervisorComment": string | null,
    "status": "pending" | "approved" | "rejected"
  }[] | null
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Invalid authentication |
| 404 | `NOT_FOUND` | No submitted assessment found for this period |

---

### 5. Get Pending Self-Assessments (Supervisor)

**Purpose**: Fetch all pending self-assessments from direct reports, grouped by employee.

```http
GET /supervisor-reviews/pending/grouped
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `periodId` | UUID | No | Filter by evaluation period. Defaults to current active period. |

#### Success Response (200 OK)

```typescript
{
  "employees": {
    "employeeId": UUID,
    "employeeName": string,
    "employeeCode": string,
    "assessment": {
      "id": UUID,
      "submittedAt": string,
      "status": "submitted",
      "buckets": BucketDecision[]
    }
  }[]
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Invalid authentication |
| 403 | `INSUFFICIENT_PERMISSIONS` | User is not a supervisor |
| 404 | `NOT_FOUND` | No active period found |

---

### 6. Submit Bucket Decisions (Supervisor)

**Purpose**: Supervisor approves or rejects bucket decisions with optional rating override.

```http
PATCH /supervisor-reviews/{assessmentId}/bucket-decisions
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assessmentId` | UUID | Yes | Self-assessment ID |

#### Request Body

```typescript
{
  "decisions": {
    "bucket": string, // "quantitative" | "qualitative" | "competency"
    "status": "approved" | "rejected",
    "supervisorRating": string | null, // Override rating (optional)
    "supervisorComment": string | null // Required if rejecting or overriding
  }[]
}
```

**Validation**:
- If `status = "rejected"`, `supervisorComment` is required (min 10 chars)
- If `supervisorRating` is provided, `supervisorComment` is recommended
- If any bucket is rejected, entire assessment status → 'rejected'

#### Success Response (200 OK)

```typescript
{
  "assessmentId": UUID,
  "status": "approved" | "rejected",
  "updatedAt": string,
  "finalRating": string | null, // Only if approved
  "message": string
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Missing required comment or invalid rating |
| 401 | `UNAUTHORIZED` | Invalid authentication |
| 403 | `INSUFFICIENT_PERMISSIONS` | User is not the supervisor of this employee |
| 404 | `NOT_FOUND` | Assessment not found |
| 409 | `ALREADY_REVIEWED` | Assessment already approved or rejected |

#### Example Request

```http
PATCH /api/org/acme-corp/v1/supervisor-reviews/assessment-001/bucket-decisions
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "decisions": [
    {
      "bucket": "quantitative",
      "status": "approved",
      "supervisorRating": null,
      "supervisorComment": "Great effort, just missed target due to market conditions"
    },
    {
      "bucket": "qualitative",
      "status": "approved",
      "supervisorRating": "S",
      "supervisorComment": "Exceptional product launches, exceeded expectations"
    },
    {
      "bucket": "competency",
      "status": "approved",
      "supervisorRating": null,
      "supervisorComment": null
    }
  ]
}
```

#### Example Response

```json
{
  "assessmentId": "assessment-001",
  "status": "approved",
  "updatedAt": "2024-12-02T16:00:00Z",
  "finalRating": "A+",
  "message": "Assessment approved successfully"
}
```

---

## 📐 TypeScript Schemas

### Goal

```typescript
interface Goal {
  id: UUID;
  userId: UUID;
  periodId: UUID;
  goalCategory: string; // "業績目標" | "コンピテンシー"
  performanceGoalType?: "quantitative" | "qualitative"; // Only for performance goals
  weight: number; // 0-100
  status: "draft" | "submitted" | "approved" | "rejected";

  // Performance goal fields (when goalCategory = "業績目標")
  title?: string;
  specificGoalText?: string;
  achievementCriteriaText?: string;
  meansMethodsText?: string;

  // Competency goal fields (when goalCategory = "コンピテンシー")
  competencyIds?: UUID[];
  selectedIdealActions?: Record<string, string[]>;
  actionPlan?: string;

  submittedAt?: string; // ISO8601
  createdAt: string;
  updatedAt: string;
}
```

### DraftEntry

```typescript
interface DraftEntry {
  goalId: UUID;
  bucket: "quantitative" | "qualitative" | "competency";
  ratingCode?: "SS" | "S" | "A+" | "A" | "A-" | "B" | "C" | "D"; // Optional for draft, required for submit
  comment?: string; // Max 500 chars
}
```

### StageWeights

```typescript
interface StageWeights {
  quantitative: number; // 0-100
  qualitative: number;  // 0-100
  competency: number;   // 0-100
}
```

### SelfAssessmentSummary

```typescript
interface SelfAssessmentSummary {
  id: UUID;
  submittedAt: string; // ISO8601
  finalRating: string; // SS, S, A+, A, A-, B, C, D
  weightedTotal: number; // 0-7 scale
  perBucket?: BucketContribution[];
  flags?: {
    fail: boolean;
    notes: string[];
  };
}
```

### BucketContribution

```typescript
interface BucketContribution {
  bucket: "quantitative" | "qualitative" | "competency";
  weight: number; // Stage weight percentage (0-100)
  avgScore: number; // Weighted average rating (0-7)
  contribution: number; // (avgScore × weight) / 100
}
```

### BucketDecision

```typescript
interface BucketDecision {
  id: UUID;
  bucket: "quantitative" | "qualitative" | "competency";
  employeeRating: string; // SS, S, A+, A, A-, B, C, D
  employeeComment: string;
  employeeContribution: number;
  supervisorRating?: string | null;
  supervisorComment?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}
```

### SelfAssessmentContext (Response)

```typescript
interface SelfAssessmentContext {
  goals: Goal[];
  draft: DraftEntry[];
  summary: SelfAssessmentSummary | null;
  stageWeights: StageWeights;
  reviewStatus: "pending" | "approved" | "rejected" | null;
}
```

### SaveDraftRequest

```typescript
interface SaveDraftRequest {
  entries: DraftEntry[];
}
```

### SaveDraftResponse

```typescript
interface SaveDraftResponse {
  success: boolean;
  updatedAt: string; // ISO8601
}
```

### SubmitAssessmentRequest

```typescript
interface SubmitAssessmentRequest {
  entries: DraftEntry[]; // All must have ratingCode
}
```

### SubmitAssessmentResponse

```typescript
interface SubmitAssessmentResponse {
  id: UUID;
  submittedAt: string;
  finalRating: string;
  weightedTotal: number;
  perBucket: BucketContribution[];
  flags: {
    fail: boolean;
    notes: string[];
  };
}
```

---

## ❌ Error Responses

### Standard Error Format

All error responses follow this structure:

```typescript
interface ApiError {
  success: false;
  error: string;           // User-friendly message
  errorCode?: string;      // Machine-readable code
  errorMessage?: string;   // Detailed technical message (dev mode only)
  details?: Record<string, any>; // Additional context (e.g., validation errors)
}
```

### Error Codes

```typescript
enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_RATINGS = 'MISSING_RATINGS',
  INCOMPLETE_GOALS = 'INCOMPLETE_GOALS',

  // Business Logic
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_SUBMITTED = 'ALREADY_SUBMITTED',
  ALREADY_REVIEWED = 'ALREADY_REVIEWED',
  NO_APPROVED_GOALS = 'NO_APPROVED_GOALS',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
```

### Example Error Responses

#### 400 - Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "details": {
    "entries[0].ratingCode": "Rating code is required for submission",
    "entries[1].comment": "Comment exceeds maximum length of 500 characters"
  }
}
```

#### 401 - Unauthorized

```json
{
  "success": false,
  "error": "Authentication required",
  "errorCode": "UNAUTHORIZED"
}
```

#### 403 - Insufficient Permissions

```json
{
  "success": false,
  "error": "You do not have permission to perform this action",
  "errorCode": "INSUFFICIENT_PERMISSIONS",
  "errorMessage": "User is not a supervisor"
}
```

#### 404 - Not Found

```json
{
  "success": false,
  "error": "Resource not found",
  "errorCode": "NOT_FOUND",
  "errorMessage": "No active evaluation period found"
}
```

#### 409 - Already Submitted

```json
{
  "success": false,
  "error": "Assessment already submitted",
  "errorCode": "ALREADY_SUBMITTED",
  "details": {
    "assessmentId": "assessment-001",
    "submittedAt": "2024-12-01T10:00:00Z"
  }
}
```

#### 422 - Incomplete Goals

```json
{
  "success": false,
  "error": "Not all approved goals have assessment entries",
  "errorCode": "INCOMPLETE_GOALS",
  "details": {
    "totalApprovedGoals": 5,
    "providedEntries": 3,
    "missingGoalIds": ["goal-004", "goal-005"]
  }
}
```

---

## ✅ Validation Rules

### Rating Code Validation

```typescript
const VALID_RATING_CODES = ['SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D'];

function validateRatingCode(code: string): boolean {
  return VALID_RATING_CODES.includes(code);
}
```

### Comment Validation

```typescript
function validateComment(comment: string): boolean {
  if (!comment) return true; // Optional
  return comment.length <= 500;
}
```

### Bucket Validation

```typescript
function validateBucket(bucket: string): boolean {
  return ['quantitative', 'qualitative', 'competency'].includes(bucket);
}
```

### Submission Validation

```typescript
function validateSubmission(entries: DraftEntry[]): ValidationResult {
  const errors: string[] = [];

  // All entries must have rating code
  entries.forEach((entry, index) => {
    if (!entry.ratingCode) {
      errors.push(`Entry ${index}: ratingCode is required for submission`);
    }
  });

  // Comment length validation
  entries.forEach((entry, index) => {
    if (entry.comment && entry.comment.length > 500) {
      errors.push(`Entry ${index}: comment exceeds 500 characters`);
    }
  });

  // Bucket validation
  entries.forEach((entry, index) => {
    if (!validateBucket(entry.bucket)) {
      errors.push(`Entry ${index}: invalid bucket '${entry.bucket}'`);
    }
  });

  return { valid: errors.length === 0, errors };
}
```

### Supervisor Comment Validation (for rejection)

```typescript
function validateSupervisorComment(
  status: 'approved' | 'rejected',
  comment: string | null
): ValidationResult {
  if (status === 'rejected') {
    if (!comment || comment.trim().length < 10) {
      return {
        valid: false,
        errors: ['Supervisor comment is required and must be at least 10 characters when rejecting']
      };
    }
  }
  return { valid: true, errors: [] };
}
```

---

## ⏱️ Rate Limiting

### Draft Save Endpoint

**Limit**: 1 request per second per user

**Rationale**: Prevent excessive auto-save calls that could overload the database.

**Behavior**:
- Frontend debounces auto-save to 30 seconds
- Rate limit is a safety net

**Response (429 Too Many Requests)**:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 1
  }
}
```

### Submit Endpoint

**Limit**: 1 request per minute per user

**Rationale**: Prevent accidental double submissions.

**Behavior**:
- Frontend disables submit button after first click
- Rate limit is a safety net

---

## 📝 Changelog

### Version 1.0 (2024-12-02)

- Initial draft of API contract
- Defined 6 core endpoints for self-assessment workflow
- Established TypeScript schema definitions
- Defined error response formats
- Documented validation rules
- Added rate limiting specifications

---

## ✅ Review Checklist

Before implementing, confirm:

- [ ] Frontend team: Can you build the UI from this contract?
- [ ] Backend team: Is this implementable with current architecture?
- [ ] Product/Business: Does this match requirements?
- [ ] Security team: Are authentication/authorization requirements clear?
- [ ] All TypeScript types are defined
- [ ] All error scenarios are documented
- [ ] Validation rules are comprehensive
- [ ] Rate limiting is appropriate

---

**Document Owner**: Frontend & Backend Teams
**Review Status**: Pending Team Review
**Last Updated**: 2024-12-02
**Next Step**: Phase 3 - Frontend Implementation with Mocks
