# [TASK-04] sub02 - Prevent duplicate Goal creation - Backend Implementation

## 📝 Description
Implement backend validation to prevent duplicate Goal creation when a Goal with `submitted` or `approved` status already exists for the same user and period.

## ✅ Implementation Checklist

### 1. Repository Layer (`goal_repo.py`)
- [ ] Add method `check_submitted_goals_exist(user_id: UUID, period_id: UUID, org_id: str) -> bool`
- [ ] Implement SQL query with `EXISTS` clause
- [ ] Filter by `user_id`, `period_id`, `status IN ('submitted', 'approved')`
- [ ] Apply organization scope via `apply_org_scope_via_user`
- [ ] Add comprehensive docstring
- [ ] Verify existing index usage

### 2. Service Layer (`goal_service.py`)
- [ ] Add validation in `create_goal()` after org context validation
- [ ] Call `check_submitted_goals_exist()` before creating goal
- [ ] If `True`: raise `ConflictError` with Japanese message:
  ```
  "目標は既に提出されています。提出済みの目標がある場合、新しい目標を作成することはできません。"
  ```
- [ ] If `False`: continue with normal flow
- [ ] Add logging when blocking occurs
- [ ] Verify `ConflictError` is imported

### 3. API Endpoint (`goals.py`)
- [ ] Verify endpoint already handles `ConflictError` → HTTP 409
- [ ] Confirm error message passes unchanged (Japanese)

## 📁 Files Modified
```
backend/app/database/repositories/goal_repo.py
backend/app/services/goal_service.py
backend/app/api/v1/goals.py (verification only)
```

## 🧪 Unit Tests Included

### Repository Tests (`test_goal_repo.py`)
- [ ] `test_check_submitted_goals_exist_returns_true_for_submitted()`
- [ ] `test_check_submitted_goals_exist_returns_true_for_approved()`
- [ ] `test_check_submitted_goals_exist_returns_false_when_only_draft()`
- [ ] `test_check_submitted_goals_exist_returns_false_when_only_rejected()`
- [ ] `test_check_submitted_goals_exist_returns_false_when_no_goals()`
- [ ] `test_check_submitted_goals_exist_scoped_to_period()`
- [ ] `test_check_submitted_goals_exist_scoped_to_user()`
- [ ] `test_check_submitted_goals_exist_scoped_to_org()`

### Service Tests (`test_goal_service.py`)
- [ ] `test_create_goal_raises_conflict_when_submitted_exists()`
- [ ] `test_create_goal_raises_conflict_when_approved_exists()`
- [ ] `test_create_goal_succeeds_when_only_draft_exists()`
- [ ] `test_create_goal_succeeds_when_only_rejected_exists()`
- [ ] `test_create_goal_succeeds_when_no_goals_exist()`
- [ ] `test_create_goal_allows_different_period()`
- [ ] `test_create_goal_error_message_in_japanese()`

## ✅ Definition of Done
- [ ] Code implemented and committed
- [ ] All unit tests passing
- [ ] Backend linting OK (`ruff check .` and `mypy .`)
- [ ] Inline comments added
- [ ] Performance verified: query <50ms

## 📊 Estimate
**1-1.5 days**

## 🔗 Related
- Parent: #272
- Depends on: #273 ([TASK-04] sub01)
- Blocks: [TASK-04] sub03, sub04

## 📋 Specifications
See: `.kiro/specs/prevent_duplicate_goal/`
- requirements.md
- design.md
- tasks.md

## 🏷️ Labels
`backend`, `enhancement`, `goal-management`
