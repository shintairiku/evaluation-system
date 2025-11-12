# Task Breakdown: Goal Input Weight Sync & Deletion

## T1. Current-state analysis
- Trace the `/goal-input` deletion flow and confirm no layer triggers a DB delete.
- Compare GoalService’s weight totals with sample DB data to list divergence patterns.
- Document success/failure response shapes so the frontend knows which error keys to surface.

## T2. API wiring & UI sync
- Call `deleteGoalAction` whenever a persisted goal (UUID) is removed via the UI.
- On success, drop the goal from local state and prompt users to re-fetch instead of a fake undo; on failure, roll back local changes and show an error toast.
- Ensure weight indicators re-render after the deletion promise settles.

## T3. Remaining-weight refresh
- After any goal CRUD succeeds, re-fetch the latest performance goals or totals and sync the state.
- When a stage budget has 0% for a category (e.g., qualitative), disable the add button and show an explanatory label.
- Verify the flow still works when all existing goals are deleted (auto-save + display keep functioning).

## T4. Logging & telemetry
- Include `errorMessage`, `goalId`, `bucket`, and `currentTotals` in auto-save failure logs for easier debugging.
- Localize toast messages for common API failures (“定量目標が70%を超えています” etc.) so users immediately understand the cause.

## T5. QA / Testing
- Unit: goal-tracking hook, stage-budget helper functions.
- Integration: frontend → server action → FastAPI → DB (happy path / over-budget / zero-budget scenarios).
- Manual: sync checks (delete → reload, add → remaining weight updates).
