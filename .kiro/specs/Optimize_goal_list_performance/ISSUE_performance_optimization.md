# [PERFORMANCE] Optimize Goal List Performance - Eliminate N+1 Queries

## Overview

Optimize the goal-list page performance by eliminating N+1 query problems. Currently, the page takes 3-5 seconds to load due to making 20-50 HTTP requests to fetch supervisor reviews and rejection history. This optimization will:
- Embed supervisor reviews directly in the goals API response
- Reduce HTTP requests from 20-50 down to 1-2
- Reduce page load time from 3-5 seconds to < 1 second (10x improvement)
- Improve scalability and user experience

**Related Specs:**
- Requirements: `.kiro/specs/Optimize_goal_list_performance/requirements.md`
- Design: `.kiro/specs/Optimize_goal_list_performance/design.md`
- Tasks: `.kiro/specs/Optimize_goal_list_performance/tasks.md`

**Branch:** `feature/optimize-goal-list-performance`

---

## Problem Statement

### Current Performance Issues

**Symptoms:**
- Goal list page takes 3-5 seconds to load
- Browser makes 20-50 HTTP requests per page load
- Poor user experience (visible loading delay)
- Performance degrades with more goals
- Network tab shows waterfall of sequential requests

**Root Cause:**
```
N+1 Query Problem:
- 1 request to fetch goals
- N requests to fetch reviews (1 per goal)
- M requests to fetch previous goal reviews
- M × depth requests to recursively fetch rejection history

Example with 10 goals with 2-level rejection history:
Total = 1 + 10 + 10 + 20 = 41 requests
Load time = 41 × 80ms = 3.3 seconds
```

**Impact:**
- ❌ Poor user experience (3-5 second wait)
- ❌ High server load (40+ requests per page view)
- ❌ High database load (40+ SQL queries)
- ❌ Not scalable (gets worse with more goals)
- ❌ Network inefficiency (duplicate HTTP overhead)

---

## Solution Overview

### Backend Optimization: Embed Reviews in Goals API

**Approach:**
1. Add optional query parameters: `includeReviews` and `includeRejectionHistory`
2. When enabled, backend fetches reviews in batch using SQL `IN` clause
3. Use recursive CTE to fetch entire rejection history chain
4. Embed reviews directly in goal objects (no separate requests needed)

**Benefits:**
- ✅ 1-2 HTTP requests (vs 20-50)
- ✅ 1-2 SQL queries (vs 20-50)
- ✅ < 1 second load time (vs 3-5 seconds)
- ✅ 10x performance improvement
- ✅ Backward compatible (optional parameters)

---

## Acceptance Criteria

### ✅ Performance Requirement 1: Page Load Time < 1 Second

**GIVEN** I am viewing the goal list page
**WHEN** the page loads for the first time
**THEN** the page should load in < 1 second (measured in browser DevTools)
**AND** I should see all goals with their supervisor reviews
**AND** rejected goals should show rejection comments immediately (no loading spinner)

**Measurement:**
- Open Chrome DevTools → Network tab
- Clear cache and hard reload (Cmd+Shift+R)
- Measure "Load" time
- Target: < 1000ms (vs 3000-5000ms currently)

---

### ✅ Performance Requirement 2: HTTP Requests ≤ 3

**GIVEN** I am viewing the goal list page
**WHEN** the page loads
**THEN** the browser should make ≤ 3 HTTP requests total:
1. GET /evaluation-periods (cached)
2. GET /users (cached)
3. GET /goals?includeReviews=true&includeRejectionHistory=true

**AND** no additional requests should be made for reviews
**AND** no requests should be made for rejection history

**Measurement:**
- Open Chrome DevTools → Network tab
- Count requests after page load
- Target: ≤ 3 requests (vs 20-50 currently)

---

### ✅ Performance Requirement 3: SQL Queries ≤ 2

