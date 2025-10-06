# Requirements Document: Improve Rejection Flow - Display Review Comments and Enable Resubmission

## 1. Overview

This document defines the requirements for improving the Goal rejection workflow in the HR Evaluation System. Currently, when a supervisor rejects a Goal, subordinates have limited visibility into rejection comments and the resubmission process is unclear. This task focuses on building the complete UI/UX for managing submitted and rejected goals.

**Problem Statement:**
- Subordinates cannot easily see which goals have been submitted or rejected
- Rejection comments from supervisors are not displayed prominently
- No clear UI for editing and resubmitting rejected goals
- Workflow for `submitted` → `rejected` → `edit` → `resubmit` is not user-friendly

**Target Users:**
- Employees (subordinates) viewing and resubmitting goals
- Supervisors reviewing goal comments (read-only context)

**Relationship to TASK-04:**
- TASK-04 implements **blocking logic** to prevent duplicate goal creation
- TASK-05 implements **complete UX** for viewing and managing submitted/rejected goals
- Both tasks work together to create a seamless goal management experience

**Scope Note:**
This task (TASK-05) focuses on the **UI/UX for goal review and resubmission**. Backend rejection API already exists (`POST /api/v1/goals/{goal_id}/reject`) and will be reused.

## 2. Requirements List

### Requirement 1: Display List of Submitted/Rejected Goals

**User Story:**
> As an employee, I want to view all my submitted and rejected goals in one place so that I can track their approval status and take action if needed.

**Acceptance Criteria:**

```gherkin
GIVEN I am logged in as an employee
WHEN I navigate to the goal list/review page
THEN I should see all my goals for the current evaluation period
AND goals should be grouped or filtered by status (draft, submitted, approved, rejected)
AND each goal should display:
  - Goal title and category (業績目標 / コンピテンシー)
  - Current status with visual indicator (badge/color)
  - Submission date
  - Last updated date

GIVEN I have goals with status "submitted"
WHEN I view the goal list
THEN submitted goals should be clearly marked as "承認待ち" (Awaiting Approval)
AND I should NOT be able to edit them
AND I should see a message: "Supervisor review in progress"

GIVEN I have goals with status "rejected"
WHEN I view the goal list
THEN rejected goals should be clearly marked as "差し戻し" (Rejected)
AND I should see a prominent "Edit & Resubmit" button
AND rejection comments should be visible

GIVEN I have goals with status "approved"
WHEN I view the goal list
THEN approved goals should be clearly marked as "承認済み" (Approved)
AND I should NOT be able to edit them
AND I should see approval date and approver name
```

### Requirement 2: Display Supervisor Rejection Comments

**User Story:**
> As an employee, I want to see my supervisor's rejection comments clearly so that I understand what needs to be improved before resubmission.

**Critical UX Requirement:**
> Comments must remain visible even after the goal status changes from `rejected` to `draft` during editing. Display logic should be based on the **existence of a SupervisorReview with action='REJECTED'**, not on the current goal status.

**Acceptance Criteria:**

```gherkin
GIVEN a supervisor has rejected my goal with comments
WHEN I view the goal detail or list
THEN the rejection comment should be displayed prominently
AND the comment should include:
  - Rejection reason/feedback
  - Rejected by (supervisor name)
  - Rejected date
AND the display should use a warning/alert style (e.g., yellow/red banner)

GIVEN I edit a rejected goal and the status changes to "draft"
WHEN I view the goal during editing
THEN the rejection comment should STILL be visible
AND the comment should persist until I successfully resubmit
AND it should include the original review timestamp for context
[CRITICAL: Display based on supervisorReview.action === 'REJECTED', not goal.status === 'rejected']

GIVEN the rejection comment is long (>200 characters)
WHEN viewing in list view
THEN show truncated comment with "Read more" link
AND clicking "Read more" expands full comment or opens detail view

GIVEN a goal has a SupervisorReview with action='REJECTED'
WHEN viewing the goal regardless of current status (draft/rejected/submitted)
THEN rejection comments should be visible
AND the display should clarify the review timestamp
AND it should help subordinates maintain context during editing

GIVEN supervisor did not provide a comment (optional field)
WHEN viewing rejected goal
THEN show generic message: "目標が差し戻されました。上司に詳細を確認してください。"
```

### Requirement 3: Edit and Resubmit Rejected Goals

**User Story:**
> As an employee, I want to edit my rejected goals and resubmit them easily so that I can address supervisor feedback and get approval.

**Acceptance Criteria:**

```gherkin
GIVEN I have a goal with status "rejected"
WHEN I click "Edit & Resubmit" button
THEN I should be redirected to the goal edit page
AND the rejection comment should remain visible while editing (persistent based on SupervisorReview)
AND all goal fields should be editable

GIVEN I am editing a rejected goal
WHEN I make changes and save as draft
THEN the goal status may change to "draft"
BUT the SupervisorReview with action='REJECTED' persists in the database
AND rejection comments REMAIN visible in the UI during editing
AND I should see a "Save Draft" button to save without resubmitting
AND I should see a "Resubmit for Approval" button

GIVEN I click "Resubmit for Approval"
WHEN all required fields are valid
THEN the goal status should change from "rejected" to "submitted"
AND a success message should appear: "目標を再提出しました"
AND I should be redirected to the goal list
AND supervisor should receive notification (if notification system exists)

GIVEN I have made changes to a rejected goal but haven't resubmitted
WHEN I navigate away from the edit page
THEN I should see a confirmation dialog: "変更が保存されていません。ページを離れますか？"
AND I can choose to save draft, resubmit, or discard changes
```

