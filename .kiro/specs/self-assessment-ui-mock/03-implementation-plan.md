# Implementation Plan: Self-Assessment UI with Mocks

**Feature:** Self-Assessment UI with Mock Data
**Branch:** `feat/self-assessment-ui-mock`
**Date:** 2024-12-02
**Status:** In Progress
**Phase:** Phase 3 - Frontend Implementation with Mocks

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [File Structure](#file-structure)
4. [Implementation Checklist](#implementation-checklist)
5. [Mock Data Scenarios](#mock-data-scenarios)
6. [Testing Strategy](#testing-strategy)
7. [Migration Plan](#migration-plan)

---

## 📖 Overview

This document outlines the detailed implementation plan for Phase 3: Frontend Implementation with Mocks. It follows the Domain-First approach documented in the [Mock Data Implementation Guide](../../../docs/development/MOCK_DATA_IMPLEMENTATION_GUIDE.md).

### Goals

1. ✅ Implement self-assessment UI using mock data
2. ✅ Follow established architectural patterns
3. ✅ Enable supervisor approval before backend development
4. ✅ Ensure zero refactoring when switching to real API

### Timeline

**Estimated Duration**: 3-5 days

- Day 1: TypeScript types + JSON mock data
- Day 2: Mock service layer + Scenarios
- Day 3: Endpoints + Server actions
- Day 4-5: Page components + UI implementation

---

## 🔧 Prerequisites

### Documents Completed

- [x] [00-architecture-compatibility.md](./00-architecture-compatibility.md)
- [x] [01-domain-model.md](./01-domain-model.md)
- [x] [02-api-contract.md](./02-api-contract.md)
- [x] [03-implementation-plan.md](./03-implementation-plan.md) (this document)

### Environment Setup

```bash
# Ensure you're on the correct branch
git checkout feat/self-assessment-ui-mock

# Pull latest changes
git pull origin feat/self-assessment-ui-mock

# Install dependencies
cd frontend
npm install
```

### Environment Variables

Add to `frontend/.env.local`:

```bash
# Enable mock mode for self-assessment feature
NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT=true
```

---

## 📁 File Structure

### Complete File Tree

```
frontend/src/
├── api/
│   ├── types/
│   │   ├── index.ts                              # UPDATE: Export new types
│   │   └── self-assessment.ts                    # UPDATE: Add new interfaces
│   │
│   ├── constants/
│   │   └── config.ts                             # UPDATE: Add SELF_ASSESSMENTS endpoints
│   │
│   ├── mocks/
│   │   ├── data/
│   │   │   ├── goals.json                        # CREATE: Base goals data
│   │   │   ├── stage-weights.json                # CREATE: Stage weights by stage ID
│   │   │   ├── employees.json                    # CREATE: Employee list
│   │   │   └── ratings.json                      # CREATE: Rating scale definitions
│   │   │
│   │   ├── scenarios/
│   │   │   ├── self-assessment.scenarios.ts      # CREATE: Scenario combinations
│   │   │   └── review.scenarios.ts               # CREATE: Supervisor review scenarios
│   │   │
│   │   └── services/
│   │       ├── self-assessment.mock.service.ts   # CREATE: Mock service
│   │       └── review.mock.service.ts            # CREATE: Review mock service
│   │
│   ├── endpoints/
│   │   └── self-assessment.ts                    # CREATE: Endpoint functions with USE_MOCK switch
│   │
│   └── server-actions/
│       └── self-assessment.ts                    # CREATE: Server actions
│
├── app/
│   └── (evaluation)/
│       ├── (employee)/
│       │   └── self-assessment/
│       │       └── page.tsx                      # CREATE: Employee self-assessment page
│       │
│       └── (supervisor)/
│           └── self-assessment-review/
│               └── page.tsx                      # CREATE: Supervisor review page
│
└── feature/
    └── evaluation/
        ├── employee/
        │   └── self-assessment/
        │       ├── display/
        │       │   ├── SelfAssessmentPage.tsx    # CREATE: Main page component
        │       │   ├── GoalCard.tsx              # CREATE: Individual goal card
        │       │   ├── BucketSection.tsx         # CREATE: Category section
        │       │   └── SubmissionSummary.tsx     # CREATE: Summary modal
        │       │
        │       └── hooks/
        │           ├── useSelfAssessment.ts      # CREATE: Main hook
        │           └── useAutoSave.ts            # CREATE: Auto-save hook
        │
        └── supervisor/
            └── self-assessment-review/
                ├── display/
                │   ├── ReviewDashboard.tsx       # CREATE: Review dashboard
                │   ├── EmployeeCard.tsx          # CREATE: Employee card
                │   ├── BucketReviewSection.tsx   # CREATE: Bucket review
                │   └── ReviewModal.tsx           # CREATE: Review modal
                │
                └── hooks/
                    └── useReview.ts              # CREATE: Review hook
```

---

## ✅ Implementation Checklist

### Step 1: TypeScript Types (0.5 day)

- [ ] **Update** `frontend/src/api/types/self-assessment.ts`
  - [ ] Add `SelfAssessmentContext` interface
  - [ ] Add `DraftEntry` interface
  - [ ] Add `SelfAssessmentSummary` interface
  - [ ] Add `BucketContribution` interface
  - [ ] Add `BucketDecision` interface
  - [ ] Add `StageWeights` interface
  - [ ] Add request/response types for all endpoints
  - [ ] Export all new types

- [ ] **Update** `frontend/src/api/types/index.ts`
  - [ ] Re-export all self-assessment types

- [ ] **Validate** types match API contract exactly
  - [ ] Compare with [02-api-contract.md](./02-api-contract.md)
  - [ ] Ensure field names use snake_case → camelCase conversion

---

### Step 2: API Endpoints Configuration (0.5 day)

- [ ] **Update** `frontend/src/api/constants/config.ts`
  - [ ] Add `SELF_ASSESSMENTS` endpoints:
    ```typescript
    SELF_ASSESSMENTS: {
      LIST: '/self-assessments/',
      BY_ID: (id: string) => `/self-assessments/${id}`,
      CREATE: '/self-assessments/',
      UPDATE: (id: string) => `/self-assessments/${id}`,
      DELETE: (id: string) => `/self-assessments/${id}`,
      BY_USER: (userId: string) => `/self-assessments/user/${userId}`,
      BY_PERIOD: (periodId: string) => `/self-assessments/period/${periodId}`,
      BY_GOAL: (goalId: string) => `/self-assessments/goal/${goalId}`,
      SUBMIT: (id: string) => `/self-assessments/${id}/submit`,

      // NEW endpoints from API contract
      CONTEXT: '/self-assessments/context',
      DRAFT: '/self-assessments/draft',
      SUBMIT_NEW: '/self-assessments/submit',
      SUMMARY: (periodId: string) => `/self-assessments/summary/${periodId}`,
    },
    ```

  - [ ] Update `SUPERVISOR_REVIEWS` endpoints:
    ```typescript
    SUPERVISOR_REVIEWS: {
      // ... existing
      PENDING_GROUPED: '/supervisor-reviews/pending/grouped',
      BUCKET_DECISIONS: (assessmentId: string) =>
        `/supervisor-reviews/${assessmentId}/bucket-decisions`,
    },
    ```

---

### Step 3: JSON Mock Data (1 day)

- [ ] **Create** `frontend/src/api/mocks/data/goals.json`
  - [ ] 15-20 sample goals (mix of quantitative, qualitative, competency)
  - [ ] Various statuses (draft, approved, rejected)
  - [ ] Different weights (sum to 100 per category)
  - [ ] Realistic Japanese text

- [ ] **Create** `frontend/src/api/mocks/data/stage-weights.json`
  - [ ] Stage 1-4: 40% quantitative, 40% qualitative, 20% competency
  - [ ] Stage 5-6: 50% quantitative, 30% qualitative, 20% competency

- [ ] **Create** `frontend/src/api/mocks/data/employees.json`
  - [ ] 10-15 employees
  - [ ] Different stages
  - [ ] Supervisor relationships

- [ ] **Create** `frontend/src/api/mocks/data/ratings.json`
  - [ ] Rating scale (SS to D)
  - [ ] Numeric scores (0-7)
  - [ ] Thresholds for conversion

---

### Step 4: TypeScript Scenarios (1 day)

- [ ] **Create** `frontend/src/api/mocks/scenarios/self-assessment.scenarios.ts`
  - [ ] **Scenario 1**: New employee, no draft (empty state)
  - [ ] **Scenario 2**: Employee with partial draft (auto-save in progress)
  - [ ] **Scenario 3**: Employee with complete draft (ready to submit)
  - [ ] **Scenario 4**: Employee with submitted assessment (awaiting review)
  - [ ] **Scenario 5**: Employee with approved assessment (read-only)
  - [ ] **Scenario 6**: Employee with rejected assessment (needs revision)
  - [ ] **Scenario 7**: Employee with no approved goals (error state)
  - [ ] **Scenario 8**: Employee with single bucket (competency weight = 0)

- [ ] **Create** `frontend/src/api/mocks/scenarios/review.scenarios.ts`
  - [ ] **Scenario 1**: Supervisor with no pending reviews
  - [ ] **Scenario 2**: Supervisor with 3 pending reviews
  - [ ] **Scenario 3**: Supervisor with mixed bucket statuses
  - [ ] **Scenario 4**: Supervisor with overridden ratings

---

### Step 5: Mock Service Layer (1 day)

- [ ] **Create** `frontend/src/api/mocks/services/self-assessment.mock.service.ts`
  - [ ] Implement `getContext(periodId)`:
    - [ ] Load goals from JSON
    - [ ] Filter approved goals for current user
    - [ ] Load stage weights
    - [ ] Load draft from local state
    - [ ] Calculate review status
    - [ ] Simulate 500ms delay

  - [ ] Implement `saveDraft(entries)`:
    - [ ] Validate entries
    - [ ] Update local state (in-memory)
    - [ ] Return success with timestamp
    - [ ] Simulate 300ms delay

  - [ ] Implement `submitAssessment(entries)`:
    - [ ] Validate all entries have ratings
    - [ ] Calculate bucket averages
    - [ ] Calculate contributions
    - [ ] Calculate final rating
    - [ ] Create bucket decisions
    - [ ] Update status to 'submitted'
    - [ ] Return summary
    - [ ] Simulate 1s delay

  - [ ] Implement `getSummary(periodId)`:
    - [ ] Load submitted assessment from state
    - [ ] Return summary with supervisor feedback
    - [ ] Simulate 400ms delay

  - [ ] Add error scenarios:
    - [ ] `NO_APPROVED_GOALS` (404)
    - [ ] `ALREADY_SUBMITTED` (409)
    - [ ] `MISSING_RATINGS` (400)

- [ ] **Create** `frontend/src/api/mocks/services/review.mock.service.ts`
  - [ ] Implement `getPendingReviews(periodId)`:
    - [ ] Load subordinates' assessments
    - [ ] Filter by 'submitted' status
    - [ ] Group by employee
    - [ ] Simulate 600ms delay

  - [ ] Implement `submitBucketDecisions(assessmentId, decisions)`:
    - [ ] Validate decisions
    - [ ] Update bucket statuses
    - [ ] Calculate final status (all approved OR any rejected)
    - [ ] Update assessment status
    - [ ] Return success
    - [ ] Simulate 800ms delay

---

### Step 6: Endpoint Functions (0.5 day)

- [ ] **Create** `frontend/src/api/endpoints/self-assessment.ts`
  - [ ] Import mock service
  - [ ] Import HTTP client
  - [ ] Add environment variable check:
    ```typescript
    const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT === 'true';
    ```

  - [ ] Implement endpoints with switch:
    ```typescript
    export const selfAssessmentApi = {
      getContext: async (periodId?: string) => {
        if (USE_MOCK) {
          return mockSelfAssessmentService.getContext(periodId);
        }
        const httpClient = getHttpClient();
        const endpoint = periodId
          ? `${API_ENDPOINTS.SELF_ASSESSMENTS.CONTEXT}?periodId=${periodId}`
          : API_ENDPOINTS.SELF_ASSESSMENTS.CONTEXT;
        return httpClient.get(endpoint);
      },

      saveDraft: async (periodId: string, entries: DraftEntry[]) => {
        if (USE_MOCK) {
          return mockSelfAssessmentService.saveDraft(entries);
        }
        const httpClient = getHttpClient();
        return httpClient.post(
          `${API_ENDPOINTS.SELF_ASSESSMENTS.DRAFT}?periodId=${periodId}`,
          { entries }
        );
      },

      // ... other endpoints
    };
    ```

---

### Step 7: Server Actions (0.5 day)

- [ ] **Create** `frontend/src/api/server-actions/self-assessment.ts`
  - [ ] Implement `getSelfAssessmentContext(periodId)`:
    ```typescript
    'use server'

    import { selfAssessmentApi } from '../endpoints/self-assessment';
    import { revalidateTag } from 'next/cache';

    export async function getSelfAssessmentContext(periodId?: string) {
      const response = await selfAssessmentApi.getContext(periodId);
      return response;
    }
    ```

  - [ ] Implement `saveSelfAssessmentDraft(periodId, entries)`:
    - [ ] Call endpoint
    - [ ] Revalidate cache tag: `self-assessment-${periodId}`

  - [ ] Implement `submitSelfAssessment(periodId, entries)`:
    - [ ] Call endpoint
    - [ ] Revalidate cache tags

  - [ ] Implement supervisor actions:
    - [ ] `getPendingReviews(periodId)`
    - [ ] `submitBucketDecisions(assessmentId, decisions)`

---

### Step 8: Page Components (2 days)

#### Employee Self-Assessment Page

- [ ] **Create** `frontend/src/app/(evaluation)/(employee)/self-assessment/page.tsx`
  - [ ] Server component
  - [ ] Fetch context via server action
  - [ ] Render `SelfAssessmentPage` component
  - [ ] Handle error states

- [ ] **Create** `frontend/src/feature/evaluation/employee/self-assessment/display/SelfAssessmentPage.tsx`
  - [ ] Main client component
  - [ ] Use `useSelfAssessment` hook
  - [ ] Render goal buckets
  - [ ] Auto-save functionality
  - [ ] Submit button with validation
  - [ ] Loading states
  - [ ] Error boundaries

- [ ] **Create** `frontend/src/feature/evaluation/employee/self-assessment/display/GoalCard.tsx`
  - [ ] Display goal details
  - [ ] Rating selector (SS to D)
  - [ ] Comment textarea
  - [ ] Weight indicator
  - [ ] Status badge

- [ ] **Create** `frontend/src/feature/evaluation/employee/self-assessment/display/BucketSection.tsx`
  - [ ] Group goals by bucket
  - [ ] Show bucket weight
  - [ ] Calculate bucket average
  - [ ] Hide bucket if weight = 0

- [ ] **Create** `frontend/src/feature/evaluation/employee/self-assessment/display/SubmissionSummary.tsx`
  - [ ] Modal component
  - [ ] Show final rating
  - [ ] Show per-bucket contributions
  - [ ] Confirm submission

#### Supervisor Review Page

- [ ] **Create** `frontend/src/app/(evaluation)/(supervisor)/self-assessment-review/page.tsx`
  - [ ] Server component
  - [ ] Fetch pending reviews via server action
  - [ ] Render `ReviewDashboard` component

- [ ] **Create** `frontend/src/feature/evaluation/supervisor/self-assessment-review/display/ReviewDashboard.tsx`
  - [ ] List of pending reviews
  - [ ] Group by employee
  - [ ] Filter by period
  - [ ] Search functionality

- [ ] **Create** `frontend/src/feature/evaluation/supervisor/self-assessment-review/display/EmployeeCard.tsx`
  - [ ] Employee info
  - [ ] Submission date
  - [ ] Current status
  - [ ] Review button

- [ ] **Create** `frontend/src/feature/evaluation/supervisor/self-assessment-review/display/BucketReviewSection.tsx`
  - [ ] Employee rating/comment
  - [ ] Supervisor rating override
  - [ ] Supervisor comment
  - [ ] Approve/Reject buttons

- [ ] **Create** `frontend/src/feature/evaluation/supervisor/self-assessment-review/display/ReviewModal.tsx`
  - [ ] Full assessment view
  - [ ] All buckets
  - [ ] Submit review

---

### Step 9: Custom Hooks (1 day)

- [ ] **Create** `frontend/src/feature/evaluation/employee/self-assessment/hooks/useSelfAssessment.ts`
  - [ ] State management for draft entries
  - [ ] Submit handler
  - [ ] Validation logic
  - [ ] Error handling

- [ ] **Create** `frontend/src/feature/evaluation/employee/self-assessment/hooks/useAutoSave.ts`
  - [ ] Debounced save (30s)
  - [ ] Track dirty state
  - [ ] Show save indicator

- [ ] **Create** `frontend/src/feature/evaluation/supervisor/self-assessment-review/hooks/useReview.ts`
  - [ ] Bucket decision state
  - [ ] Submit review handler
  - [ ] Validation

---

### Step 10: Testing (1 day)

- [ ] **Unit Tests** for mock service
  - [ ] Test scenario loading
  - [ ] Test calculations
  - [ ] Test error scenarios

- [ ] **Component Tests** (optional)
  - [ ] Test goal card rendering
  - [ ] Test rating selection
  - [ ] Test submit validation

- [ ] **Manual Testing** (required)
  - [ ] Test all 8 employee scenarios
  - [ ] Test supervisor review workflow
  - [ ] Test auto-save
  - [ ] Test error states
  - [ ] Test responsive design

---

## 🎭 Mock Data Scenarios

### Employee Scenarios

#### 1. New Employee (Empty State)
```typescript
{
  goals: [...approvedGoals],
  draft: [],
  summary: null,
  stageWeights: { quantitative: 40, qualitative: 40, competency: 20 },
  reviewStatus: null
}
```

#### 2. Partial Draft (Auto-Save)
```typescript
{
  goals: [...approvedGoals],
  draft: [
    { goalId: 'goal-1', bucket: 'quantitative', ratingCode: 'A', comment: 'Good progress' },
    { goalId: 'goal-2', bucket: 'qualitative', ratingCode: null, comment: null } // Incomplete
  ],
  summary: null,
  stageWeights: { ... },
  reviewStatus: null
}
```

#### 3. Complete Draft (Ready to Submit)
```typescript
{
  goals: [...approvedGoals],
  draft: [
    { goalId: 'goal-1', bucket: 'quantitative', ratingCode: 'A', comment: '...' },
    { goalId: 'goal-2', bucket: 'qualitative', ratingCode: 'A+', comment: '...' },
    { goalId: 'goal-3', bucket: 'competency', ratingCode: 'A', comment: '...' }
  ],
  summary: null,
  stageWeights: { ... },
  reviewStatus: null
}
```

#### 4. Submitted Assessment (Awaiting Review)
```typescript
{
  goals: [...approvedGoals],
  draft: [...entries],
  summary: {
    id: 'assessment-1',
    submittedAt: '2024-12-01T10:00:00Z',
    finalRating: 'A',
    weightedTotal: 4.2,
    perBucket: [...]
  },
  stageWeights: { ... },
  reviewStatus: 'pending'
}
```

#### 5. Approved Assessment (Read-Only)
```typescript
{
  // Same structure, but reviewStatus = 'approved'
  // All inputs disabled
}
```

#### 6. Rejected Assessment (Needs Revision)
```typescript
{
  goals: [...approvedGoals],
  draft: [...entries],
  summary: { ... },
  stageWeights: { ... },
  reviewStatus: 'rejected',
  supervisorFeedback: [
    {
      bucket: 'quantitative',
      supervisorComment: 'Please provide more detail on your achievements',
      status: 'rejected'
    }
  ]
}
```

#### 7. No Approved Goals (Error)
```typescript
// API returns 404 error
{
  success: false,
  errorCode: 'NO_APPROVED_GOALS',
  error: 'You have no approved goals for this period'
}
```

#### 8. Single Bucket (Zero Weight)
```typescript
{
  goals: [...onlyQuantitativeGoals],
  draft: [],
  summary: null,
  stageWeights: { quantitative: 60, qualitative: 40, competency: 0 }, // Competency hidden
  reviewStatus: null
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Mock Service)

```typescript
describe('SelfAssessmentMockService', () => {
  it('should calculate bucket average correctly', () => {
    const entries = [
      { goalId: '1', ratingCode: 'A', goal: { weight: 60 } },
      { goalId: '2', ratingCode: 'A+', goal: { weight: 40 } }
    ];
    const avg = calculateBucketAverage(entries, 'quantitative');
    expect(avg).toBe(4.4); // (4*60 + 5*40) / 100
  });

  it('should return error if no approved goals', async () => {
    const response = await mockService.getContext('period-with-no-goals');
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('NO_APPROVED_GOALS');
  });
});
```

### Manual Testing Checklist

- [ ] **Employee Flow**
  - [ ] Can view approved goals
  - [ ] Can select ratings
  - [ ] Can add comments
  - [ ] Auto-save works (check console logs)
  - [ ] Can submit with all ratings
  - [ ] Cannot submit with missing ratings
  - [ ] See submission summary modal
  - [ ] See submitted status after submission
  - [ ] Cannot edit after submission

- [ ] **Supervisor Flow**
  - [ ] Can view pending reviews
  - [ ] Can see employee ratings/comments
  - [ ] Can provide supervisor ratings
  - [ ] Can add supervisor comments
  - [ ] Can approve all buckets
  - [ ] Can reject specific buckets
  - [ ] See confirmation after submission

- [ ] **Edge Cases**
  - [ ] No approved goals → error state
  - [ ] Zero weight bucket → hidden from UI
  - [ ] Long comments → truncation/scrolling
  - [ ] Network error simulation

---

## 🔄 Migration Plan

### When Backend is Ready

1. **Backend Implementation Complete**
   - [ ] All endpoints implemented
   - [ ] Pydantic schemas match TypeScript types
   - [ ] Integration tests passing

2. **Update Environment Variable**
   ```bash
   # In frontend/.env.local
   NEXT_PUBLIC_USE_MOCK_SELF_ASSESSMENT=false
   ```

3. **Validation Testing**
   - [ ] Test all employee scenarios with real API
   - [ ] Test supervisor review with real API
   - [ ] Verify response structures match
   - [ ] Verify error handling matches

4. **No Code Changes Required**
   - Endpoints already have real API implementation
   - Server actions call the same endpoints
   - Components use server actions (agnostic to mock/real)

5. **Cleanup (Optional)**
   - [ ] Remove mock service files (or keep for testing)
   - [ ] Remove environment variable from `.env.local`
   - [ ] Update documentation

---

## 📊 Progress Tracking

### Current Status

- [ ] Phase 1: Domain Modeling ✅ (Completed)
- [ ] Phase 2: API Contract ✅ (Completed)
- [ ] Phase 3: Frontend Implementation (In Progress)
  - [ ] TypeScript Types
  - [ ] API Endpoints Config
  - [ ] JSON Mock Data
  - [ ] TypeScript Scenarios
  - [ ] Mock Service Layer
  - [ ] Endpoint Functions
  - [ ] Server Actions
  - [ ] Page Components
  - [ ] Custom Hooks
  - [ ] Testing
- [ ] Phase 4: Stakeholder Approval (Pending)
- [ ] Phase 5: Database Design (Pending)
- [ ] Phase 6: Backend Implementation (Pending)
- [ ] Phase 7: Integration & Migration (Pending)

---

## ✅ Definition of Done

This feature is considered complete when:

- [ ] All checklist items are completed
- [ ] All 8 employee scenarios work correctly
- [ ] Supervisor review workflow works end-to-end
- [ ] Auto-save functionality works
- [ ] Error states are handled gracefully
- [ ] UI is responsive (mobile, tablet, desktop)
- [ ] Code follows project conventions
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Manual testing completed
- [ ] Supervisor approves UI/UX
- [ ] Documentation is updated

---

**Document Owner**: Frontend Team
**Review Status**: In Progress
**Last Updated**: 2024-12-02
**Next Step**: Begin TypeScript Types Implementation
