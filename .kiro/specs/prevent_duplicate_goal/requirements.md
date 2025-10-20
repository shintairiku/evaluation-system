# Requirements Document: Prevent Duplicate Goal Creation After Submission

## 1. Overview

This document defines the requirements for preventing duplicate Goal creation after submission in the HR Evaluation System. Currently, when a subordinate submits a Goal (status: `submitted`), they can still create new Goals for the same evaluation period. This can lead to confusion, duplicate entries, and potential inconsistencies between what the subordinate sees and what the supervisor sees during the review process.

**Problem Statement:**
- Users can create multiple Goal sets for the same evaluation period
- Once a Goal is submitted for approval (status: `submitted`), creating additional Goals creates ambiguity
- This leads to confusion about which Goals are under review
- Potential for data inconsistencies between subordinate and supervisor views

**Target Users:**
- Employees creating Goals
- API consumers (frontend applications)

**Scope Note:**
This task (TASK-04) focuses **ONLY** on preventing duplicate goal creation via **frontend validation** with minimal backend changes.

**Implementation Approach:**
✅ **Frontend-first validation** - Check for blocking statuses (submitted/approved) before allowing goal creation
✅ **Reuse existing APIs** - Use current `GET /api/v1/goals` endpoint with status filtering
✅ **Minimal backend changes** - Backend already supports all necessary functionality
✅ **Quick to implement and test** - Reduced complexity, faster delivery

**Out of Scope (deferred to TASK-05):**
- ❌ Displaying detailed list of submitted goals
- ❌ Showing supervisor rejection comments
- ❌ UI for editing rejected goals
- ❌ Complete resubmission workflow
- ❌ Notifications for supervisors about goal updates
- ❌ New backend validation endpoints (not needed - frontend checks are sufficient)

The goal of TASK-04 is to **block the creation**, not to build the complete UX for managing submitted/rejected goals.

## 2. Requirements List

### Requirement 1: Prevent Goal Creation When Submitted Goal Exists

**User Story:**
> As an employee, I want to be prevented from creating new Goals when I already have a submitted Goal set for the current evaluation period. Because having multiple Goal sets is confusing and could lead to inconsistent evaluations.

**Acceptance Criteria:**

```gherkin
GIVEN I am an authenticated employee
AND I have at least one Goal with status "submitted" for a specific evaluation period
WHEN I attempt to create a new Goal for the same evaluation period
THEN the system should reject the request with a clear error message
AND return HTTP 409 Conflict status code

GIVEN I am an authenticated employee
AND I have no Goals with status "submitted" for a specific evaluation period
AND I only have Goals with status "draft", "approved", or "rejected"
WHEN I attempt to create a new Goal for the same evaluation period
THEN the system should allow the Goal creation
AND return HTTP 200 OK with the created Goal

GIVEN I am an authenticated employee
AND I have Goals with status "submitted" for Period A
WHEN I attempt to create a new Goal for Period B (different period)
THEN the system should allow the Goal creation
AND return HTTP 200 OK with the created Goal
```

### Requirement 2: Frontend Validation Logic (Primary Implementation)

**User Story:**
> As a system, I want to validate Goal creation at the frontend using existing API data to prevent duplicate submissions efficiently.

**Acceptance Criteria:**

```gherkin
GIVEN the user navigates to the Goal creation page
WHEN the page loads or period is selected
THEN the system should fetch existing Goals using GET /api/v1/goals
AND filter Goals by periodId and check for blocking statuses
AND determine if goal creation should be allowed

GIVEN Goals are fetched for the current period
WHEN processing the goal list
THEN check if any goal has status "submitted" OR "approved"
AND if blocking goals exist, set UI to blocking state
AND if no blocking goals exist, allow normal goal creation flow

GIVEN a blocking goal is detected
WHEN rendering the UI
THEN display alert message: "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
AND disable the goal creation form
AND provide link to goal list page for viewing submitted goals
```

