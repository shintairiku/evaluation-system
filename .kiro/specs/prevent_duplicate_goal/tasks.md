# Implementation Plan: Prevent Duplicate Goal Creation After Submission

> This document breaks down the implementation into specific development tasks based on the design document. Tasks are organized by layer (backend, frontend, testing) and include traceability to requirements.

## Feature: Prevent Duplicate Goal Creation After Submission

### 1. Backend Implementation - Database Layer

> Implement the database query logic to check for submitted goals

- [ ] **1.1. Add `check_submitted_goals_exist` method to GoalRepository**
  > Create a new repository method that checks if submitted or approved goals exist for a user and period.
  >
  > **File:** `backend/app/database/repositories/goal_repo.py`
  >
  > **Implementation:**
  > - Add async method `check_submitted_goals_exist(user_id: UUID, period_id: UUID, org_id: str) -> bool`
  > - Use SQLAlchemy `select` with `exists()` clause
  > - Filter by `user_id`, `period_id`, and `status IN ('submitted', 'approved')`
  > - Apply organization scope via `apply_org_scope_via_user` helper
  > - Return boolean result
  > - Add comprehensive docstring explaining the method purpose
  >
  > **Related Requirements:** 1.1, 2.1, 5.1

- [ ] **1.2. Verify existing database indexes support the query**
  > Ensure the query uses existing indexes for optimal performance.
  >
  > **Verification Steps:**
  > - Check that `idx_goals_user_period` index exists on `(user_id, period_id)`
  > - Check that `idx_goals_status_category` index exists on `(status, goal_category)`
  > - Use `EXPLAIN ANALYZE` on the query to verify index usage
  > - Ensure query execution time is <50ms
  >
  > **Related Requirements:** 5.1

### 2. Backend Implementation - Service Layer

> Add business logic validation in the service layer

- [ ] **2.1. Add validation check in `GoalService.create_goal` method**
  > Modify the goal creation service to check for submitted goals before creation.
  >
  > **File:** `backend/app/services/goal_service.py`
  >
  > **Implementation:**
  > - In `create_goal` method, after organization context validation
  > - Call `self.goal_repo.check_submitted_goals_exist(target_user_id, goal_data.period_id, org_id)`
  > - If returns `True`, raise `ConflictError` with Japanese message:
  >   - "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
  > - If returns `False`, proceed with existing validation flow
  > - Add logging for when validation blocks creation
  >
  > **Related Requirements:** 1.1, 2.1, 6.1

- [ ] **2.2. Ensure ConflictError exception is imported and available**
  > Verify that ConflictError is properly imported in goal_service.py.
  >
  > **File:** `backend/app/services/goal_service.py`
  >
  > **Verification:**
  > - Check `from ..core.exceptions import ConflictError` is present
  > - If not, add to imports
  >
  > **Related Requirements:** 2.1

### 3. Backend Implementation - API Endpoint Layer

> Verify API endpoint properly handles the new validation

- [ ] **3.1. Verify ConflictError handling in POST /api/v1/goals endpoint**
  > Ensure the API endpoint catches ConflictError and returns HTTP 409.
  >
  > **File:** `backend/app/api/v1/goals.py`
  >
  > **Verification:**
  > - Confirm `create_goal` endpoint has `except ConflictError as e:` block
  > - Confirm it raises `HTTPException` with `status_code=http_status.HTTP_409_CONFLICT`
  > - Confirm error message is passed through unchanged (for Japanese message)
  > - **Note:** Existing code already handles this, just verify it works correctly
  >
  > **Related Requirements:** 2.1, 2.2

### 4. Backend Testing - Unit Tests

> Comprehensive unit tests for repository and service layers

