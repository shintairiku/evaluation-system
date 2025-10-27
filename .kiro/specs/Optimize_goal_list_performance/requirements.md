# Requirements Document: Optimize Goal List Performance

## 1. Overview

This document defines the requirements for optimizing the performance of the Goal List page in the HR Evaluation System. Currently, the goal-list page takes **3-5 seconds** to load due to N+1 query problems when fetching supervisor reviews and rejection history. This task focuses on implementing a backend API optimization to embed reviews within the goals response, reducing HTTP requests from 20-50 down to 1-2.

**Problem Statement:**
- Goal list page takes 3-5 seconds to load (unacceptable UX)
- N+1 query problem: Frontend makes 1 request for goals + N requests for reviews
- Recursive rejection history fetching causes exponential request growth
- Poor scalability: Performance degrades linearly with number of goals

**Target Users:**
- Employees viewing their goal list
- Supervisors viewing subordinate goals
- System administrators monitoring performance

**Current Architecture Issues:**
```
Frontend → GET /goals (1 request)
Frontend → GET /reviews?goalId=1 (N requests - 1 per goal)
Frontend → GET /reviews?goalId=2
Frontend → GET /reviews?goalId=3
...
Frontend → GET /goals/{previousGoalId} (M requests - recursive history)
Frontend → GET /reviews?goalId={previousGoalId}
...

Total: 1 + N + (N × M) requests = 20-50+ requests
Load time: 3-5 seconds
```

**Target Architecture:**
```
Frontend → GET /goals?includeReviews=true (1 request)
Backend → SQL JOIN goals + reviews (1-2 SQL queries)

Total: 1 request
Load time: 0.3-0.5 seconds (10x faster)
```

## 2. Requirements List

### Requirement 1: Backend API - Embed Reviews in Goals Response

**User Story:**
> As a developer, I want the Goals API to optionally include supervisor reviews in the response so that the frontend doesn't need to make separate requests for each goal's reviews.

**Acceptance Criteria:**

```gherkin
GIVEN I am calling GET /api/org/{org}/goals/
WHEN I include the query parameter includeReviews=true
THEN the response should include supervisor_review field for each goal
AND the supervisor_review should be the most recent review for that goal
AND the response time should be < 500ms for 10 goals
AND the number of SQL queries should be ≤ 2 (1 for goals + 1 batch for reviews)

GIVEN I am calling GET /api/org/{org}/goals/
WHEN I do NOT include includeReviews parameter (default behavior)
THEN the response should NOT include supervisor_review field
AND the API should maintain backward compatibility
AND existing frontend code should continue to work without changes
```

**Technical Requirements:**
- Add optional query parameter: `includeReviews: boolean = false`
- Add optional query parameter: `includeRejectionHistory: boolean = false`
- Extend `Goal` schema with optional fields:
  - `supervisor_review?: SupervisorReview`
  - `rejection_history?: SupervisorReview[]`
- Implement batch query in `SupervisorReviewRepository.get_by_goals_batch()`
- Update `GoalService._enrich_goal_data()` to optionally embed reviews
- Use SQL JOIN or IN clause for efficient batch fetching

**Performance Targets:**
- Response time: < 500ms for 10 goals
- Response time: < 1000ms for 50 goals
- SQL queries: ≤ 2 (goals + reviews batch)
- HTTP requests: 1 (vs 20-50 currently)

---

### Requirement 2: Frontend - Use Embedded Reviews

**User Story:**
> As an employee, I want the goal list page to load in under 1 second so that I can quickly review my goals without waiting.

**Acceptance Criteria:**

```gherkin
GIVEN I am viewing the goal list page
WHEN the page loads
THEN it should call GET /goals?includeReviews=true (1 request only)
AND the page should render in < 1 second
AND I should see all goals with their supervisor comments
AND rejected goals should show rejection comments immediately

GIVEN I have 10 goals in the current period
WHEN the goal list loads
THEN the frontend should make exactly 3 HTTP requests:
  1. GET /evaluation-periods (cached)
  2. GET /users (cached)
  3. GET /goals?includeReviews=true (with embedded reviews)
AND no additional requests should be made for reviews
```

**Technical Requirements:**
- Update `getGoalsAction()` to accept `includeReviews` parameter
- Remove N+1 review fetching logic from `useGoalListData` hook
- Remove recursive `fetchRejectionHistory()` function
- Use embedded `supervisor_review` from API response
- Use embedded `rejection_history` for multiple rejection comments
- Maintain all existing functionality (filtering, grouping, etc.)

