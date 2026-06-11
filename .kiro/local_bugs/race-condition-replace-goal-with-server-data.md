# Bug: replaceGoalWithServerData overwrites user input during auto-save (race condition)

## Status
Open

## Severity
Medium (intermittent — depends on timing)

## Description
When creating a new competency or performance goal in the goal-input page, the auto-save mechanism can overwrite the user's latest input with stale data from the server response. This happens because `replaceGoalWithServerData` replaces **all** goal fields with the server response, not just the ID.

## Steps to Reproduce
1. Go to goal-input page, select a period
2. Create a new competency goal
3. Type something in the action plan field (e.g., "teste")
4. Wait ~1 second for the auto-save debounce to trigger the API call
5. **While the API call is in-flight**, edit the field (e.g., delete the final "e" to make it "test")
6. Observe that after the server responds, the field reverts to the old value ("teste")

**Note:** This bug is intermittent. It only occurs when the user edits during the API round-trip window (~200ms-1s depending on network speed).

## Expected Behavior
The user's latest input ("test") should be preserved after auto-save completes.

## Actual Behavior
The field reverts to the value that was sent in the API request ("teste"), discarding the user's latest edit.

## Root Cause

### Problem 1: Full data overwrite in `replaceGoalWithServerData`
**File:** `frontend/src/hooks/useGoalData.ts` (lines 118-145)

The function replaces all goal fields with server response data. Its actual purpose is only to swap the temporary numeric ID (timestamp) with the server-generated UUID. The server does NOT normalize or transform any user-editable fields — it returns them exactly as received.

### Problem 2: Tracking baseline shape mismatch
**File:** `frontend/src/hooks/useGoalAutoSave.ts` (lines 182, 282)

After goal creation, `trackGoalLoad` receives the full `GoalResponse` object (~16 fields including userId, createdAt, competencyNames, etc.). But the goal in React state only has ~4-7 fields. The JSON string comparison in `useGoalTracking` always finds a difference, causing the goal to be permanently marked as "dirty" and triggering unnecessary auto-saves.

## Affected Files
- `frontend/src/hooks/useGoalData.ts` — `replaceGoalWithServerData` function
- `frontend/src/hooks/useGoalAutoSave.ts` — `trackGoalLoad` calls after goal creation

## Affected Pages
- `/goal-input` only (goal-edit uses a different auto-save hook; goal-list does not use these hooks)

## Proposed Fix

### `useGoalData.ts` — Only swap the ID, preserve user data:
```typescript
// Performance goals (lines 119-131):
goal.id === tempId ? { ...goal, id: sanitizedServerId } : goal

// Competency goals (lines 136-141):
goal.id === tempId ? { ...goal, id: sanitizedServerId } : goal
```

### `useGoalAutoSave.ts` — Use latest local data for tracking baseline:
```typescript
// After performance goal creation (lines 179-183):
onGoalReplaceWithServerData(goalId, result.data, 'performance');
const latestPerfGoal = goalDataRef.current.performanceGoals.find(g => g.id === goalId);
trackGoalLoad(result.data.id, 'performance', latestPerfGoal
  ? { ...latestPerfGoal, id: result.data.id }
  : { ...currentData, id: result.data.id });
clearChanges(goalId);

// After competency goal creation (lines 279-283):
onGoalReplaceWithServerData(goalId, result.data, 'competency');
const latestCompGoal = goalDataRef.current.competencyGoals.find(g => g.id === goalId);
trackGoalLoad(result.data.id, 'competency', latestCompGoal
  ? { ...latestCompGoal, id: result.data.id }
  : { ...currentData, id: result.data.id });
clearChanges(goalId);
```

## Why the Fix is Safe
- The server does NOT transform user-editable fields (confirmed in backend)
- Server-only fields (createdAt, userId, etc.) are not stored in the frontend goal state
- Only the goal-input page is affected; goal-edit and goal-list are independent
- The ID sanitization logic is preserved
- Fallback ensures tracking works even if goalDataRef doesn't find the goal