- [ ] **4.1. Create repository unit tests for `check_submitted_goals_exist`**
  > Test the repository method with various scenarios.
  >
  > **File:** `backend/tests/repositories/test_goal_repo.py`
  >
  > **Test Cases:**
  > ```python
  > async def test_check_submitted_goals_exist_returns_true_for_submitted():
  >     """Should return True when submitted goals exist"""
  >
  > async def test_check_submitted_goals_exist_returns_true_for_approved():
  >     """Should return True when approved goals exist"""
  >
  > async def test_check_submitted_goals_exist_returns_false_when_only_draft():
  >     """Should return False when only draft goals exist"""
  >
  > async def test_check_submitted_goals_exist_returns_false_when_only_rejected():
  >     """Should return False when only rejected goals exist"""
  >
  > async def test_check_submitted_goals_exist_returns_false_when_no_goals():
  >     """Should return False when no goals exist at all"""
  >
  > async def test_check_submitted_goals_exist_scoped_to_period():
  >     """Should not detect submitted goals from different period"""
  >
  > async def test_check_submitted_goals_exist_scoped_to_user():
  >     """Should not detect submitted goals from different user"""
  >
  > async def test_check_submitted_goals_exist_scoped_to_org():
  >     """Should not detect submitted goals from different organization"""
  > ```
  >
  > **Related Requirements:** 4.1, 4.2

- [ ] **4.2. Create service unit tests for goal creation validation**
  > Test the service layer validation logic.
  >
  > **File:** `backend/tests/services/test_goal_service.py`
  >
  > **Test Cases:**
  > ```python
  > async def test_create_goal_raises_conflict_when_submitted_exists():
  >     """Should raise ConflictError when submitted goal exists"""
  >
  > async def test_create_goal_raises_conflict_when_approved_exists():
  >     """Should raise ConflictError when approved goal exists"""
  >
  > async def test_create_goal_succeeds_when_only_draft_exists():
  >     """Should allow creation when only draft goals exist"""
  >
  > async def test_create_goal_succeeds_when_only_rejected_exists():
  >     """Should allow creation when only rejected goals exist"""
  >
  > async def test_create_goal_succeeds_when_no_goals_exist():
  >     """Should allow creation when no goals exist"""
  >
  > async def test_create_goal_allows_different_period():
  >     """Should allow creation for different period even if submitted goals exist"""
  >
  > async def test_create_goal_error_message_in_japanese():
  >     """Should return Japanese error message"""
  > ```
  >
  > **Related Requirements:** 4.1, 4.2

### 5. Backend Testing - Integration Tests

> API endpoint integration tests