**GIVEN** backend receives request: `GET /goals?includeReviews=true`
**WHEN** the request is processed
**THEN** the backend should execute ≤ 2 SQL queries:
1. SELECT goals WHERE period_id = ? AND user_id IN (...)
2. SELECT reviews WHERE goal_id IN (goal1, goal2, ..., goalN)

**AND** no additional queries should be made per goal (no N+1)

**Measurement:**
- Check backend logs for SQL query count
- Use EXPLAIN ANALYZE to verify query performance
- Target: ≤ 2 queries (vs 20-50 currently)

---

### ✅ Functional Requirement 1: All Features Work Unchanged

**GIVEN** the optimization is deployed
**WHEN** I use the goal list page
**THEN** all existing functionality should work:
- ✅ Goals are displayed correctly
- ✅ Status filtering works (draft, submitted, approved, rejected)
- ✅ Supervisor comments are visible
- ✅ Rejection history shows all comments in chronological order
- ✅ Employee selector works (for supervisors)
- ✅ Resubmission filter works
- ✅ Edit/Resubmit buttons function correctly

**AND** no visual or functional regressions

---

### ✅ Functional Requirement 2: Backward Compatibility Maintained

**GIVEN** the new API is deployed
**WHEN** existing frontend code calls `GET /goals` WITHOUT `includeReviews` parameter
**THEN** the API should return the original response format
**AND** `supervisorReview` and `rejectionHistory` fields should NOT be included
**AND** all existing code should work without changes

**GIVEN** we deploy frontend changes gradually
**WHEN** old and new code coexist
**THEN** both should work correctly without conflicts

---

### ✅ Performance Requirement 4: Scalability Improved

**GIVEN** I have 50 goals in the current evaluation period
**WHEN** the goal list page loads
**THEN** the page should still load in < 1 second
**AND** HTTP requests should still be ≤ 3
**AND** SQL queries should still be ≤ 2

**GIVEN** a goal has 5 levels of rejection history
**WHEN** the rejection history is loaded
**THEN** it should load in < 200ms using recursive CTE
**AND** no exponential increase in requests/queries

---

## Technical Implementation Summary

### Backend Changes

#### 1. Schema Updates
```python
# backend/app/schemas/goal.py

class Goal(BaseModel):
    # ... existing fields ...
    previous_goal_id: Optional[UUID] = Field(None, alias="previousGoalId")

    # NEW: Optional embedded review fields
    supervisor_review: Optional[SupervisorReview] = Field(None, alias="supervisorReview")
    rejection_history: Optional[List[SupervisorReview]] = Field(None, alias="rejectionHistory")
```

#### 2. API Endpoint Updates
```python
# backend/app/api/v1/goals.py

@router.get("/", response_model=GoalList)
async def get_goals(
    # ... existing params ...
    include_reviews: bool = Query(False, alias="includeReviews"),
    include_rejection_history: bool = Query(False, alias="includeRejectionHistory"),
    # ...
):
    result = await service.get_goals(
        # ... existing params ...
        include_reviews=include_reviews,
        include_rejection_history=include_rejection_history
    )
```

#### 3. Repository Methods
```python
# backend/app/database/repositories/supervisor_review_repository.py

async def get_by_goals_batch(
    self,
    goal_ids: List[UUID],
    org_id: str
) -> List[SupervisorReview]:
    """Batch fetch reviews for multiple goals (eliminates N+1)"""
    query = (
        select(SupervisorReview)
        .filter(SupervisorReview.goal_id.in_(goal_ids))
        .order_by(SupervisorReview.goal_id, SupervisorReview.reviewed_at.desc())
    )
    # Execute single query for all goals
    return await self.session.execute(query).scalars().all()

async def get_rejection_history_chain(
    self,
    starting_goal_id: UUID,
    org_id: str
) -> List[SupervisorReview]:
    """Fetch rejection history using recursive CTE"""
    # Use WITH RECURSIVE to follow previousGoalId chain
    # Returns entire history in single query
```

