# Implementation Tasks: Optimize Goal List Performance

## Overview

This document breaks down the implementation of the goal-list performance optimization into concrete, actionable tasks. The optimization eliminates N+1 query problems by embedding supervisor reviews in the goals API response.

**Goal:** Reduce page load time from 3-5 seconds to < 1 second (10x improvement)

**Approach:** Backend embeds reviews in goals API → Frontend uses embedded data → Eliminate 20-50 HTTP requests

---

## Task Breakdown

### Phase 1: Backend Implementation (Priority: HIGH)

#### Task 1.1: Update Goal Schema with Optional Review Fields
**Estimated Time:** 30 minutes
**Assignee:** Backend Developer
**Dependencies:** None
**Priority:** HIGH

**Description:**
Extend the `Goal` Pydantic schema to include optional fields for embedded supervisor reviews.

**Acceptance Criteria:**
- [ ] Add `supervisor_review: Optional[SupervisorReview]` field to `Goal` schema
- [ ] Add `rejection_history: Optional[List[SupervisorReview]]` field to `Goal` schema
- [ ] Use `Field(None, alias="...")` for camelCase API compatibility
- [ ] Add docstrings explaining when these fields are populated
- [ ] Ensure backward compatibility (fields are optional, default to None)
- [ ] Schema validation tests pass

**Implementation Details:**
```python
# File: backend/app/schemas/goal.py

from typing import Optional, List
from .supervisor_review import SupervisorReview

class Goal(BaseModel):
    # ... existing fields ...
    previous_goal_id: Optional[UUID] = Field(None, alias="previousGoalId")

    # NEW: Optional embedded review fields
    supervisor_review: Optional[SupervisorReview] = Field(
        None,
        alias="supervisorReview",
        description="Most recent supervisor review (populated when includeReviews=true)"
    )
    rejection_history: Optional[List[SupervisorReview]] = Field(
        None,
        alias="rejectionHistory",
        description="Full rejection history chain (populated when includeRejectionHistory=true)"
    )
```

**Testing:**
- Unit test: Schema serialization/deserialization with optional fields
- Unit test: Schema with None values (backward compatibility)
- Unit test: Schema with populated review fields

**Related Requirements:** Requirement 1

---

#### Task 1.2: Add Query Parameters to Goals API Endpoint
**Estimated Time:** 15 minutes
**Assignee:** Backend Developer
**Dependencies:** Task 1.1
**Priority:** HIGH

**Description:**
Add optional query parameters `includeReviews` and `includeRejectionHistory` to the `GET /goals` endpoint.

**Acceptance Criteria:**
- [ ] Add `include_reviews: bool = Query(False, alias="includeReviews")` parameter
- [ ] Add `include_rejection_history: bool = Query(False, alias="includeRejectionHistory")` parameter
- [ ] Add validation: `includeRejectionHistory` requires `includeReviews=true`
- [ ] Update API docstring with parameter descriptions and examples
- [ ] Pass parameters to `GoalService.get_goals()`
- [ ] Maintain backward compatibility (default values = False)

**Implementation Details:**
```python
# File: backend/app/api/v1/goals.py

@router.get("/", response_model=GoalList)
async def get_goals(
    # ... existing parameters ...
    include_reviews: bool = Query(
        False,
        alias="includeReviews",
        description="Include supervisor reviews in response"
    ),
    include_rejection_history: bool = Query(
        False,
        alias="includeRejectionHistory",
        description="Include full rejection history chain"
    ),
    # ... existing dependencies ...
):
    # Validate parameters
    if include_rejection_history and not include_reviews:
        raise HTTPException(400, "includeRejectionHistory requires includeReviews=true")

    result = await service.get_goals(
        # ... existing params ...
        include_reviews=include_reviews,
        include_rejection_history=include_rejection_history
    )
```

**Testing:**
- Integration test: API with `includeReviews=true` returns embedded reviews
- Integration test: API without parameters maintains backward compatibility
- Integration test: Invalid parameter combination returns 400 error
- Integration test: API response schema validation

**Related Requirements:** Requirement 1

---

#### Task 1.3: Implement Batch Review Repository Method
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** None
**Priority:** HIGH (CRITICAL PATH)

**Description:**
Create `get_by_goals_batch()` method in `SupervisorReviewRepository` to fetch reviews for multiple goals in a single SQL query.