**Performance Targets:**
- Initial page load: < 1 second
- HTTP requests: ≤ 3 total (vs 20-50 currently)
- Time to interactive: < 1.5 seconds
- Network bandwidth: < 100KB (vs 500KB+ currently)

---

### Requirement 3: Rejection History Optimization

**User Story:**
> As an employee with multiple rejection cycles, I want to see the complete rejection history without the page taking forever to load.

**Acceptance Criteria:**

```gherkin
GIVEN I have a goal that was rejected 3 times
WHEN I view the goal list
THEN I should see all 3 rejection comments in chronological order
AND the page should load in < 1 second
AND the backend should fetch the entire rejection chain in 1 query

GIVEN I have 5 goals with rejection history (2-3 rejections each)
WHEN the page loads
THEN the backend should fetch all rejection history in 1-2 SQL queries
AND the frontend should make only 1 HTTP request
AND all rejection comments should be displayed without additional loading
```

**Technical Requirements:**
- Backend: Implement recursive CTE or self-join to fetch entire `previousGoalId` chain
- Backend: Include `rejection_history` array in response when `includeRejectionHistory=true`
- Frontend: Remove recursive `fetchRejectionHistory()` logic
- Frontend: Display rejection history from embedded array
- Sort rejection history chronologically (oldest → newest)

**SQL Query Example:**
```sql
-- Recursive CTE to fetch entire previousGoalId chain
WITH RECURSIVE goal_chain AS (
  -- Base case: current goal
  SELECT id, previous_goal_id, 0 as depth
  FROM goals
  WHERE id = ?

  UNION ALL

  -- Recursive case: follow previousGoalId chain
  SELECT g.id, g.previous_goal_id, gc.depth + 1
  FROM goals g
  INNER JOIN goal_chain gc ON g.id = gc.previous_goal_id
  WHERE gc.depth < 10  -- Prevent infinite loops
)
SELECT sr.*
FROM supervisor_reviews sr
INNER JOIN goal_chain gc ON sr.goal_id = gc.id
WHERE sr.action = 'rejected'
ORDER BY gc.depth DESC;  -- Chronological order
```

---

### Requirement 4: Backward Compatibility

**User Story:**
> As a developer, I want to ensure that existing code continues to work during the migration so that we can deploy incrementally without breaking changes.

**Acceptance Criteria:**

```gherkin
GIVEN the new API changes are deployed
WHEN existing frontend code calls GET /goals WITHOUT includeReviews parameter
THEN the API should return the original response format
AND no supervisor_review or rejection_history fields should be included
AND all existing functionality should work unchanged

GIVEN we are migrating the frontend to use embedded reviews
WHEN we deploy the frontend changes
THEN the backend should support both old and new API styles
AND we should be able to rollback without backend changes
```

**Technical Requirements:**
- Make `includeReviews` and `includeRejectionHistory` optional parameters (default: false)
- Maintain original `Goal` schema structure
- Add optional fields to `Goal` schema (not breaking changes)
- Ensure backward compatibility with existing frontend code
- Support feature flag for gradual rollout

---

### Requirement 5: Monitoring and Metrics

**User Story:**
> As a system administrator, I want to monitor the performance improvements so that I can verify the optimization is working and catch regressions.

**Acceptance Criteria:**

```gherkin
GIVEN the optimization is deployed
WHEN I check application metrics
THEN I should see:
  - Average goal list load time < 1 second
  - P95 load time < 1.5 seconds
  - Average HTTP requests per page load ≤ 3
  - Average SQL queries per request ≤ 2

GIVEN the backend is under load
WHEN 100 concurrent users access the goal list
THEN the API should maintain response times < 1 second
AND database CPU usage should not exceed 70%
AND no database connection pool exhaustion should occur
```

**Technical Requirements:**
- Log response times for `/goals` endpoint
- Track number of SQL queries per request
- Monitor database query performance
- Set up alerts for response times > 1.5 seconds
- Track error rates and connection pool metrics

---

## 3. Non-Functional Requirements

### Performance Requirements

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| **Page Load Time** | 3-5 seconds | < 1 second | Backend optimization |
| **HTTP Requests** | 20-50 | ≤ 3 | Embed reviews in API |
| **SQL Queries** | 20-50 | ≤ 2 | Batch queries + JOIN |
| **Response Size** | 500KB+ | < 100KB | Eliminate duplicate headers |
| **Time to Interactive** | 4-6 seconds | < 1.5 seconds | Faster data loading |

