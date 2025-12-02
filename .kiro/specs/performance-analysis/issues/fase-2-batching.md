# Fase 2: Auto-Save Batching - Performance Optimization

**Priority:** 🟡 Medium
**Effort:** 10 hours (2-3 days)
**Impact:** -60-70% HTTP requests for auto-save
**Branch:** `perf/fase-2-auto-save-batching`

---

## 🎯 Overview

Fase 2 reduces auto-save overhead by **batching multiple goal saves into a single HTTP request**, improving both performance and user experience.

---

## 📊 Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Auto-save requests (10 goals) | 10 requests | 1 request | **-90%** |
| Auto-save latency | ~3-5s | ~500ms | **-80-90%** |
| Network overhead | High | Low | **-90%** |
| User feedback | Per-goal toast | Consolidated | **Better UX** |

**Overall:** -60-70% HTTP requests for auto-save operations

---

## 🎯 Problem

Current auto-save implementation saves **each goal individually**:
- 10 changed goals = 10 HTTP requests
- Each request has full overhead (auth, parsing, retry logic)
- Poor UX with multiple toast notifications
- Unnecessary backend pressure

**File:** `frontend/src/hooks/useGoalAutoSave.ts`

---

## ✅ Solution

Create a batch save endpoint that accepts multiple goals and saves them in a **single transaction**.

---

## 📝 Implementation

This issue contains 2 main tasks:
1. Backend: Create batch save endpoint
2. Frontend: Refactor auto-save to use batch

---

## Task 1: Backend - Batch Save Endpoint

**Effort:** 4 hours

### Step 1.1: Create Schemas

**File:** `backend/app/schemas/goal.py`

Add these new schemas:

```python
from typing import List, Dict, Any, Literal, Union
from pydantic import BaseModel
from uuid import UUID

class GoalBatchItem(BaseModel):
    """Single goal in a batch operation"""
    id: str
    type: Literal["performance", "competency"]
    data: Union[GoalCreate, GoalUpdate]
    is_new: bool

class GoalBatchSaveRequest(BaseModel):
    """Request to save multiple goals"""
    period_id: UUID
    goals: List[GoalBatchItem]

class GoalBatchSaveResponse(BaseModel):
    """Response from batch save operation"""
    saved: List[Dict[str, Any]]  # Successfully saved goals
    failed: List[Dict[str, str]]  # Failed goals with error messages
```

### Step 1.2: Create Service Method

**File:** `backend/app/services/goal_service.py`

Add this method:

```python
async def batch_save_goals(
    db: AsyncSession,
    period_id: UUID,
    goals: List[GoalBatchItem],
    current_user: AuthUser
) -> GoalBatchSaveResponse:
    """
    Save multiple goals in a single transaction.

    Returns:
        GoalBatchSaveResponse with saved and failed goals
    """
    results = {"saved": [], "failed": []}

    # Use transaction for atomicity
    async with db.begin():
        for goal_item in goals:
            try:
                if goal_item.is_new:
                    # Create new goal
                    goal = await create_goal(
                        db,
                        goal_item.data,
                        current_user
                    )
                    results["saved"].append({
                        "tempId": goal_item.id,
                        "serverId": str(goal.id),
                        "data": goal.to_dict()
                    })
                else:
                    # Update existing goal
                    goal = await update_goal(
                        db,
                        UUID(goal_item.id),
                        goal_item.data
                    )
                    results["saved"].append({
                        "id": str(goal.id),
                        "data": goal.to_dict()
                    })

            except Exception as e:
                logger.error(f"Failed to save goal {goal_item.id}: {str(e)}")
                results["failed"].append({
                    "id": goal_item.id,
                    "error": str(e)
                })
                # Continue with other goals
                continue

    return GoalBatchSaveResponse(**results)
```

### Step 1.3: Create API Endpoint

**File:** `backend/app/api/v1/goals.py`

Add this endpoint:

