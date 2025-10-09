# [TASK-05] sub02 - Improve Rejection Flow - UI/UX Implementation

## Overview

Implement complete UI/UX for viewing, managing, and resubmitting rejected goals in the HR Evaluation System. This task builds on TASK-04's blocking logic to provide employees with:
- Clear visibility into submitted/rejected/approved goals
- Prominent display of supervisor rejection comments
- Easy workflow for editing and resubmitting rejected goals
- Seamless integration with goal creation flow

**Related Issue:** #[issue_number] (parent TASK-05 issue)

**Depends on:** TASK-04 (Prevent Duplicate Goal Creation)

---

## Acceptance Criteria

### ✅ Requirement 1: Display List of Submitted/Rejected Goals

**GIVEN** I am logged in as an employee
**WHEN** I navigate to the goal list/review page (`/goal-list`)
**THEN** I should see all my goals for the current evaluation period
**AND** goals should be grouped or filtered by status (draft, submitted, approved, rejected)
**AND** each goal should display:
- Goal title and category (業績目標 / コンピテンシー)
- Current status with visual indicator (badge/color)
- Submission date
- Last updated date

**Status Display Requirements:**
- `submitted` → "承認待ち" (Awaiting Approval) - not editable
- `rejected` → "差し戻し" (Rejected) - show "Edit & Resubmit" button
- `approved` → "承認済み" (Approved) - not editable, show approval details
- `draft` → "下書き" (Draft) - editable

---

### ✅ Requirement 2: Display Supervisor Rejection Comments

**GIVEN** a supervisor has rejected my goal with comments
**WHEN** I view the goal detail or list
**THEN** the rejection comment should be displayed prominently
**AND** the comment should include:
- Rejection reason/feedback
- Rejected by (supervisor name)
- Rejected date

**CRITICAL:** Comments must remain visible even after goal status changes from `rejected` to `draft` during editing. Display logic should be based on **existence of a SupervisorReview with action='REJECTED'**, not on current goal status.

**GIVEN** I edit a rejected goal and the status changes to "draft"
**WHEN** I view the goal during editing
**THEN** the rejection comment should STILL be visible
**AND** it should persist until I successfully resubmit

---

### ✅ Requirement 3: Edit and Resubmit Rejected Goals

**GIVEN** I have a goal with status "rejected"
**WHEN** I click "Edit & Resubmit" button
**THEN** I should be redirected to the goal edit page
**AND** the rejection comment should remain visible while editing
**AND** all goal fields should be editable

**GIVEN** I am editing a rejected goal
**WHEN** I make changes
**THEN** I should see a "Save Draft" button
**AND** I should see a "Resubmit for Approval" button
**AND** rejection comments remain visible (based on SupervisorReview)

**GIVEN** I click "Resubmit for Approval"
**WHEN** all required fields are valid
**THEN** goal status changes to "submitted"
**AND** success message appears: "目標を再提出しました"
**AND** I am redirected to the goal list

---

### ✅ Requirement 4: Goal List Page with Filtering and Navigation

**GIVEN** I am on the goal list page
**WHEN** the page loads
**THEN** I should see filter options for:
- Status (draft, submitted, approved, rejected)
- Evaluation Period
- Goal Category (業績目標, コンピテンシー, コアバリュー)

**AND** default filter should show current period's goals

**GIVEN** I filter by status "rejected"
**WHEN** viewing the list
**THEN** only rejected goals should be displayed
**AND** a count badge should show total rejected goals

---

### ✅ Requirement 5: Integration with TASK-04

**GIVEN** I navigate to goal creation page (`/goal-input`)
**AND** I have goals with status "submitted"
**WHEN** the page loads
**THEN** I see alert (from TASK-04): "目標は既に提出されています"
**AND** alert includes link: "目標一覧ページで確認してください"
**AND** clicking link navigates to `/goal-list` (this page)

**GIVEN** I have goals with status "rejected"
**WHEN** I navigate to goal creation page
**THEN** I see message: "差し戻された目標があります"
**AND** message includes link to goal list
**AND** I CAN still create new goals (TASK-04 allows creation when only rejected goals exist)

---

## Implementation Checklist

### 📄 Create Goal List Page (Following Project Architecture)