### Scalability Requirements

- Support 1000+ goals per evaluation period without performance degradation
- Handle 100+ concurrent users without database connection issues
- Scale linearly with number of goals (O(n) instead of O(n²))
- Support pagination for large goal lists (50-100 goals per page)

### Compatibility Requirements

- Maintain API backward compatibility (existing code continues to work)
- Support gradual frontend migration (both old and new code coexist)
- No breaking changes to database schema
- Support rollback without data migration

---

## 4. Out of Scope

The following items are explicitly out of scope for this task:

- ❌ Implementing pagination for goal list (future enhancement)
- ❌ Adding caching layer (Redis, etc.) - use existing cache mechanisms only
- ❌ Changing database schema or adding indexes (use existing schema)
- ❌ Optimizing other pages (goal-review, goal-edit, etc.)
- ❌ Adding real-time updates (WebSockets, polling)
- ❌ Implementing infinite scroll or virtualization
- ❌ Changing UI/UX design (performance only)

---

## 5. Success Criteria

This task will be considered successful when:

1. ✅ Goal list page loads in < 1 second (10x improvement)
2. ✅ Frontend makes ≤ 3 HTTP requests (vs 20-50)
3. ✅ Backend uses ≤ 2 SQL queries (vs 20-50)
4. ✅ All existing functionality works unchanged
5. ✅ No breaking changes for existing frontend code
6. ✅ Rejection history displays correctly for multi-rejection goals
7. ✅ Performance metrics show consistent < 1s load times

---

## 6. Assumptions and Dependencies

### Assumptions

- Database has sufficient indexes on `goals.id`, `supervisor_reviews.goal_id`, `goals.previous_goal_id`
- Network latency between frontend and backend is < 100ms
- Average number of goals per user is 5-20
- Average rejection depth (previousGoalId chain) is 1-3 levels

### Dependencies

- Existing backend API endpoints (`GET /goals`, `GET /supervisor-reviews`)
- Existing database schema (no migrations required)
- Existing `GoalService` and `SupervisorReviewRepository` classes
- Frontend `useGoalListData` hook

---

## 7. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Breaking changes to frontend** | High | Low | Make parameters optional, maintain backward compatibility |
| **Database performance degradation** | Medium | Low | Use EXPLAIN ANALYZE, test with large datasets |
| **Complex recursive query bugs** | Medium | Medium | Thorough testing, limit recursion depth |
| **Cache invalidation issues** | Low | Low | Clear cache on goal/review updates |
| **Memory issues with large responses** | Low | Low | Implement pagination (future task) |

---

## 8. Testing Requirements

### Unit Tests

- ✅ Backend: `get_by_goals_batch()` returns correct reviews
- ✅ Backend: Recursive CTE fetches complete previousGoalId chain
- ✅ Backend: `includeReviews=false` maintains original behavior
- ✅ Frontend: Embedded reviews are correctly mapped to goals

### Integration Tests

- ✅ API with `includeReviews=true` returns embedded reviews
- ✅ API with `includeRejectionHistory=true` returns complete history
- ✅ API without parameters maintains backward compatibility
- ✅ Frontend goal list displays all data correctly

### Performance Tests

- ✅ Load 10 goals with reviews in < 500ms
- ✅ Load 50 goals with reviews in < 1000ms
- ✅ Concurrent 100 users maintain < 1s response time
- ✅ SQL query count ≤ 2 per request

### User Acceptance Tests

- ✅ Employee can view goal list in < 1 second
- ✅ Rejection comments display correctly
- ✅ Multiple rejection history shows all comments
- ✅ Page remains interactive during load

---

## 9. Rollout Plan

### Phase 1: Backend Implementation (Day 1-2)
- Implement `get_by_goals_batch()` repository method
- Add `includeReviews` and `includeRejectionHistory` parameters to API
- Update `GoalService` to embed reviews
- Test with existing frontend (no changes yet)

### Phase 2: Frontend Migration (Day 2-3)
- Update `getGoalsAction()` to use `includeReviews=true`
- Remove N+1 review fetching logic from `useGoalListData`
- Test goal list page thoroughly
- Deploy behind feature flag (optional)

### Phase 3: Cleanup (Day 3)
- Remove old review fetching code
- Update documentation
- Monitor performance metrics
- Verify success criteria

---

## 10. Documentation Requirements

- Update API documentation with new query parameters
- Document performance improvements in changelog
- Update frontend architecture docs
- Add performance monitoring guide
- Document rollback procedure