**Acceptance Criteria:**
- [ ] Method signature: `async def get_by_goals_batch(goal_ids: List[UUID], org_id: str, limit_per_goal: int = 10)`
- [ ] Use SQL `IN` clause to fetch all reviews in one query
- [ ] Apply organization scope filtering (security)
- [ ] Sort results by (goal_id, reviewed_at DESC) for easy mapping
- [ ] Handle empty `goal_ids` list gracefully
- [ ] Add logging for performance monitoring
- [ ] Method executes in < 100ms for 50 goals

**Implementation Details:**
```python
# File: backend/app/database/repositories/supervisor_review_repository.py

async def get_by_goals_batch(
    self,
    goal_ids: List[UUID],
    org_id: str,
    limit_per_goal: int = 10
) -> List[SupervisorReview]:
    """
    Batch fetch reviews for multiple goals (eliminates N+1 queries).

    Performance: O(1) query vs O(N) individual queries
    """
    if not goal_ids:
        return []

    query = (
        select(SupervisorReview)
        .filter(SupervisorReview.goal_id.in_(goal_ids))
        .order_by(
            SupervisorReview.goal_id.asc(),
            SupervisorReview.reviewed_at.desc().nulls_last(),
            SupervisorReview.updated_at.desc()
        )
    )

    # Apply org scope via goal -> user relationship
    query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

    result = await self.session.execute(query)
    reviews = result.scalars().all()

    logger.info(f"Batch fetched {len(reviews)} reviews for {len(goal_ids)} goals")

    return reviews
```

**Testing:**
- Unit test: Returns reviews for all provided goal IDs
- Unit test: Returns empty list for empty input
- Unit test: Applies organization scope correctly
- Unit test: Sorts reviews correctly (most recent first per goal)
- Performance test: Executes in < 100ms for 50 goals
- Performance test: Faster than N individual queries

**Related Requirements:** Requirement 1

---

#### Task 1.4: Implement Recursive Rejection History Repository Method
**Estimated Time:** 1.5 hours
**Assignee:** Backend Developer
**Dependencies:** None
**Priority:** MEDIUM

**Description:**
Create `get_rejection_history_chain()` method using recursive CTE to fetch entire `previousGoalId` chain.

**Acceptance Criteria:**
- [ ] Method signature: `async def get_rejection_history_chain(starting_goal_id: UUID, org_id: str, max_depth: int = 10)`
- [ ] Use PostgreSQL recursive CTE (WITH RECURSIVE)
- [ ] Follow `previousGoalId` chain backwards
- [ ] Limit recursion depth to prevent infinite loops (max_depth)
- [ ] Filter for `action = 'rejected'` reviews only
- [ ] Apply organization scope
- [ ] Return results in chronological order (oldest → newest)
- [ ] Method executes in < 200ms for depth=10

**Implementation Details:**
```python
# File: backend/app/database/repositories/supervisor_review_repository.py

async def get_rejection_history_chain(
    self,
    starting_goal_id: UUID,
    org_id: str,
    max_depth: int = 10
) -> List[SupervisorReview]:
    """
    Fetch complete rejection history using recursive CTE.

    Performance: O(1) query vs O(depth × 2) individual queries
    """
    cte_query = text("""
        WITH RECURSIVE goal_chain AS (
          -- Base case: starting goal
          SELECT id, previous_goal_id, user_id, 0 as depth
          FROM goals
          WHERE id = :starting_goal_id

          UNION ALL

          -- Recursive case: follow previousGoalId
          SELECT g.id, g.previous_goal_id, g.user_id, gc.depth + 1
          FROM goals g
          INNER JOIN goal_chain gc ON g.id = gc.previous_goal_id
          WHERE gc.depth < :max_depth
        )
        SELECT sr.*
        FROM supervisor_reviews sr
        INNER JOIN goal_chain gc ON sr.goal_id = gc.id
        INNER JOIN users u ON gc.user_id = u.id
        WHERE sr.action = 'rejected'
          AND u.org_id = :org_id
        ORDER BY gc.depth DESC  -- Chronological order
    """)

    result = await self.session.execute(
        cte_query,
        {"starting_goal_id": str(starting_goal_id), "max_depth": max_depth, "org_id": org_id}
    )

    reviews = [SupervisorReview(**dict(row._mapping)) for row in result]

    logger.info(f"Fetched {len(reviews)} rejection history for chain starting at {starting_goal_id}")

    return reviews
```