```python
@router.post("/org/{org_slug}/goals/batch-save")
async def batch_save_goals(
    org_slug: str,
    batch_data: GoalBatchSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Save multiple goals in a single transaction.

    Args:
        org_slug: Organization slug
        batch_data: Batch save request with period_id and goals

    Returns:
        GoalBatchSaveResponse with saved and failed goals
    """
    # Validate organization access
    org = await get_organization_by_slug(db, org_slug)
    if not org or org.id != current_user.organization_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied to this organization"
        )

    # Validate period belongs to organization
    period = await get_period_by_id(db, batch_data.period_id)
    if not period or period.organization_id != org.id:
        raise HTTPException(
            status_code=404,
            detail="Evaluation period not found"
        )

    # Execute batch save
    results = await goal_service.batch_save_goals(
        db,
        batch_data.period_id,
        batch_data.goals,
        current_user
    )

    return results
```

### Step 1.4: Test Backend

```bash
# Test with curl or Postman
POST /api/v1/org/{org_slug}/goals/batch-save
Content-Type: application/json
Authorization: Bearer {token}

{
  "period_id": "uuid-here",
  "goals": [
    {
      "id": "temp-1",
      "type": "performance",
      "is_new": true,
      "data": {
        "goal_category": "業績目標",
        "title": "Test Goal",
        ...
      }
    }
  ]
}
```

---

## Task 2: Frontend - Batch Save Implementation

**Effort:** 6 hours

### Step 2.1: Create API Types

**File:** `frontend/src/api/types/goal.ts`

Add these types:

```typescript
export interface BatchGoalSaveItem {
  id: string;
  type: 'performance' | 'competency';
  data: GoalCreateRequest | GoalUpdateRequest;
  isNew: boolean;
}

export interface BatchGoalSaveRequest {
  periodId: string;
  goals: BatchGoalSaveItem[];
}

export interface BatchGoalSaveResponse {
  saved: Array<{
    tempId?: string;
    serverId?: string;
    id?: string;
    data: GoalResponse;
  }>;
  failed: Array<{
    id: string;
    error: string;
  }>;
}
```

### Step 2.2: Create API Endpoint Function

**File:** `frontend/src/api/endpoints/goals.ts`

Add this function:

```typescript
export const batchSaveGoals = async (
  request: BatchGoalSaveRequest
): Promise<ApiResponse<BatchGoalSaveResponse>> => {
  const client = getHttpClient();
  return await client.post<BatchGoalSaveResponse>(
    '/api/v1/goals/batch-save',
    request
  );
};
```

### Step 2.3: Create Server Action

**File:** `frontend/src/api/server-actions/goals.ts`

Add this server action:

```typescript
export async function batchSaveGoalsAction(
  periodId: string,
  goals: BatchGoalSaveItem[]
): Promise<ApiResponse<BatchGoalSaveResponse>> {
  try {
    const response = await goalsApi.batchSaveGoals({ periodId, goals });

    if (response.success && response.data) {
      // Revalidate cache after batch save
      revalidateTag(CACHE_TAGS.GOALS);
    }

    return response;
  } catch (error) {
    console.error('Batch save goals action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while batch saving goals',
    };
  }
}
```

### Step 2.4: Refactor useGoalAutoSave Hook

**File:** `frontend/src/hooks/useGoalAutoSave.ts`

Replace the `handleAutoSave` function:

**Before (saves individually):**
```typescript
for (const changeInfo of actuallyChangedGoals) {
  if (goalType === 'performance') {
    await handlePerformanceGoalAutoSave(goalId, currentData, periodId);
  } else if (goalType === 'competency') {
    await handleCompetencyGoalAutoSave(goalId, currentData, periodId);
  }
}
```

