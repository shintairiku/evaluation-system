# [TASK-04] sub04 - Prevent duplicate Goal creation - E2E Testing & Documentation

## 📝 Description
Execute manual E2E tests to validate the complete duplicate Goal prevention flow and document the feature.

**Note:** Backend integration tests are included in sub02.

## ✅ Implementation Checklist

### 1. Manual E2E Tests

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

### 2. Documentation
- [ ] Add inline comments explaining validation
- [ ] Update `docs/requirement-definition/02-tech/api/endpoints.md` (if exists)
- [ ] Create `.kiro/specs/prevent_duplicate_goal/ROLLBACK.md`
- [ ] Document test scenarios in ROLLBACK.md

## 📁 Files Created/Modified
```
.kiro/specs/prevent_duplicate_goal/ROLLBACK.md (create)
docs/requirement-definition/02-tech/api/endpoints.md (update if exists)
```

## ✅ Definition of Done
- [ ] All 4 E2E scenarios executed successfully
- [ ] Performance validated (<500ms API, <50ms query)
- [ ] Complete documentation
- [ ] ROLLBACK.md created
- [ ] Screenshots/video of E2E tests (optional but recommended)
- [ ] Code review approved

## 📊 Estimate
**0.5 day** (manual E2E + documentation)

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