**Testing:**
- Unit test: Follows previousGoalId chain correctly
- Unit test: Returns results in chronological order
- Unit test: Respects max_depth limit
- Unit test: Filters only rejected reviews
- Unit test: Applies organization scope
- Unit test: Handles circular references gracefully
- Performance test: Executes in < 200ms for depth=10

**Related Requirements:** Requirement 3

---

#### Task 1.5: Update GoalService to Embed Reviews
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Task 1.1, 1.3, 1.4
**Priority:** HIGH

**Description:**
Modify `GoalService.get_goals()` and `_enrich_goal_data()` to optionally fetch and embed reviews.

**Acceptance Criteria:**
- [ ] Add `include_reviews` and `include_rejection_history` parameters to `get_goals()`
- [ ] When `include_reviews=True`, call `get_by_goals_batch()` for all goals
- [ ] Create `reviews_map: Dict[str, List[SupervisorReview]]` for O(1) lookup
- [ ] Pass `reviews_map` to `_enrich_goal_data()`
- [ ] In `_enrich_goal_data()`, populate `supervisor_review` from map (most recent)
- [ ] When `include_rejection_history=True`, call `get_rejection_history_chain()`
- [ ] Handle errors gracefully (fallback to empty reviews)
- [ ] Maintain backward compatibility (no breaking changes)

**Implementation Details:**
```python
# File: backend/app/services/goal_service.py

async def get_goals(
    self,
    # ... existing params ...
    include_reviews: bool = False,  # NEW
    include_rejection_history: bool = False  # NEW
) -> PaginatedResponse[Goal]:
    # Fetch goals (existing logic)
    goals = await self.goal_repo.search_goals(...)

    # NEW: Batch fetch reviews
    reviews_map = {}
    if include_reviews and goals:
        goal_ids = [goal.id for goal in goals]
        reviews = await self.supervisor_review_repo.get_by_goals_batch(goal_ids, org_id)

        # Create map: goal_id → reviews
        for review in reviews:
            goal_id_str = str(review.goal_id)
            if goal_id_str not in reviews_map:
                reviews_map[goal_id_str] = []
            reviews_map[goal_id_str].append(review)

    # Enrich goals
    enriched_goals = []
    for goal_model in goals:
        enriched_goal = await self._enrich_goal_data(
            goal_model,
            reviews_map=reviews_map if include_reviews else None,
            include_rejection_history=include_rejection_history,
            org_id=org_id
        )
        enriched_goals.append(enriched_goal)

    return PaginatedResponse(items=enriched_goals, ...)

async def _enrich_goal_data(
    self,
    goal_model: GoalModel,
    reviews_map: Optional[Dict[str, List[SupervisorReview]]] = None,
    include_rejection_history: bool = False,
    org_id: Optional[str] = None
) -> Goal:
    # Existing enrichment...
    goal_dict = {...}

    # NEW: Add supervisor review
    if reviews_map:
        goal_id_str = str(goal_model.id)
        goal_reviews = reviews_map.get(goal_id_str, [])
        if goal_reviews:
            goal_dict["supervisor_review"] = goal_reviews[0]  # Most recent

    # NEW: Add rejection history
    if include_rejection_history and goal_model.previous_goal_id:
        history = await self.supervisor_review_repo.get_rejection_history_chain(
            goal_model.previous_goal_id, org_id
        )
        goal_dict["rejection_history"] = history

    return Goal(**goal_dict)
```

**Testing:**
- Unit test: `get_goals()` with `include_reviews=False` unchanged
- Unit test: `get_goals()` with `include_reviews=True` embeds reviews
- Unit test: Reviews map created correctly from batch results
- Unit test: Most recent review selected per goal
- Unit test: Rejection history populated when requested
- Integration test: End-to-end API call returns embedded data

**Related Requirements:** Requirement 1, 3

---

### Phase 2: Frontend Implementation (Priority: HIGH)

#### Task 2.1: Update TypeScript Types with Optional Review Fields
**Estimated Time:** 15 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 1.1
**Priority:** HIGH

**Description:**
Update `GoalResponse` TypeScript interface to include optional review fields matching backend schema.

**Acceptance Criteria:**
- [ ] Add `supervisorReview?: SupervisorReview` to `GoalResponse` interface
- [ ] Add `rejectionHistory?: SupervisorReview[]` to `GoalResponse` interface
- [ ] Ensure camelCase naming matches backend aliases
- [ ] Update JSDoc comments explaining when fields are populated
- [ ] No breaking changes to existing code (fields are optional)