**After (batch save):**
```typescript
const handleAutoSave = useCallback(async (changedGoals: GoalChangeInfo[]) => {
  if (!selectedPeriod?.id || isSavingRef.current || isLoadingExistingGoals) {
    return false;
  }

  // Filter complete and changed goals
  const completeGoals = changedGoals.filter(changeInfo =>
    isGoalReadyForSave(changeInfo.goalType, changeInfo.currentData)
  );

  const actuallyChangedGoals = completeGoals.filter(changeInfo =>
    isGoalDirty(changeInfo.goalId)
  );

  if (actuallyChangedGoals.length === 0) {
    return true;
  }

  // 🆕 Prepare batch
  const batch: BatchGoalSaveItem[] = actuallyChangedGoals.map(change => ({
    id: change.goalId,
    type: change.goalType,
    data: change.goalType === 'performance'
      ? transformPerformanceGoalToRequest(change.currentData)
      : transformCompetencyGoalToRequest(change.currentData),
    isNew: isTemporaryId(change.goalId),
  }));

  isSavingRef.current = true;

  try {
    // 🆕 Single batch call
    const result = await batchSaveGoalsAction(selectedPeriod.id, batch);

    if (result.success && result.data) {
      // Process saved goals
      result.data.saved.forEach(savedGoal => {
        if (savedGoal.tempId) {
          // New goal - replace temp ID
          const goalType = batch.find(b => b.id === savedGoal.tempId)?.type;
          if (goalType) {
            onGoalReplaceWithServerData(savedGoal.tempId, savedGoal.data, goalType);
            trackGoalLoad(savedGoal.serverId!, goalType, savedGoal.data);
            clearChanges(savedGoal.tempId);
          }
        } else {
          // Updated goal
          const goalType = batch.find(b => b.id === savedGoal.id)?.type;
          if (goalType) {
            trackGoalLoad(savedGoal.id!, goalType, savedGoal.data);
          }
        }
      });

      // 🆕 Consolidated toast
      toast.success('目標を保存しました', {
        description: `${result.data.saved.length}件の目標を自動保存しました`,
        duration: 2000,
      });

      // Show errors if any
      if (result.data.failed.length > 0) {
        toast.error('一部の目標の保存に失敗しました', {
          description: `${result.data.failed.length}件の目標でエラーが発生しました`,
          duration: 4000,
        });
      }

      return result.data.failed.length === 0;
    }

    return false;
  } catch (error) {
    console.error('❌ Batch auto-save failed:', error);
    toast.error('目標の保存に失敗しました');
    return false;
  } finally {
    isSavingRef.current = false;
  }
}, [selectedPeriod, isLoadingExistingGoals, isGoalDirty, /* ... */]);
```

### Step 2.5: Add Helper Functions

Add these helper functions to the hook:

```typescript
// Helper to check if ID is temporary
const isTemporaryId = (id: string): boolean => {
  return /^\d+$/.test(id); // Temp IDs are timestamps (numeric)
};

// Helper to transform performance goal data
const transformPerformanceGoalToRequest = (data: any): GoalCreateRequest | GoalUpdateRequest => {
  return {
    title: data.title,
    performanceGoalType: data.type,
    specificGoalText: data.specificGoal,
    achievementCriteriaText: data.achievementCriteria,
    meansMethodsText: data.method,
    weight: data.weight,
  };
};

// Helper to transform competency goal data
const transformCompetencyGoalToRequest = (data: any): GoalCreateRequest | GoalUpdateRequest => {
  return {
    actionPlan: data.actionPlan,
    competencyIds: data.competencyIds?.length > 0 ? data.competencyIds : null,
    selectedIdealActions: Object.keys(data.selectedIdealActions || {}).length > 0
      ? data.selectedIdealActions
      : null,
  };
};
```

---

## 🧪 Testing Checklist

### Backend Testing
- [ ] Endpoint accepts batch of 10 goals
- [ ] All 10 goals saved successfully
- [ ] Transaction rollback works on error
- [ ] Temp IDs mapped to server IDs correctly
- [ ] Permissions enforced (org access, period access)
- [ ] Error handling works (partial failures)

### Frontend Testing
- [ ] Build completes without errors
- [ ] Change 10 goals → only 1 HTTP request sent
- [ ] All 10 goals saved successfully
- [ ] Temp IDs replaced with server IDs
- [ ] UI updates correctly
- [ ] Toast shows correct count (e.g., "10件の目標を自動保存")
- [ ] Partial failures handled (e.g., "8件成功, 2件失敗")

### Integration Testing
- [ ] Create 5 new goals + Edit 5 existing goals
- [ ] Single batch request handles both creates and updates
- [ ] Goal list refreshes with new data
- [ ] No duplicate goals created