#### 4. Service Updates
```python
# backend/app/services/goal_service.py

async def get_goals(
    self,
    # ... existing params ...
    include_reviews: bool = False,
    include_rejection_history: bool = False
) -> PaginatedResponse[Goal]:
    # Fetch goals (existing)
    goals = await self.goal_repo.search_goals(...)

    # NEW: Batch fetch reviews if requested
    if include_reviews and goals:
        goal_ids = [goal.id for goal in goals]
        reviews = await self.supervisor_review_repo.get_by_goals_batch(goal_ids, org_id)

        # Map reviews to goals
        reviews_map = {...}

        # Embed in response
        for goal in goals:
            goal_dict["supervisor_review"] = reviews_map.get(goal.id)
            if include_rejection_history:
                goal_dict["rejection_history"] = await self._fetch_history(...)
```

### Frontend Changes

#### 1. Type Updates
```typescript
// frontend/src/api/types/goal.ts

export interface GoalResponse {
  // ... existing fields ...
  previousGoalId?: UUID;

  // NEW: Optional embedded fields
  supervisorReview?: SupervisorReview;
  rejectionHistory?: SupervisorReview[];
}
```

#### 2. API Client Updates
```typescript
// frontend/src/api/endpoints/goals.ts

export const goalsApi = {
  getGoals: async (params?: {
    // ... existing params ...
    includeReviews?: boolean;  // NEW
    includeRejectionHistory?: boolean;  // NEW
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.includeReviews) {
      queryParams.append('includeReviews', 'true');
    }
    // ... make request
  }
};
```

#### 3. Hook Simplification
```typescript
// frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts

const loadGoalData = async () => {
  // BEFORE: 20-50 requests
  // const goalsResult = await getGoalsAction({ periodId });
  // for (const goal of goals) {
  //   const reviewResult = await getSupervisorReviewsAction({ goalId: goal.id });
  //   const historyResult = await fetchRejectionHistory(goal.previousGoalId);
  // }

  // AFTER: 1 request
  const goalsResult = await getGoalsAction({
    periodId,
    includeReviews: true,
    includeRejectionHistory: true
  });

  // Reviews are already embedded!
  const goalsWithReviews = goalsResult.data.items.map(goal => ({
    ...goal,
    supervisorReview: goal.supervisorReview,  // Already there!
    rejectionHistory: goal.rejectionHistory   // Already there!
  }));
};
```

---

## Testing Strategy

### Performance Testing

**Baseline Measurement (Before):**
1. Open goal-list with 10 goals
2. Measure in Chrome DevTools Network tab:
   - Load time: ~3.5 seconds
   - HTTP requests: 32 requests
   - Transferred: 450KB
3. Document baseline metrics

**After Optimization:**
1. Same test with optimized code
2. Expected results:
   - Load time: < 1 second ✅
   - HTTP requests: 3 requests ✅
   - Transferred: < 100KB ✅

**Performance Test Cases:**
- [ ] 10 goals: < 500ms load time
- [ ] 50 goals: < 1000ms load time
- [ ] Deep rejection chain (5 levels): < 200ms to fetch history
- [ ] Concurrent 100 users: maintain < 1s response time

### Functional Testing

**Regression Test Cases:**
- [ ] All goals display correctly
- [ ] Status badges show correct states
- [ ] Supervisor comments visible
- [ ] Rejection history in correct order
- [ ] Filtering by status works
- [ ] Resubmission filter works
- [ ] Employee selector works (supervisors)
- [ ] Edit/Resubmit buttons work
- [ ] No console errors

**Backward Compatibility Tests:**
- [ ] API without `includeReviews` returns original format
- [ ] Existing frontend code works unchanged
- [ ] Old and new code can coexist

### Unit Tests

**Backend:**
- [ ] `get_by_goals_batch()` returns reviews for all goals
- [ ] `get_rejection_history_chain()` follows previousGoalId chain
- [ ] Organization scope filtering works
- [ ] Max depth limit prevents infinite recursion
- [ ] Service embeds reviews correctly