**Implementation Note:**
Backend validation is **optional** and can be added later as a safety net. The frontend validation using existing API endpoints is sufficient for the MVP and reduces implementation complexity.

### Requirement 3: Frontend Validation and User Feedback

**User Story:**
> As an employee, I want to see clear feedback when I cannot create new Goals. Because I need to understand why the action is blocked and what I should do instead.

**Acceptance Criteria:**

```gherkin
GIVEN I am on the Goal creation page
AND I have already submitted Goals for the current period
WHEN the page loads or period is selected
THEN the system should check for existing submitted Goals
AND display a clear message indicating Goals are already submitted
AND disable or hide the "Create New Goal" functionality

GIVEN I am viewing my submitted Goals
WHEN I click to create a new Goal
THEN the system should show a toast/alert message: "目標は既に提出されています"
AND explain that I cannot create new Goals while submitted Goals exist

GIVEN the Goal creation is blocked
WHEN I see the error message
THEN it should provide guidance such as:
- "承認待ちの目標を編集する場合は、目標一覧から編集してください"
- "新しい目標を作成するには、提出済みの目標を下書きに戻す必要があります"
```

### Requirement 4: Manual Testing Coverage

**User Story:**
> As a developer, I want comprehensive manual tests to ensure the validation works correctly in all scenarios. Because this business rule is critical for data integrity.

**Acceptance Criteria:**

```gherkin
GIVEN the implementation is complete
WHEN running manual E2E tests
THEN it should cover:
- Creating Goal when no submitted Goals exist (should allow)
- Creating Goal when submitted Goal exists (should block)
- Creating Goal when approved Goal exists (should block)
- Creating Goal when only rejected/draft Goals exist (should allow)
- Creating Goal for different period (should allow)
- Switching between periods with/without blocking goals
- Alert message display and link to goal list
- Form disable state when blocked

GIVEN test scenarios are defined
WHEN tests are executed
THEN they should verify:
- UI correctly displays blocking alert
- Form is properly disabled when blocked
- Link to goal list works correctly
- No blocking when only draft/rejected goals exist
- Period-specific validation works
```

**Note:** Frontend automated tests are not in project scope. Backend unit tests are **optional** since no new backend logic is added.

### Requirement 5: Non-functional Requirements - Performance

**Requirements:**
The validation should execute efficiently without impacting user experience.

**Acceptance Criteria:**

```gherkin
GIVEN the validation is implemented
WHEN the Goal creation page loads
THEN the GET /api/v1/goals request should:
- Use existing indexed columns (user_id, period_id, status)
- Execute in under 200ms for typical dataset sizes (already optimized)
- Not cause additional database queries beyond what currently exists

GIVEN the user changes evaluation period
WHEN the page refetches goals
THEN the validation check should:
- Execute instantly on client-side (no additional API calls)
- Not cause UI lag or blocking
- Reuse data already fetched for displaying draft goals
```

**Note:** Performance is already optimized since we're reusing existing API calls. No new queries or endpoints are added.

### Requirement 6: Maintain Existing Goal Lifecycle

**Requirements:**
The validation should not interfere with existing Goal workflows and status transitions.

**Acceptance Criteria:**

```gherkin
GIVEN a user has submitted Goals (status: "submitted")
WHEN a supervisor approves the Goals
THEN the status changes to "approved"
AND the user can still not create new Goals for that period

GIVEN a user has submitted Goals (status: "submitted")
WHEN a supervisor rejects the Goals
THEN the status changes to "rejected"
AND the user CAN create new Goals or edit rejected Goals

GIVEN a user has Goals with status "draft"
WHEN the user wants to create additional draft Goals
THEN the system should allow creation
AND not block based on draft status

GIVEN a user has Goals with status "approved"
WHEN the user wants to create new Goals for the same period
THEN the system should prevent creation
AND show appropriate message about approved Goals
```
