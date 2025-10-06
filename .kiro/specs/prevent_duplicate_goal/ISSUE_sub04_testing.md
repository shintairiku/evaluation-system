# [TASK-04] sub04 - Prevent duplicate Goal creation - Integration & E2E Testing

## 📝 Description
Create backend integration tests and manual E2E tests to validate the complete duplicate Goal prevention flow.

## ✅ Implementation Checklist

### 1. Backend Integration Tests (`test_goals_api.py`)
- [ ] Create file if doesn't exist: `backend/tests/api/test_goals_api.py`
- [ ] Implement tests:
  - [ ] `test_create_goal_returns_409_when_submitted_exists()`
  - [ ] `test_create_goal_returns_201_when_no_submitted_exists()`
  - [ ] `test_create_goal_409_response_format()`
  - [ ] `test_create_goal_409_message_in_japanese()`
- [ ] Verify Clerk authentication in tests
- [ ] Validate JSON response structure

### 2. Manual E2E Tests

#### Scenario 1: Block After Submission ✋
- [ ] Login as employee
- [ ] Select evaluation period
- [ ] Create goals (業績目標 + コンピテンシー)
- [ ] Submit goals for approval
- [ ] Attempt to create new goal in same period
- [ ] **Expected**: Alert displayed, API returns 409, error toast shown

#### Scenario 2: Allow After Rejection ✅
- [ ] Login as employee with submitted goals
- [ ] Login as supervisor
- [ ] Reject the goals
- [ ] Login again as employee
- [ ] Attempt to create new goal
- [ ] **Expected**: Creation allowed, no error

#### Scenario 3: Different Periods ✅
- [ ] Create and submit goals for Period A
- [ ] Select Period B (different)
- [ ] Attempt to create goals in Period B
- [ ] **Expected**: Creation allowed

#### Scenario 4: Performance ⚡
- [ ] Create 100+ goals in database (test data)
- [ ] Attempt to create new goal
- [ ] Monitor Network tab in DevTools
- [ ] **Expected**: API response <500ms, query <50ms

### 3. Documentation
- [ ] Add inline comments explaining validation
- [ ] Update `docs/requirement-definition/02-tech/api/endpoints.md` (if exists)
- [ ] Create `.kiro/specs/prevent_duplicate_goal/ROLLBACK.md`
- [ ] Document test scenarios in ROLLBACK.md

## 📁 Files Created/Modified
```
backend/tests/api/test_goals_api.py (create)
.kiro/specs/prevent_duplicate_goal/ROLLBACK.md (create)
docs/requirement-definition/02-tech/api/endpoints.md (update if exists)
```

## ✅ Definition of Done
- [ ] Integration tests implemented and passing
- [ ] All 4 E2E scenarios executed successfully
- [ ] Performance validated (<500ms API)
- [ ] Complete documentation
- [ ] ROLLBACK.md created
- [ ] Code review approved

## 📊 Estimate
**0.5-1 day**

## 🔗 Related
- Parent: #272
- Depends on: [TASK-04] sub02, [TASK-04] sub03
- Final task in the sequence

## 📋 Specifications
See: `.kiro/specs/prevent_duplicate_goal/`
- requirements.md
- design.md
- tasks.md

## 🏷️ Labels
`testing`, `QA`, `documentation`, `goal-management`