- [ ] **5.1. Create API integration tests for goal creation**
  > Test the complete API flow including authentication and error responses.
  >
  > **File:** `backend/tests/api/test_goals_api.py` (create if doesn't exist)
  >
  > **Test Cases:**
  > ```python
  > async def test_create_goal_returns_409_when_submitted_exists():
  >     """POST /api/v1/goals should return 409 Conflict"""
  >
  > async def test_create_goal_returns_201_when_no_submitted_exists():
  >     """POST /api/v1/goals should return 201 Created"""
  >
  > async def test_create_goal_409_response_format():
  >     """Verify 409 response has correct structure and message"""
  >
  > async def test_create_goal_409_message_in_japanese():
  >     """Verify error message is in Japanese"""
  > ```
  >
  > **Related Requirements:** 4.1, 4.2

### 6. Frontend Implementation - Validation and UX

> Add frontend validation and user feedback

- [ ] **6.1. Add proactive check for submitted goals on period selection**
  > Check for submitted goals when user selects an evaluation period.
  >
  > **File:** `frontend/src/hooks/usePeriodSelection.ts` or `frontend/src/feature/goal-input/display/index.tsx`
  >
  > **Implementation:**
  > - After period selection, call `getGoalsAction({ periodId, status: ['submitted', 'approved'] })`
  > - Store result in state: `hasSubmittedGoals: boolean`
  > - If submitted goals exist, set flag to true
  > - Pass this state to child components
  >
  > **Related Requirements:** 3.1, 3.2, 3.3

- [ ] **6.2. Display informational alert when submitted goals exist**
  > Show a clear message to users when they cannot create new goals.
  >
  > **File:** `frontend/src/feature/goal-input/display/index.tsx`
  >
  > **Implementation:**
  > - Import `Alert` component from shadcn/ui
  > - Conditionally render alert when `hasSubmittedGoals === true`
  > - Alert message:
  >   - Title: "目標は既に提出されています"
  >   - Description: "承認待ちの目標を編集する場合は、目標一覧から編集してください。新しい目標を作成するには、提出済みの目標を下書きに戻す必要があります。"
  > - Use `info` or `warning` variant
  > - Position alert prominently at top of page
  >
  > **Related Requirements:** 3.2, 3.3

- [ ] **6.3. Handle 409 Conflict error from goal creation API**
  > Catch and display backend validation errors appropriately.
  >
  > **File:** `frontend/src/hooks/useGoalAutoSave.ts` or relevant goal creation handler
  >
  > **Implementation:**
  > - Wrap goal creation API calls in try-catch
  > - Check if error status is 409
  > - Display toast message with error detail from backend
  > - Use `toast.error()` to show the Japanese message
  > - Optionally, update `hasSubmittedGoals` state to trigger UI alert
  >
  > **Related Requirements:** 3.2, 3.3

- [ ] **6.4. (Optional) Disable "Add Goal" buttons when submitted goals exist**
  > Prevent user from attempting to create goals when blocked.
  >
  > **Files:**
  > - `frontend/src/feature/goal-input/display/PerformanceGoalsStep.tsx`
  > - `frontend/src/feature/goal-input/display/CompetencyGoalsStep.tsx`
  >
  > **Implementation:**
  > - Pass `hasSubmittedGoals` prop to step components
  > - Disable or hide "Add Goal" buttons when `hasSubmittedGoals === true`
  > - Show tooltip on disabled button: "提出済みの目標があるため追加できません"
  >
  > **Related Requirements:** 3.1, 3.2

### 7. Frontend Testing

> Frontend unit and integration tests

- [ ] **7.1. Create component tests for submitted goal detection**
  > Test that the UI correctly responds to submitted goals.
  >
  > **File:** `frontend/src/feature/goal-input/__tests__/GoalInputPage.test.tsx` (create if doesn't exist)
  >
  > **Test Cases:**
  > - Render alert when submitted goals exist
  > - Don't render alert when no submitted goals
  > - Disable add buttons when submitted goals exist (if implemented)
  > - Display toast on 409 error
  >
  > **Related Requirements:** 4.1

- [ ] **7.2. Create API error handling tests**
  > Test that 409 errors are properly caught and displayed.
  >
  > **File:** `frontend/src/hooks/__tests__/useGoalAutoSave.test.ts` (or relevant file)
  >
  > **Test Cases:**
  > - Mock 409 response from API
  > - Verify toast.error is called with correct message
  > - Verify state updates appropriately
  >
  > **Related Requirements:** 4.1

### 8. Documentation and Code Review

> Ensure code quality and documentation

- [ ] **8.1. Add inline code comments explaining validation logic**
  > Document the "why" behind validation checks.
  >
  > **Files:**
  > - `backend/app/database/repositories/goal_repo.py`
  > - `backend/app/services/goal_service.py`
  >
  > **Comments to Add:**
  > - Explain why submitted and approved goals block creation
  > - Note that draft and rejected goals allow creation
  > - Reference requirements document for business context
  >
  > **Related Requirements:** All

- [ ] **8.2. Update API documentation (if applicable)**
  > Document the new 409 error response.
  >
  > **File:** `docs/requirement-definition/02-tech/api/endpoints.md` (if exists)
  >
  > **Updates:**
  > - Add 409 Conflict response to POST /api/v1/goals documentation
  > - Include example error message in Japanese
  > - Explain when this error occurs
  >
  > **Related Requirements:** 2.2

- [ ] **8.3. Code review and testing verification**
  > Ensure all tests pass and code meets quality standards.
  >
  > **Checklist:**
  > - [ ] All backend unit tests pass
  > - [ ] All backend integration tests pass
  > - [ ] All frontend tests pass
  > - [ ] Backend linting passes (ruff, mypy)
  > - [ ] Frontend linting passes (eslint, tsc)
  > - [ ] Manual testing in development environment
  > - [ ] Code review approval from team member
  >
  > **Related Requirements:** 4.1, 4.2

### 9. Integration Testing and QA

> Manual testing and verification

- [ ] **9.1. Manual testing: Create → Submit → Attempt Create (should block)**
  > Verify the core blocking functionality works end-to-end.
  >
  > **Test Steps:**
  > 1. Log in as employee
  > 2. Select evaluation period
  > 3. Create and save draft goals (業績目標 + コンピテンシー)
  > 4. Submit goals for approval
  > 5. Attempt to create new goal for same period
  > 6. Verify: Alert shown on page, API returns 409, toast displays error
  >
  > **Expected Result:** Goal creation blocked with clear message
  >
  > **Related Requirements:** 1.1, 2.1, 3.1

- [ ] **9.2. Manual testing: Create → Reject → Attempt Create (should allow)**
  > Verify that rejected goals allow new creation.
  >
  > **Test Steps:**
  > 1. Log in as employee with submitted goals
  > 2. Log in as supervisor, reject the goals
  > 3. Log back in as employee
  > 4. Verify: Can create new goals
  >
  > **Expected Result:** Goal creation allowed
  >
  > **Related Requirements:** 6.1

- [ ] **9.3. Manual testing: Different periods (should allow)**
  > Verify period isolation.
  >
  > **Test Steps:**
  > 1. Create and submit goals for Period A
  > 2. Select Period B (different period)
  > 3. Attempt to create goals
  >
  > **Expected Result:** Goal creation allowed for Period B
  >
  > **Related Requirements:** 1.1

- [ ] **9.4. Manual testing: Performance verification**
  > Verify validation doesn't impact performance.
  >
  > **Test Steps:**
  > 1. Create 100+ goals in database (test data)
  > 2. Attempt to create new goal
  > 3. Monitor network tab for API response time
  >
  > **Expected Result:** API response time <500ms, validation query <50ms
  >
  > **Related Requirements:** 5.1

### 10. Deployment and Monitoring

> Prepare for production deployment

- [ ] **10.1. Add logging for validation blocking**
  > Log when goal creation is blocked for monitoring.
  >
  > **File:** `backend/app/services/goal_service.py`
  >
  > **Implementation:**
  > - Add `logger.info()` when validation blocks creation
  > - Include user_id, period_id, and reason in log
  > - Example: `logger.info(f"Goal creation blocked for user {user_id} period {period_id}: submitted goals exist")`
  >
  > **Related Requirements:** All

- [ ] **10.2. Prepare rollback plan documentation**
  > Document how to rollback if issues occur.
  >
  > **File:** Create `ROLLBACK.md` in spec folder
  >
  > **Content:**
  > - Steps to disable validation
  > - Feature flag approach (if applicable)
  > - Database rollback steps (none needed)
  > - Monitoring checklist
  >
  > **Related Requirements:** All

- [ ] **10.3. Create monitoring dashboard queries (optional)**
  > Add metrics to track validation blocking frequency.
  >
  > **Metrics to Track:**
  > - Number of 409 errors per day
  > - Users affected by blocking
  > - Most common blocking scenario
  >
  > **Related Requirements:** All

## Summary

**Total Tasks:** 30
**Estimated Effort:** 3-5 developer days
- Backend: 1-2 days (implementation + tests)
- Frontend: 1-2 days (implementation + tests)
- QA & Documentation: 1 day

**Dependencies:**
- Backend tasks must complete before frontend tasks
- Unit tests should complete before integration tests
- All tests must pass before deployment

**Success Criteria:**
- All tests passing
- Manual QA scenarios verified
- Code review approved
- Documentation updated