**Frontend:**
- [ ] API client passes parameters correctly
- [ ] Hook uses embedded reviews
- [ ] Type definitions are correct

---

## Rollout Plan

### Phase 1: Backend Deployment (Day 1)
**Tasks:**
1. Deploy backend changes (backward compatible)
2. Run integration tests in staging
3. Verify old frontend still works
4. Monitor performance metrics

**Verification:**
- [ ] API with `includeReviews=false` works (backward compatible)
- [ ] API with `includeReviews=true` returns embedded data
- [ ] No errors in logs
- [ ] Response times < 500ms

### Phase 2: Frontend Deployment (Day 2)
**Tasks:**
1. Deploy frontend changes
2. Enable `includeReviews=true` in goal-list
3. Remove old review fetching code
4. Monitor page load times

**Verification:**
- [ ] Goal list loads in < 1 second
- [ ] HTTP requests ≤ 3
- [ ] All functionality works
- [ ] No console errors

### Phase 3: Monitoring and Verification (Day 3)
**Tasks:**
1. Monitor production metrics
2. Collect user feedback
3. Verify success criteria
4. Document results

**Success Metrics:**
- [ ] Average load time < 1 second
- [ ] P95 load time < 1.5 seconds
- [ ] HTTP requests ≤ 3
- [ ] SQL queries ≤ 2
- [ ] No increase in error rate
- [ ] User satisfaction improved

---

## Rollback Plan

**If issues are found:**

1. **Backend Issues:**
   - Frontend still works (backward compatible)
   - Rollback backend deployment
   - No data loss

2. **Frontend Issues:**
   - Rollback frontend deployment
   - Old code works with new backend
   - No data loss

3. **Performance Regression:**
   - Disable `includeReviews` parameter
   - Fall back to old fetching logic
   - Investigate and fix

---

## Success Criteria Checklist

**Before marking this issue as complete, verify:**

- [ ] ✅ Goal list page loads in < 1 second (10x improvement)
- [ ] ✅ Frontend makes ≤ 3 HTTP requests (95% reduction)
- [ ] ✅ Backend uses ≤ 2 SQL queries (95% reduction)
- [ ] ✅ All existing functionality works unchanged
- [ ] ✅ No breaking changes for existing code
- [ ] ✅ Rejection history displays correctly
- [ ] ✅ All tests pass (unit, integration, performance)
- [ ] ✅ Documentation updated
- [ ] ✅ Performance monitoring active
- [ ] ✅ Deployed to production successfully
- [ ] ✅ User feedback positive

---

## Related Documentation

- **Requirements:** `.kiro/specs/Optimize_goal_list_performance/requirements.md`
- **Design:** `.kiro/specs/Optimize_goal_list_performance/design.md`
- **Tasks:** `.kiro/specs/Optimize_goal_list_performance/tasks.md`
- **Instruction:** `.kiro/specs/Optimize_goal_list_performance/instruction.md`

---

## Performance Metrics

### Before Optimization

| Metric | Value |
|--------|-------|
| Page Load Time | 3-5 seconds |
| HTTP Requests | 20-50 requests |
| SQL Queries | 20-50 queries |
| Transferred Data | 500KB+ |
| Time to Interactive | 4-6 seconds |

### After Optimization (Target)

| Metric | Target | Improvement |
|--------|--------|-------------|
| Page Load Time | < 1 second | **10x faster** |
| HTTP Requests | ≤ 3 requests | **95% reduction** |
| SQL Queries | ≤ 2 queries | **95% reduction** |
| Transferred Data | < 100KB | **80% reduction** |
| Time to Interactive | < 1.5 seconds | **5x faster** |

---

**Estimated Effort:** 2-3 days (13-15 hours)
**Priority:** HIGH
**Impact:** HIGH (significantly improves user experience)
**Risk:** LOW (backward compatible, incremental deployment)
