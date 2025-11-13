# Requirements: Goal Input Weight Sync & Deletion

## 1. Overview
The stage-weight enforcement now happens on the backend, but deleting cards on `/goal-input` only mutates client state. Goals remain in the database, so UI totals diverge from the real stage budgets. Users see available weight in the form, yet auto-save hits 400 responses because the backend still counts the old goals. This effort aligns deletion and persistence so weight calculations always match the configured stage budgets.

## 2. Requirements

### Requirement 1: Consistent goal deletion

**User Story:**
> As an employee editing my performance goals, I need the delete action to remove the goal in the backend immediately, so the UI and database stay consistent and I can save new goals without hidden conflicts.

**Acceptance Criteria:**
```gherkin
WHEN a user clicks the delete icon on an existing performance goal card
THEN the corresponding goal is removed via the API and its weight is released in the DB

WHEN the delete API fails
THEN the UI shows an error and rolls back the local state

WHEN the page is reloaded after deletion
THEN the deleted goal does not reappear
```

### Requirement 2: Real-time stage-weight alignment

**User Story:**
> As an employee with a 70/30 stage allocation, I need the remaining weight indicator on the form to match the backend totals at all times, otherwise I get validation errors when saving.

**Acceptance Criteria:**
```gherkin
WHEN a goal is created/updated/deleted
THEN the frontend’s remaining-weight display matches the server totals

WHEN the page first loads
THEN it fetches the latest allocations from the DB

WHEN a stage has a 0% allocation for a category
THEN the UI blocks goal creation/saving for that category and explains why
```

### Requirement 3: Error handling & auditability

**Needs:**
- Surface the API’s `errorMessage` (or equivalent) whenever goal create/update/delete fails due to stage-weight validation and log it for telemetry.
- Auto-save failures must log enough context (missing fields, over-budget totals, goalId) to diagnose issues quickly.

**Acceptance Criteria:**
```gherkin
GIVEN the API returns a ValidationError during auto-save
WHEN the UI receives the response
THEN it displays the detailed message in the toast/modal

GIVEN the delete API responds with 404/409
WHEN the frontend handles the response
THEN it records the failure reason and goalId in audit logs
```