**Implementation Details:**
```typescript
// File: frontend/src/api/types/goal.ts

export interface GoalResponse {
  // ... existing fields ...
  previousGoalId?: UUID;

  // NEW: Optional embedded review fields
  /**
   * Most recent supervisor review (only populated when includeReviews=true)
   */
  supervisorReview?: SupervisorReview;

  /**
   * Full rejection history chain (only populated when includeRejectionHistory=true)
   */
  rejectionHistory?: SupervisorReview[];
}
```

**Testing:**
- TypeScript compilation passes
- No type errors in existing code
- Type inference works correctly with optional fields

**Related Requirements:** Requirement 2

---

#### Task 2.2: Update API Client to Support New Query Parameters
**Estimated Time:** 20 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 2.1
**Priority:** HIGH

**Description:**
Add `includeReviews` and `includeRejectionHistory` parameters to `goalsApi.getGoals()` method.

**Acceptance Criteria:**
- [ ] Add optional parameters to function signature
- [ ] Append query parameters to URL when provided
- [ ] Maintain backward compatibility (parameters are optional)
- [ ] Update JSDoc with examples
- [ ] Handle both boolean and undefined values correctly

**Implementation Details:**
```typescript
// File: frontend/src/api/endpoints/goals.ts

export const goalsApi = {
  getGoals: async (params?: {
    periodId?: UUID;
    userId?: UUID;
    goalCategory?: string;
    status?: string | string[];
    page?: number;
    limit?: number;
    includeReviews?: boolean;  // NEW
    includeRejectionHistory?: boolean;  // NEW
  }): Promise<ApiResponse<GoalListResponse>> => {
    const queryParams = new URLSearchParams();

    // ... existing params ...

    // NEW: Add performance optimization params
    if (params?.includeReviews) {
      queryParams.append('includeReviews', 'true');
    }
    if (params?.includeRejectionHistory) {
      queryParams.append('includeRejectionHistory', 'true');
    }

    const url = `${API_ROUTES.GOALS.BASE}?${queryParams.toString()}`;
    const response = await apiClient.get<GoalListResponse>(url);

    return { success: true, data: response.data };
  }
};
```

**Testing:**
- Unit test: URL contains correct query parameters
- Unit test: Optional parameters work correctly
- Unit test: Backward compatibility maintained
- Integration test: API call succeeds with new parameters

**Related Requirements:** Requirement 2

---

#### Task 2.3: Update Server Action to Pass includeReviews Parameter
**Estimated Time:** 10 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 2.2
**Priority:** HIGH

**Description:**
Update `getGoalsAction()` server action to accept and pass `includeReviews` parameter to API client.

**Acceptance Criteria:**
- [ ] Add optional parameters to function signature
- [ ] Pass parameters through to `goalsApi.getGoals()`
- [ ] Update cache key if using React cache() (include params)
- [ ] Maintain backward compatibility

**Implementation Details:**
```typescript
// File: frontend/src/api/server-actions/goals.ts

export const getGoalsAction = cache(async (params?: {
  periodId?: UUID;
  // ... existing params ...
  includeReviews?: boolean;  // NEW
  includeRejectionHistory?: boolean;  // NEW
}): Promise<ApiResponse<GoalListResponse>> => {
  return _getGoalsAction(params);
});
```

**Testing:**
- Server action passes parameters correctly
- Cache works correctly with new parameters
- TypeScript types are correct

**Related Requirements:** Requirement 2

---

#### Task 2.4: Simplify useGoalListData Hook to Use Embedded Reviews
**Estimated Time:** 1 hour
**Assignee:** Frontend Developer
**Dependencies:** Task 2.3
**Priority:** HIGH (CRITICAL PATH)

**Description:**
Refactor `useGoalListData` hook to remove N+1 review fetching logic and use embedded reviews from API response.

**Acceptance Criteria:**
- [ ] Call `getGoalsAction()` with `includeReviews: true` and `includeRejectionHistory: true`
- [ ] Remove all review fetching logic (`reviewPromises`, `previousGoalReviewPromises`)
- [ ] Remove `fetchRejectionHistory()` recursive function
- [ ] Remove `reviewsMap` creation logic
- [ ] Use `goal.supervisorReview` and `goal.rejectionHistory` directly from API response
- [ ] Maintain all existing functionality (filtering, grouping, display)
- [ ] No breaking changes to component interface
- [ ] Page loads in < 1 second