- [ ] **Create page route**
  - [ ] File: `frontend/src/app/(evaluation)/(employee)/goal-list/page.tsx`
  - [ ] Minimal page component that imports from feature
  - [ ] Pattern: `export default function Page() { return <IndexPage />; }`

- [ ] **Create Goal List feature module**
  - [ ] Directory: `frontend/src/feature/evaluation/employee/goal-list/`
  - [ ] Subdirectories: `display/`, `components/`, `hooks/`

- [ ] **Create main display component**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/display/index.tsx`
  - [ ] Main component: `export default function GoalListPage()`
  - [ ] Use `'use client'` directive
  - [ ] Use `useGoalListData` hook for data management
  - [ ] Display goals in card/table layout
  - [ ] Show loading skeleton (DelayedSkeleton pattern)
  - [ ] Show error state with retry option
  - [ ] Show empty state when no goals match filter

### 🎣 Create Custom Hooks (in feature/hooks)

- [ ] **Create `useGoalListData` hook**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts`
  - [ ] Fetch goals with status filtering via server actions
  - [ ] Handle loading, error states
  - [ ] Provide filter/sort functions
  - [ ] Return interface:
    ```typescript
    interface UseGoalListDataReturn {
      goals: GoalResponse[];
      isLoading: boolean;
      error: string | null;
      filterByStatus: (status: GoalStatus[]) => void;
      filterByPeriod: (periodId: number) => void;
      filterByCategory: (category: string) => void;
      refetch: () => Promise<void>;
      currentPeriod: EvaluationPeriod | null;
    }
    ```

- [ ] **Create `useGoalResubmit` hook**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalResubmit.ts`
  - [ ] Handle resubmission logic
  - [ ] Call submit server action
  - [ ] Show success/error toast (if toast system exists)
  - [ ] Navigate back to goal list after success

### 🧩 Create UI Components (in feature/components)

- [ ] **Create `GoalStatusBadge` component**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/components/GoalStatusBadge.tsx`
  - [ ] Visual status indicators using shadcn/ui Badge:
    - `draft` → Gray badge "下書き"
    - `submitted` → Blue badge "承認待ち"
    - `approved` → Green badge "承認済み"
    - `rejected` → Red/Yellow badge "差し戻し"

- [ ] **Create `RejectionCommentBanner` component**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/components/RejectionCommentBanner.tsx`
  - [ ] **CRITICAL:** Display based on `supervisorReview.action === 'REJECTED'`, NOT goal status
  - [ ] Props:
    ```typescript
    interface RejectionCommentBannerProps {
      supervisorReview: SupervisorReview | null;
      goalStatus: GoalStatus; // For context only
    }
    ```
  - [ ] Use shadcn/ui Alert variant="destructive"
  - [ ] Show: comment text, reviewer name, review date
  - [ ] Truncate long comments with "Read more" expansion

- [ ] **Create `GoalListFilters` component**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/components/GoalListFilters.tsx`
  - [ ] Status filter (multi-select using shadcn/ui Checkbox)
  - [ ] Period filter (dropdown using shadcn/ui Select)
  - [ ] Category filter (multi-select)
  - [ ] Apply/Reset buttons

- [ ] **Create `GoalCard` component**
  - [ ] File: `frontend/src/feature/evaluation/employee/goal-list/components/GoalCard.tsx`
  - [ ] Display goal summary using shadcn/ui Card
  - [ ] Show status badge using GoalStatusBadge
  - [ ] Show rejection comment preview if applicable using RejectionCommentBanner
  - [ ] Action buttons based on status:
    - `rejected` → "編集・再提出" (Edit & Resubmit)
    - `draft` → "編集" (Edit) / "提出" (Submit)
    - `submitted` → "確認" (View) - read-only
    - `approved` → "確認" (View) - read-only

### 📝 Update Goal Edit Flow

- [ ] **Update goal edit/input page to show rejection comments**
  - [ ] File: `frontend/src/feature/goal-input/display/index.tsx` (reuse existing goal-input page)
  - [ ] Add logic to detect if editing a rejected goal
  - [ ] Display `RejectionCommentBanner` component if review exists with action='REJECTED'
  - [ ] Keep banner visible even if status is 'draft' during editing
  - [ ] Position banner prominently at top of form

