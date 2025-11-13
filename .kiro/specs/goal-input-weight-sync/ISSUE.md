# ISSUE: Goal Input – Stage Weight & Deletion Sync

## Background / Current State
- Deleting a performance goal card on `/goal-input` only mutates client state; no delete request reaches the backend.
- Since StageService now runs `_validate_stage_weight_budget`, lingering goals continue to consume stage budgets, so adding a new goal triggers 400 errors (“入力内容に不備があります”).
- Auto-save logs repeatedly show `Failed to create/update performance goal`, giving users no clear explanation.

## Impact
- Remaining-weight indicators in the UI diverge from the real backend totals, preventing users from adjusting allocations correctly.
- Unexpected 400/422 responses cause both auto-save and manual saves to fail, degrading the goal-input experience.
- Delete actions are not audited and stale goals accumulate in the database.

## High-Level Plan
1. **Deletion sync**: When the delete icon is pressed on a persisted goal (UUID), call `deleteGoalAction` and update the UI based on success/failure.
2. **Weight recalculation**: After any goal CRUD succeeds, fetch the latest goals or weight summary so `PerformanceGoalsStep` stays aligned.
3. **Guards / UX**: Block goal additions for zero-allocation categories and surface the API error message in toasts.
4. **Logging**: Include `errorMessage`, `goalId`, `bucket`, and `currentTotals` in auto-save failure logs.

See `requirements.md` and `tasks.md` for the detailed scope.