### Performance Testing
- [ ] Measure auto-save time for 10 goals
- [ ] Before: ~3-5 seconds (10 requests)
- [ ] After: ~500ms (1 request)
- [ ] Network tab shows single request

---

## 📊 Success Metrics

### Before
- **10 changed goals:** 10 HTTP requests
- **Auto-save latency:** 3-5 seconds
- **Toast notifications:** 10 individual toasts (spammy)

### After
- **10 changed goals:** 1 HTTP request (-90% ✅)
- **Auto-save latency:** ~500ms (-80-90% ✅)
- **Toast notifications:** 1 consolidated toast (better UX ✅)

### Validation
Monitor in DevTools Network tab:
1. Change 10 goals
2. Wait for auto-save (2 seconds)
3. Check Network tab → should see **1 POST** to `/batch-save`
4. Response should show all 10 goals saved

---

## ⚠️ Risk Assessment

### Risk Level: 🟡 MEDIUM

**Why medium risk:**
- Changes core auto-save functionality
- Batch operations are more complex than individual saves
- Requires backend changes (new endpoint)
- Need careful error handling for partial failures

**Mitigation strategies:**

1. **Transaction rollback**
   - Use database transaction for atomicity
   - All-or-nothing approach for critical operations

2. **Partial failure handling**
   - Continue saving other goals even if one fails
   - Clear feedback to user about what succeeded/failed

3. **Fallback mechanism**
   - Keep old individual save functions as fallback
   - Can revert to individual saves if batch fails

4. **Thorough testing**
   - Test with various goal counts (1, 5, 10, 20)
   - Test mixed creates/updates
   - Test with validation errors

---

## 📦 Files Summary

### Backend (3 files)
- `backend/app/schemas/goal.py` (add schemas)
- `backend/app/services/goal_service.py` (add method)
- `backend/app/api/v1/goals.py` (add endpoint)

### Frontend (4 files)
- `frontend/src/api/types/goal.ts` (add types)
- `frontend/src/api/endpoints/goals.ts` (add function)
- `frontend/src/api/server-actions/goals.ts` (add action)
- `frontend/src/hooks/useGoalAutoSave.ts` (refactor)

---

## 💬 Commit Message

```
perf(fase-2): implement auto-save batching

Implement batch save functionality to reduce HTTP requests
for auto-save operations from N requests to 1 request.

Performance Impact:
- Auto-save requests: 10 req → 1 req (-90%)
- Auto-save latency: 3-5s → 500ms (-80-90%)
- Better UX with consolidated toast notifications

Backend Changes:
- Added GoalBatchSaveRequest/Response schemas
- Added batch_save_goals() service method
- Added POST /goals/batch-save endpoint
- Implemented transaction support for atomicity

Frontend Changes:
- Added batch save types and API functions
- Created batchSaveGoalsAction() server action
- Refactored useGoalAutoSave to use batch
- Improved toast notifications (consolidated)

Testing:
- Tested batch of 10 goals (creates + updates)
- Verified transaction rollback on errors
- Tested partial failures (some succeed, some fail)
- Performance measured: 10 req → 1 req confirmed

Closes: Fase 2 - Auto-Save Batching

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ Definition of Done

- [ ] Backend batch endpoint implemented
- [ ] Frontend batch save implemented
- [ ] All tests pass
- [ ] Performance metrics meet targets:
  - [ ] 10 goals = 1 HTTP request
  - [ ] Auto-save latency < 1 second
- [ ] Error handling works (partial failures)
- [ ] Transaction support verified
- [ ] No functionality regressions
- [ ] Build completes without errors
- [ ] Manual testing completed
- [ ] Performance improvements documented
- [ ] Code reviewed and approved
- [ ] Merged to develop branch

---

## 📈 Next Steps

After completing Fase 2:
1. Measure and document actual improvements
2. Compare with expected metrics
3. Proceed to **Fase 3: Page Loaders** (Issue #3)

---

**Status:** 🔴 Not Started
**Assignee:** TBD
**Depends on:** Fase 1 completion
**Related:** [frontend-performance-gap-analysis.md](../frontend-performance-gap-analysis.md#4--alto-impacto-auto-save-individual-sem-batching)