**Implementation Details:**
```typescript
// File: frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts

const loadGoalData = useCallback(async () => {
  try {
    setIsLoading(true);
    setError(null);

    // Load period and users in parallel
    const [periodResult, usersResult] = await Promise.all([
      getCategorizedEvaluationPeriodsAction(),
      getUsersAction()
    ]);

    if (usersResult.success && usersResult.data?.items) {
      setUsers(usersResult.data.items);
    }

    if (periodResult.success && periodResult.data?.current) {
      setCurrentPeriod(periodResult.data.current);

      // OPTIMIZED: Single request with embedded reviews!
      const goalsResult = await getGoalsAction({
        periodId: periodResult.data.current.id,
        limit: 100,
        includeReviews: true,  // NEW
        includeRejectionHistory: true  // NEW
      });

      if (!goalsResult.success || !goalsResult.data?.items) {
        setError(goalsResult.error || '目標の読み込みに失敗しました');
        return;
      }

      const goals = goalsResult.data.items;
      const activeGoals = goals.filter(goal => goal.status !== 'rejected');

      // SIMPLIFIED: No need to fetch reviews separately!
      // Reviews are already embedded in the response!
      const goalsWithReviews: GoalWithReview[] = activeGoals.map(goal => ({
        ...goal,
        supervisorReview: goal.supervisorReview || null,
        rejectionHistory: goal.rejectionHistory || []
      }));

      setGoals(goalsWithReviews);
    }
  } catch (err) {
    console.error('Error loading goal data:', err);
    setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
  } finally {
    setIsLoading(false);
  }
}, []);
```

**Lines to Remove:**
- Lines 106-140: `fetchRejectionHistory()` function (REMOVE ENTIRELY)
- Lines 190-217: Review fetching logic (REMOVE)
- Lines 219-234: Reviews map creation (REMOVE)
- Lines 237-252: Rejection history fetching loop (REMOVE)

**Testing:**
- Goal list displays correctly with reviews
- Rejection history shows all comments in order
- Filtering and grouping still work
- No console errors
- Page loads in < 1 second
- HTTP requests ≤ 3 (vs 20-50 before)

**Related Requirements:** Requirement 2

---

### Phase 3: Testing and Verification (Priority: HIGH)

#### Task 3.1: Backend Unit Tests
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Phase 1 complete
**Priority:** HIGH

**Description:**
Write comprehensive unit tests for new repository methods and service logic.

**Acceptance Criteria:**
- [ ] Test `get_by_goals_batch()` with various inputs
- [ ] Test `get_rejection_history_chain()` with various depths
- [ ] Test organization scope filtering
- [ ] Test edge cases (empty inputs, circular references, max depth)
- [ ] All tests pass
- [ ] Code coverage ≥ 90% for new code

**Test Cases:**
```python
# test_supervisor_review_repository.py
- test_get_by_goals_batch_returns_reviews_for_all_goals()
- test_get_by_goals_batch_returns_empty_for_empty_input()
- test_get_by_goals_batch_respects_org_scope()
- test_get_by_goals_batch_sorts_by_goal_and_date()
- test_get_rejection_history_chain_follows_previous_goals()
- test_get_rejection_history_chain_respects_max_depth()
- test_get_rejection_history_chain_returns_chronological_order()
- test_get_rejection_history_chain_handles_circular_references()

# test_goal_service.py
- test_get_goals_without_include_reviews_unchanged()
- test_get_goals_with_include_reviews_embeds_data()
- test_get_goals_creates_reviews_map_correctly()
- test_enrich_goal_data_with_reviews_map()
- test_enrich_goal_data_with_rejection_history()
```

**Related Requirements:** All

---

#### Task 3.2: Backend Integration Tests
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Phase 1 complete
**Priority:** HIGH

**Description:**
Write integration tests for API endpoints with embedded reviews.

**Acceptance Criteria:**
- [ ] Test API with `includeReviews=true` returns embedded data
- [ ] Test API without parameter maintains backward compatibility
- [ ] Test API with `includeRejectionHistory=true` returns full history
- [ ] Test invalid parameter combinations return 400
- [ ] All tests pass

**Test Cases:**
```python
# test_goals_api.py
- test_get_goals_with_include_reviews_embeds_data()
- test_get_goals_without_include_reviews_backward_compatible()
- test_get_goals_with_rejection_history_embeds_full_chain()
- test_get_goals_invalid_params_returns_400()
- test_get_goals_respects_permissions()
```

