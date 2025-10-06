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

### Requirement 2: Backend Validation with Clear Error Messages

**User Story:**
> As a system, I want to validate Goal creation requests at the backend to ensure data integrity. Because client-side validation alone is insufficient for maintaining data consistency.

**Acceptance Criteria:**

```gherkin
GIVEN a Goal creation request is received
WHEN the system validates the request
THEN it should query the database for existing submitted Goals for the same user and period
AND if a submitted Goal exists, reject with error: "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
AND return HTTP 409 Conflict status code

GIVEN a Goal creation request is rejected due to existing submitted Goal
WHEN the error response is returned
THEN it should include:
- Clear error message in Japanese
- HTTP 409 Conflict status code
- Structured error format matching existing API error patterns
```

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

### Requirement 4: Comprehensive Test Coverage

**User Story:**
> As a developer, I want comprehensive tests to ensure the validation works correctly in all scenarios. Because this business rule is critical for data integrity.

**Acceptance Criteria:**

```gherkin
GIVEN the implementation is complete
WHEN running the test suite
THEN it should include:
- Backend unit tests for the validation logic in GoalRepository
- Backend service tests for GoalService.create_goal with submitted Goals
- Backend API endpoint tests for POST /api/v1/goals
- Frontend unit tests for validation hooks/functions
- Integration tests covering the full flow

GIVEN test scenarios are defined
WHEN tests are executed
THEN they should cover:
- Creating Goal when no submitted Goals exist (success)
- Creating Goal when submitted Goal exists (rejection)
- Creating Goal for different period (success)
- Multiple users with submitted Goals (isolation)
- Edge cases: rejected Goals, approved Goals, draft Goals
```

### Requirement 5: Non-functional Requirements - Performance

**Requirements:**
The validation query should execute efficiently without impacting Goal creation performance.

**Acceptance Criteria:**

```gherkin
GIVEN the validation is implemented
WHEN a Goal creation request is processed
THEN the database query to check for submitted Goals should:
- Use indexed columns (user_id, period_id, status)
- Execute in under 50ms for typical dataset sizes
- Not cause N+1 query problems

GIVEN multiple concurrent Goal creation requests
WHEN the system is under load
THEN the validation should:
- Maintain data consistency using appropriate transaction isolation
- Not cause race conditions allowing duplicate submissions
- Handle concurrent requests gracefully
```

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