- [ ] **Add resubmit functionality to goal-input page**
  - [ ] Show "再提出" (Resubmit) button when editing rejected goals
  - [ ] Use `useGoalResubmit` hook from goal-list feature
  - [ ] Validate all fields before resubmission
  - [ ] Show confirmation if needed
  - [ ] Redirect to `/goal-list` after successful resubmit

### 🔗 Update Integration Points

- [ ] **⚠️ CRITICAL: Update TASK-04 alert link**
  - [ ] File: `frontend/src/feature/goal-input/display/index.tsx` (in task-04 branch)
  - [ ] Current: `<Link href="/goal-list">` ❌
  - [ ] Update to: `<Link href="/(evaluation)/(employee)/goal-list">` ✅
  - [ ] **Note:** This change must be made in task-04 branch and merged to develop first
  - [ ] Verify navigation works correctly after both branches are merged

- [ ] **Add link to goal list in navigation (if not exists)**
  - [ ] Find main navigation component (check Header/Sidebar)
  - [ ] Add "目標一覧" (Goal List) menu item
  - [ ] Link to: `/(evaluation)/(employee)/goal-list`
  - [ ] Use proper Next.js Link component

### 🎨 Verify/Update API Types

- [ ] **Verify `GoalResponse` includes SupervisorReview**
  - [ ] File: `frontend/src/api/types/goal.ts`
  - [ ] Ensure interface includes:
    ```typescript
    interface GoalResponse {
      // ... existing fields
      supervisorReview?: SupervisorReview;
    }

    interface SupervisorReview {
      id: number;
      action: 'APPROVED' | 'REJECTED' | 'PENDING';
      comment: string | null;
      reviewerName: string;
      reviewedAt: string;
    }
    ```

- [ ] **Verify `getGoalsAction` returns reviews**
  - [ ] File: `frontend/src/api/server-actions/goals.ts`
  - [ ] Check if backend already returns SupervisorReview data
  - [ ] If not, coordinate with backend to include review data in response

---

## Testing Checklist (Manual E2E)

### Test Case 1: View Goal List with Multiple Statuses

**Steps:**
1. Login as employee
2. Navigate to `/goal-list`
3. Verify all goals for current period are displayed
4. Verify each goal shows correct status badge
5. Verify submitted goals show "承認待ち" and are not editable
6. Verify approved goals show "承認済み" and approval details
7. Verify rejected goals show "差し戻し" and "Edit & Resubmit" button

**Expected:** All goals display correctly with proper status indicators

---

### Test Case 2: View Rejection Comments

**Steps:**
1. Have a goal with status "rejected" with supervisor comment
2. Navigate to goal list
3. Verify rejection comment is visible in goal card
4. Click to view full details
5. Verify comment includes: text, reviewer name, review date

**Expected:** Rejection comments are clearly visible and complete

---

### Test Case 3: Rejection Comments Persist During Editing

**CRITICAL TEST**

**Steps:**
1. Have a rejected goal with comment
2. Click "Edit & Resubmit"
3. Make changes to goal (status may change to 'draft')
4. Verify rejection comment banner is STILL visible
5. Save as draft without resubmitting
6. Navigate away and return
7. Verify rejection comment is still visible

**Expected:** Comments remain visible based on SupervisorReview.action='REJECTED', regardless of goal status

---

### Test Case 4: Edit and Resubmit Rejected Goal

**Steps:**
1. Navigate to goal list
2. Find rejected goal
3. Click "Edit & Resubmit"
4. Make required changes
5. Click "Resubmit for Approval"
6. Verify success message appears
7. Verify redirected to goal list
8. Verify goal status changed to "submitted"

**Expected:** Resubmission workflow completes successfully

---

### Test Case 5: Filter Goals by Status

**Steps:**
1. Navigate to goal list
2. Apply filter: status = "rejected"
3. Verify only rejected goals are shown
4. Verify count badge shows correct number
5. Reset filter
6. Verify all goals are shown again

**Expected:** Filtering works correctly

---

### Test Case 6: Integration with TASK-04 Blocking