**Related Requirements:** Requirement 1, 4

---

#### Task 3.3: Backend Performance Tests
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Phase 1 complete
**Priority:** MEDIUM

**Description:**
Write performance tests to verify optimization improvements.

**Acceptance Criteria:**
- [ ] Batch query faster than N+1 queries (≥ 5x)
- [ ] API with `includeReviews=true` responds in < 500ms for 10 goals
- [ ] API with `includeReviews=true` responds in < 1000ms for 50 goals
- [ ] Recursive CTE completes in < 200ms for depth=10
- [ ] All performance targets met

**Test Cases:**
```python
# test_performance.py
- test_batch_query_faster_than_n_plus_one()
- test_api_response_time_10_goals()
- test_api_response_time_50_goals()
- test_recursive_cte_performance()
- test_concurrent_requests_performance()
```

**Related Requirements:** Non-Functional Requirements

---

#### Task 3.4: Frontend Unit Tests
**Estimated Time:** 30 minutes
**Assignee:** Frontend Developer
**Dependencies:** Phase 2 complete
**Priority:** MEDIUM

**Description:**
Write unit tests for updated API client and hook.

**Acceptance Criteria:**
- [ ] Test API client passes parameters correctly
- [ ] Test server action passes parameters through
- [ ] Test hook uses embedded reviews correctly
- [ ] All tests pass

**Test Cases:**
```typescript
// goalsApi.test.ts
- test_getGoals_with_includeReviews_appends_query_param()
- test_getGoals_without_params_backward_compatible()

// useGoalListData.test.ts
- test_hook_calls_api_with_includeReviews()
- test_hook_uses_embedded_reviews()
- test_hook_handles_missing_reviews_gracefully()
```

**Related Requirements:** Requirement 2

---

#### Task 3.5: End-to-End Performance Verification
**Estimated Time:** 30 minutes
**Assignee:** QA / Developer
**Dependencies:** Phase 1 and 2 complete
**Priority:** HIGH

**Description:**
Manually verify performance improvements in browser.

**Acceptance Criteria:**
- [ ] Goal list page loads in < 1 second (measured in DevTools)
- [ ] HTTP requests ≤ 3 (measured in Network tab)
- [ ] All goals display correctly with reviews
- [ ] Rejection history shows all comments
- [ ] No console errors
- [ ] No visual regressions

**Verification Steps:**
1. Open goal-list page with Chrome DevTools open
2. Clear cache and hard reload (Cmd+Shift+R)
3. Measure metrics in Network tab:
   - Total requests: ≤ 3
   - Load time: < 1 second
   - Transferred size: < 100KB
4. Verify functionality:
   - All goals displayed
   - Reviews visible
   - Rejection history correct
   - Filtering works
   - Grouping works
5. Test with various data sizes (5, 10, 20 goals)
6. Test with deep rejection chains (3+ levels)

**Related Requirements:** Requirement 5

---

### Phase 4: Documentation and Deployment (Priority: MEDIUM)

#### Task 4.1: Update API Documentation
**Estimated Time:** 30 minutes
**Assignee:** Backend Developer
**Dependencies:** Phase 1 complete
**Priority:** MEDIUM

**Description:**
Update API documentation with new query parameters and examples.

**Acceptance Criteria:**
- [ ] Document `includeReviews` parameter with examples
- [ ] Document `includeRejectionHistory` parameter with examples
- [ ] Update response schema showing optional fields
- [ ] Add performance notes (when to use embedded reviews)
- [ ] Add migration guide for frontend developers

**Deliverables:**
- Updated OpenAPI/Swagger docs
- Updated README.md
- Migration guide document

**Related Requirements:** Requirement 4

---

#### Task 4.2: Update Frontend Architecture Docs
**Estimated Time:** 20 minutes
**Assignee:** Frontend Developer
**Dependencies:** Phase 2 complete
**Priority:** LOW

**Description:**
Document the optimization and updated data flow.

**Acceptance Criteria:**
- [ ] Update architecture diagrams showing new flow
- [ ] Document performance improvements achieved
- [ ] Add troubleshooting guide
- [ ] Update component documentation

**Related Requirements:** None

---

#### Task 4.3: Set Up Performance Monitoring
**Estimated Time:** 30 minutes
**Assignee:** DevOps / Backend Developer
**Dependencies:** Phase 1 complete
**Priority:** MEDIUM