### Requirement 4: Goal List Page with Filtering and Navigation

**User Story:**
> As an employee, I want to filter and navigate my goals easily so that I can focus on goals that need my attention.

**Acceptance Criteria:**

```gherkin
GIVEN I am on the goal list page
WHEN the page loads
THEN I should see filter options for:
  - Status (draft, submitted, approved, rejected)
  - Evaluation Period
  - Goal Category (業績目標, コンピテンシー, コアバリュー)
AND default filter should show current period's goals

GIVEN I filter by status "rejected"
WHEN viewing the list
THEN only rejected goals should be displayed
AND a count badge should show total rejected goals

GIVEN I have no goals matching the filter
WHEN viewing filtered list
THEN show empty state message: "該当する目標がありません"
AND provide link to create new goals (if applicable)

GIVEN I click on a goal in the list
WHEN the detail view opens
THEN I should see:
  - Full goal details
  - Complete rejection comments (if rejected)
  - Review history
  - Action buttons based on status
```

### Requirement 5: Integration with Goal Creation Flow (TASK-04)

**User Story:**
> As an employee, when I try to create new goals but already have submitted goals, I want clear guidance on what to do next.

**Acceptance Criteria:**

```gherkin
GIVEN I navigate to the goal creation page
AND I have goals with status "submitted" for the current period
WHEN the page loads
THEN I should see an alert (from TASK-04): "目標は既に提出されています"
AND the alert should include a link: "目標一覧ページで確認してください"
AND clicking the link should navigate to the goal list page (TASK-05)

GIVEN I have goals with status "rejected" for the current period
WHEN I navigate to the goal creation page
THEN I should see an informational message: "差し戻された目標があります"
AND the message should include a link to the goal list
AND I CAN create new goals (TASK-04 allows creation when only rejected goals exist)

GIVEN I have goals with status "approved" for the current period
WHEN I navigate to the goal creation page
THEN I should see an alert: "承認済みの目標があります"
AND the message should indicate I cannot create new goals
AND provide link to view approved goals
```

### Requirement 6: Supervisor Review Comments Display (Read-only for Subordinates)

**User Story:**
> As an employee, I want to see all supervisor reviews related to my goals so that I have complete visibility into the approval process.

**Acceptance Criteria:**

```gherkin
GIVEN a supervisor has left comments on my goal (even if status is not rejected)
WHEN I view the goal detail
THEN I should see a "Supervisor Reviews" section
AND it should display all reviews with:
  - Review action (APPROVED / REJECTED / PENDING)
  - Comment text
  - Reviewer name
  - Review date
AND reviews should be sorted by date (newest first)

GIVEN a goal has status "approved" with approval comments
WHEN viewing the goal
THEN approval comments should be displayed
AND use positive styling (green banner)

GIVEN a goal has status "submitted" with pending review
WHEN viewing the goal
THEN show message: "承認待ち - レビューコメントはまだありません"
```

### Requirement 7: Non-functional Requirements - Performance & UX

**Requirements:**
- Goal list should load quickly (<2 seconds for 50 goals)
- Filtering should be instant (client-side if possible)
- Clear loading states during data fetching
- Mobile-responsive design
- Accessible UI (keyboard navigation, screen readers)

**Acceptance Criteria:**

```gherkin
GIVEN the goal list page is loading
WHEN data is being fetched
THEN show loading skeleton or spinner
AND prevent user interaction until loaded

GIVEN I am using the page on mobile device
WHEN viewing goal list or details
THEN layout should adapt to small screens
AND all actions should be easily accessible

GIVEN I am using keyboard navigation
WHEN navigating the goal list
THEN I can tab through goals and actions
AND pressing Enter should trigger primary action
```

### Requirement 8: Error Handling and Edge Cases

**Requirements:**
Handle errors gracefully and provide clear feedback.

**Acceptance Criteria:**

```gherkin
GIVEN the API fails to fetch goals
WHEN the error occurs
THEN show error message: "目標の読み込みに失敗しました"
AND provide "Retry" button

GIVEN I try to resubmit a goal but the API fails
WHEN the error occurs
THEN show error toast with failure reason
AND goal status should remain unchanged
AND changes should be preserved (auto-save if possible)

GIVEN I have a goal that was rejected but the comment is missing from database
WHEN viewing the goal
THEN show placeholder: "コメントなし"
AND still allow resubmission
```

## 3. Out of Scope

**Not included in TASK-05:**
- ❌ Backend rejection API implementation (already exists)
- ❌ Notification system for supervisors when goals are resubmitted
- ❌ Bulk goal operations (reject all, approve all)
- ❌ Goal version history/changelog
- ❌ Comments from subordinates to supervisors
- ❌ Duplicate goal creation blocking (handled by TASK-04)

## 4. Success Metrics

- ✅ Employees can see all their goals grouped by status
- ✅ Rejection comments are clearly visible and actionable
- ✅ Rejected goals can be edited and resubmitted in <2 minutes
- ✅ Goal list page loads in <2 seconds
- ✅ Integration with TASK-04 provides seamless navigation
- ✅ Zero confusion about which goals are under review

## 5. Dependencies

- **TASK-04**: Provides duplicate creation blocking and basic error messages
- **Backend APIs**: Existing endpoints for fetching goals, submitting, and rejection
- **SupervisorReview model**: Stores rejection comments (already exists)
- **shadcn/ui components**: Alert, Card, Badge, Button, Skeleton (already in project)