**Steps:**
1. Create and submit goals for current period
2. Navigate to `/goal-input`
3. Verify blocking alert appears
4. Click link "目標一覧ページで確認してください"
5. Verify navigation to `/goal-list`
6. Verify submitted goals are displayed

**Expected:** Seamless navigation from blocked creation page to goal list

---

### Test Case 7: Rejected Goals Allow New Creation

**Steps:**
1. Have only rejected goals for current period (no submitted/approved)
2. Navigate to `/goal-input`
3. Verify informational message: "差し戻された目標があります"
4. Verify message includes link to goal list
5. Verify goal creation form is still accessible

**Expected:** Can create new goals when only rejected goals exist

---

### Test Case 8: Empty States

**Steps:**
1. Filter goals with criteria that matches nothing
2. Verify empty state message: "該当する目標がありません"
3. Verify helpful message or link to create goals (if applicable)

**Expected:** Clear empty state messaging

---

### Test Case 9: Error Handling

**Steps:**
1. Disconnect network (simulate API failure)
2. Navigate to goal list
3. Verify error message: "目標の読み込みに失敗しました"
4. Verify "Retry" button appears
5. Reconnect network and click "Retry"
6. Verify goals load successfully

**Expected:** Graceful error handling with retry option

---

### Test Case 10: Long Rejection Comments

**Steps:**
1. Have a goal with rejection comment >200 characters
2. View goal in list view
3. Verify comment is truncated with "Read more" link
4. Click "Read more"
5. Verify full comment is displayed

**Expected:** Long comments are handled gracefully

---

## Error Messages

### Frontend Error Messages (Japanese)

```typescript
// Goal list loading errors
"目標の読み込みに失敗しました。" // Failed to load goals

// Resubmission errors
"目標の再提出に失敗しました。" // Failed to resubmit goal
"必須項目を入力してください。" // Please fill in required fields

// Empty states
"該当する目標がありません。" // No goals match criteria

// Rejection comment missing
"コメントなし" // No comment

// Generic rejection message when comment is empty
"目標が差し戻されました。上司に詳細を確認してください。" // Goal was rejected. Please check with supervisor for details.

// Success messages
"目標を再提出しました。" // Goal has been resubmitted

// Integration messages (from TASK-04)
"目標は既に提出されています。" // Goals have already been submitted
"差し戻された目標があります。" // You have rejected goals
```

---

## Files to Modify/Create

### New Files (Following Project Architecture)

```
# Page Route
frontend/src/app/(evaluation)/(employee)/goal-list/page.tsx

# Feature Module Structure
frontend/src/feature/evaluation/employee/goal-list/
├── display/
│   └── index.tsx                                        # Main GoalListPage component
├── hooks/
│   ├── useGoalListData.ts                              # Data fetching & filtering hook
│   └── useGoalResubmit.ts                              # Resubmission logic hook
└── components/
    ├── GoalStatusBadge.tsx                             # Status badge component
    ├── RejectionCommentBanner.tsx                      # Rejection comment display
    ├── GoalListFilters.tsx                             # Filter controls
    └── GoalCard.tsx                                    # Goal card component
```

### Files to Modify

```
# API Types (verify/add SupervisorReview)
frontend/src/api/types/goal.ts

# Server Actions (verify review data in response)
frontend/src/api/server-actions/goals.ts

# Goal Input Page (add rejection comment display + resubmit)
frontend/src/feature/goal-input/display/index.tsx

# Navigation (add goal-list link - find actual navigation file)
frontend/src/components/layout/[NavigationComponent].tsx  # TBD: locate actual nav component
```

---

## Estimated Effort

**Total Time:** 8-12 hours

**Breakdown:**
- Goal list page + components: 4-5 hours
- Hooks (useGoalListData, useGoalResubmit): 2-3 hours
- Rejection comment display logic: 2 hours
- Integration testing (manual E2E): 2 hours
- Bug fixes and refinements: 1-2 hours

---

## Dependencies

- **TASK-04 Implementation:** Goal creation blocking with link to `/goal-list` must be completed
- **Backend APIs:**
  - `GET /api/v1/goals` with status filtering (already exists)
  - `POST /api/v1/goals/{goal_id}/submit` for resubmission (verify exists)
  - SupervisorReview data included in goal responses (verify backend)