**Description:**
Add logging and metrics for monitoring performance in production.

**Acceptance Criteria:**
- [ ] Log response times for `/goals` endpoint
- [ ] Log SQL query counts per request
- [ ] Track `includeReviews` usage rate
- [ ] Set up alerts for slow responses (> 1.5s)
- [ ] Dashboard showing performance metrics

**Related Requirements:** Requirement 5

---

#### Task 4.4: Deploy to Staging
**Estimated Time:** 1 hour
**Assignee:** DevOps
**Dependencies:** All Phase 1-3 tasks complete
**Priority:** HIGH

**Description:**
Deploy optimized code to staging environment for final testing.

**Acceptance Criteria:**
- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Database migrations run (if any)
- [ ] Health checks pass
- [ ] Smoke tests pass
- [ ] Performance verified in staging

**Related Requirements:** All

---

#### Task 4.5: Deploy to Production
**Estimated Time:** 1 hour
**Assignee:** DevOps
**Dependencies:** Task 4.4, stakeholder approval
**Priority:** HIGH

**Description:**
Deploy optimized code to production environment.

**Acceptance Criteria:**
- [ ] Deployment plan reviewed and approved
- [ ] Rollback plan documented
- [ ] Backend deployed with zero downtime
- [ ] Frontend deployed
- [ ] Performance monitoring active
- [ ] Post-deployment verification complete
- [ ] Performance targets met in production

**Related Requirements:** All

---

## Task Dependencies Graph

```
Phase 1 (Backend):
  1.1 (Schema) ──┐
                 ├─→ 1.2 (API Endpoint) ──┐
  1.3 (Batch)  ──┤                        ├─→ 1.5 (Service) ─→ 3.1 (Unit Tests) ─┐
  1.4 (CTE)    ──┘                        │                                       │
                                          │                                       │
Phase 2 (Frontend):                      │                                       │
  2.1 (Types) ─→ 2.2 (API Client) ─→ 2.3 (Server Action) ─→ 2.4 (Hook) ─→ 3.4  │
                                                                                  │
Phase 3 (Testing):                                                                │
  3.1 (Backend Unit) ──┐                                                          │
  3.2 (Backend Integ) ─┼─→ 3.3 (Performance) ──┐                                │
  3.4 (Frontend Unit) ─┘                        ├─→ 3.5 (E2E Verification) ─────┤
                                                │                                 │
Phase 4 (Deploy):                               │                                 │
  4.1 (API Docs) ──┐                            │                                 │
  4.2 (FE Docs)  ──┼─→ 4.3 (Monitoring) ────────┘─→ 4.4 (Staging) ─→ 4.5 (Prod) │
                   │                                                               │
                   └───────────────────────────────────────────────────────────────┘
```

---

## Effort Summary

| Phase | Tasks | Total Estimated Time |
|-------|-------|---------------------|
| Phase 1: Backend | 5 tasks | ~4.5 hours |
| Phase 2: Frontend | 4 tasks | ~2 hours |
| Phase 3: Testing | 5 tasks | ~4 hours |
| Phase 4: Docs & Deploy | 5 tasks | ~3 hours |
| **TOTAL** | **19 tasks** | **~13.5 hours** |

**Realistic Timeline:** 2-3 working days for a single developer, or 1-2 days with paired backend/frontend developers.

---

## Success Criteria Checklist

At the end of implementation, verify:

- [ ] ✅ Goal list page loads in < 1 second (10x improvement)
- [ ] ✅ Frontend makes ≤ 3 HTTP requests (vs 20-50)
- [ ] ✅ Backend uses ≤ 2 SQL queries (vs 20-50)
- [ ] ✅ All existing functionality works unchanged
- [ ] ✅ No breaking changes for existing frontend code
- [ ] ✅ Rejection history displays correctly
- [ ] ✅ All tests pass (unit, integration, performance)
- [ ] ✅ Documentation updated
- [ ] ✅ Performance monitoring active
- [ ] ✅ Deployed to production successfully

---

## Notes

- **Backward Compatibility:** All changes must maintain backward compatibility. Existing code continues to work.
- **Incremental Deployment:** Backend can be deployed first. Frontend migration can happen incrementally.
- **Rollback Safety:** Both backend and frontend can be rolled back independently without data loss.
- **Performance First:** Every task should consider performance impact. Measure before/after.