- **shadcn/ui Components:**
  - Alert, AlertTitle, AlertDescription (already used in TASK-04)
  - Card, Badge, Button, Skeleton (already in project)
  - Select, Checkbox for filters (verify available)

---

## Notes

### ⚠️ Architecture Compliance

**This implementation follows the project's established architecture:**

1. **Page Structure:**
   - Pages in `app/(evaluation)/(employee)/` are minimal wrappers
   - They import and render a component from `feature/` directory
   - Pattern: `export default function Page() { return <IndexPage />; }`

2. **Feature Module Organization:**
   ```
   feature/evaluation/employee/goal-list/
   ├── display/index.tsx      # Main component (export default)
   ├── hooks/                 # Custom hooks for this feature
   └── components/            # Feature-specific components
   ```

3. **Routing:**
   - Route groups use parentheses: `(evaluation)`, `(employee)`
   - Actual route: `/(evaluation)/(employee)/goal-list` → URL: `/goal-list`
   - Links must use full path: `href="/(evaluation)/(employee)/goal-list"`

4. **Data Fetching:**
   - Use server actions from `frontend/src/api/server-actions/`
   - Follow existing patterns (see `usePeriodSelection`, `useGoalReviewData`)
   - Handle loading states with `DelayedSkeleton` pattern

### Critical Implementation Detail

**Rejection Comment Visibility Logic:**

```typescript
// ❌ WRONG: Display based on status
{goal.status === 'rejected' && goal.supervisorReview?.comment && (
  <RejectionCommentBanner comment={goal.supervisorReview.comment} />
)}

// ✅ CORRECT: Display based on review action
{goal.supervisorReview?.action === 'REJECTED' && (
  <RejectionCommentBanner
    supervisorReview={goal.supervisorReview}
    goalStatus={goal.status} // For additional context only
  />
)}
```

**Why this matters:**
- When user edits a rejected goal, status changes to 'draft'
- If display is based on status, comments disappear
- User loses context about what needs to be fixed
- Display based on review action ensures comments persist

---

### Backend Verification Checklist

Before starting implementation, verify backend supports:

- [ ] `GET /api/v1/goals` returns `supervisorReview` object with goals
- [ ] `SupervisorReview` includes: action, comment, reviewerName, reviewedAt
- [ ] `POST /api/v1/goals/{goal_id}/submit` endpoint exists for resubmission
- [ ] Backend correctly handles status transitions: rejected → draft → submitted

---

### Integration with TASK-04

**⚠️ IMPORTANT: TASK-04 must be merged to develop before starting TASK-05**

**Current State:**
- TASK-04 branch: `task-04-sub02-implementation`
- TASK-04 link issue: Uses `/goal-list` instead of `/(evaluation)/(employee)/goal-list`
- TASK-04 must update this link before merge

**TASK-04 provides:**
- Blocking logic when goals are submitted/approved (via `usePeriodSelection` hook)
- Alert with link to goal-list page
- Informational message for rejected goals (allows creation)

**TASK-05 provides:**
- The actual `/goal-list` page that TASK-04 links to
- UI for viewing submitted/rejected/approved goals
- Workflow for editing and resubmitting rejected goals
- Display of supervisor rejection comments

**Together they create:**
- Complete user flow: blocked creation → view goals → edit rejected → resubmit
- Seamless navigation between goal input and goal list pages

**Integration Requirements:**
1. TASK-04 alert link must be updated to correct route
2. Both tasks must use same route path: `/(evaluation)/(employee)/goal-list`
3. Goal list page must handle navigation from TASK-04 alert
4. Goal edit flow must integrate rejection comment display

---

## Definition of Done

- [ ] All acceptance criteria are met
- [ ] All implementation checklist items are completed
- [ ] All manual E2E test cases pass
- [ ] Code follows project conventions and architecture
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented
- [ ] UI is responsive and accessible
- [ ] Integration with TASK-04 works correctly
- [ ] Rejection comments persist correctly during editing (CRITICAL)
- [ ] Code is committed and PR is ready for review

---

**Created by:** Claude Code
**Task:** TASK-05 sub02 - Improve Rejection Flow UI/UX
**Estimated Time:** 8-12 hours
**Priority:** High (Required for complete goal submission workflow)
