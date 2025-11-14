# [REFACTOR] Admin Goals - User-Centric List View + Data Fetch Performance Plan (管理者目標一覧のユーザー中心ビュー + パフォーマンス改善)

## 📋 Overview

Refactor the admin goals list page from a **goal-centric view** (one row per goal) to a **user-centric view** (one row per user) with significant performance improvements for large organizations. This refactoring addresses usability issues and eliminates performance bottlenecks in the current implementation.

**Scope**: Frontend refactoring with optional backend optimizations

**Related Specifications**:
- Requirements: `.kiro/specs/admin-goals-user-centric/requirements.md`
- Design: `.kiro/specs/admin-goals-user-centric/design.md`
- Tasks: `.kiro/specs/admin-goals-user-centric/tasks.md`

**GitHub Issue**: [#337](https://github.com/shintairiku/evaluation-system/issues/337)

---

## 🎯 Problem Statement

### Current Issues with Goal-Centric View

**Usability Problems:**
- 📊 **Multiple rows per user**: A user with 6 goals appears as 6 separate rows, making it difficult to audit who has/hasn't submitted goals
- 🔍 **Difficult to track compliance**: Hard to see at a glance which users have incomplete goal submissions
- 📈 **Poor aggregation**: No summary of goal counts, approval status per user
- 🎯 **Scattered information**: User details repeated across multiple rows

**Performance Problems:**
- ⏱️ **Slow sequential fetching**: Current implementation fetches pages sequentially (page 1 → wait → page 2 → wait → ...)
- 🐌 **N+1 query potential**: Each goal requires enrichment with user data on server-side
- 📉 **Poor scaling**: Performance degrades significantly with large datasets (5k-10k goals)
- 💾 **Inefficient data loading**: Multiple round-trips to server for pagination

**Current Implementation Analysis** (from `useAdminGoalListData.ts`):
```typescript
// Sequential pagination (slow for large datasets)
const firstPageResult = await getAdminGoalsAction({ page: 1 });
for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
  const pageResult = await getAdminGoalsAction({ page: nextPage }); // Sequential!
}
```

**Business Impact:**
- ⏱️ **Load time**: 5-10 seconds for organizations with 100+ users
- 😕 **User frustration**: Administrators abandoning page due to slow loading
- 📉 **Reduced compliance monitoring**: Difficult to track goal submission rates
- 🎯 **Poor management visibility**: Cannot quickly identify who needs follow-up

---

## 🎯 Desired Solution

### A. UI/UX Refactor - User-Centric View

**New View Structure:**

| User | Department | Stage | Goals | Competency | Team | Status | Last Activity |
|------|------------|-------|-------|------------|------|--------|---------------|
| 山田太郎 | 営業部 | Stage 3 | 6/6 | 5/6 | 3/3 | 承認済み: 14 | 2024-03-15 |
| 佐藤花子 | 開発部 | Stage 5 | 8/8 | 6/6 | 2/2 | 下書き: 2, 未提出: 14 | 2024-03-14 |

**Benefits:**
- ✅ **One row per user**: Easy to scan and audit
- ✅ **Aggregated metrics**: Goal counts, status summary at a glance
- ✅ **Compliance tracking**: Quickly identify users without goals
- ✅ **Click to details**: Row expands or links to individual user's goal details
- ✅ **Better filtering**: Filter by user characteristics (department, stage, role)

### B. Frontend Performance Optimization

**Concurrent Data Fetching:**
```typescript
// Fetch all pages concurrently (parallel requests)
const pagePromises = Array.from({ length: totalPages }, (_, i) =>
  getAdminGoalsAction({ page: i + 1, limit: 100 })
);
const results = await Promise.allSettled(pagePromises); // Parallel!
```

**User Data Mapping:**
```typescript
// Use existing org-chart endpoint for efficient user lookup
const usersResult = await getUsersAction(); // Single request
const userMap = new Map(users.map(u => [u.id, u]));
```

**Client-Side Aggregation:**
```typescript
// Group goals by user for instant filtering
const goalsByUser = goals.reduce((acc, goal) => {
  if (!acc[goal.userId]) acc[goal.userId] = [];
  acc[goal.userId].push(goal);
  return acc;
}, {});
```

**Benefits:**
- ✅ **Faster loading**: Concurrent requests reduce load time by 50-70%
- ✅ **Better UX**: Loading indicator shows progress for each page
- ✅ **Resilient**: Promise.allSettled handles partial failures gracefully
- ✅ **Instant filtering**: Client-side filtering on preloaded data

### C. Backend Optimization (Optional)

**New Aggregate Endpoint (Future Enhancement):**
```python
@router.get("/admin/goals/by-user")
async def get_admin_goals_by_user(
    period_id: UUID,
    context: AuthContext = Depends(get_auth_context)
) -> List[UserGoalSummary]:
    """
    Returns goal aggregations grouped by user.
    Much faster than fetching all goals and aggregating client-side.
    """
```

**Response Format:**
```json
{
  "items": [
    {
      "userId": "user-123",
      "userName": "山田太郎",
      "department": "営業部",
      "stage": "Stage 3",
      "goalCounts": {
        "total": 6,
        "competency": 5,
        "team": 3,
        "byStatus": {
          "draft": 2,
          "submitted": 4,
          "approved": 0
        }
      },
      "lastActivity": "2024-03-15T10:30:00Z"
    }
  ]
}
```

**Benefits:**
- ✅ **Server-side aggregation**: Database does the heavy lifting
- ✅ **Reduced payload**: Send summaries instead of all goal details
- ✅ **Sub-second response**: Single optimized query vs hundreds of rows
- ✅ **Scalable**: Handles 10k+ goals efficiently

---

## ✅ Acceptance Criteria

### AC-1: User-Centric Table View
```gherkin
GIVEN I am an admin viewing /admin/users-goals
WHEN the page loads
THEN I see one row per user
AND each row shows: user name, department, stage, goal counts, status summary
AND users are sortable by name, department, last activity
```

### AC-2: Goal Count Display
```gherkin
GIVEN a user has 6 goals (4 submitted, 2 draft)
WHEN I view their row in the table
THEN I see "合計: 6" for total goals
AND I see status breakdown: "提出済み: 4, 下書き: 2"
AND goal counts are grouped by category (competency, team, individual)
```

### AC-3: User Detail View
```gherkin
GIVEN I click on a user row
WHEN the detail view opens
THEN I see all goals for that user
AND I can see goal titles, categories, status, and review information
AND I have a "Back to List" button to return to user table
```

### AC-4: Performance Target Met
```gherkin
GIVEN an organization has 5,000-10,000 goals
WHEN I load the admin users-goals page
THEN p95 load time is ≤ 2 seconds
AND I can filter instantly on preloaded data
AND the browser makes ≤ 3 concurrent HTTP requests for goal data
```

### AC-5: Filtering Works on User Level
```gherkin
GIVEN I am on the user-centric goal list
WHEN I filter by department "営業部"
THEN only users in 営業部 are shown
AND their aggregated goal counts remain accurate

WHEN I filter by "has incomplete goals"
THEN only users with draft or not-submitted goals are shown
```

### AC-6: Concurrent Fetching Works
```gherkin
GIVEN there are 300 goals across 3 pages
WHEN the page loads
THEN all 3 pages are fetched concurrently
AND the loading indicator shows progress for each page
AND if one page fails, the others still load successfully
```

---

## 🚀 Rollout Plan

### Phase 1: Add User-Centric View (Behind Feature Flag)
1. Create new route `/admin/users-goals`
2. Implement `AdminGoalsByUserTable` component
3. Add concurrent data fetching with `Promise.allSettled`
4. Keep existing `/admin/goal-list` as-is
5. Deploy behind feature flag or to beta users

### Phase 2: Performance Optimization
1. Implement concurrent page fetching
2. Add org-chart endpoint for user mapping
3. Optimize client-side filtering/sorting
4. Measure and validate performance improvements

### Phase 3: Switch to New View
1. Gather user feedback on new view
2. Fix any issues discovered
3. Update navigation links to point to new route
4. Deprecate old goal-centric view (or keep as "detail view")

### Phase 4: Backend Aggregate Endpoint (Optional)
1. Design aggregate SQL query
2. Implement `/admin/goals/by-user` endpoint
3. Update frontend to use new endpoint
4. Measure performance improvements
5. Keep client-side aggregation as fallback

---

## 📊 Success Metrics

### User Experience Metrics:
- ✅ **Load time**: p95 ≤ 2 seconds (vs current 5-10s)
- ✅ **Compliance tracking**: Admins can identify incomplete submissions in < 30 seconds
- ✅ **User satisfaction**: Positive feedback from admin users
- ✅ **Adoption rate**: 80%+ of admins prefer new view

### Technical Metrics:
- ✅ **Request count**: ≤ 3 concurrent requests for goal data
- ✅ **Payload size**: 30-50% reduction if using aggregate endpoint
- ✅ **Error rate**: No increase in errors with concurrent fetching
- ✅ **Filtering performance**: < 100ms for client-side filtering

### Business Metrics:
- ✅ **Goal compliance rate**: Easier tracking → higher compliance
- ✅ **Admin efficiency**: 50% reduction in time spent auditing goals
- ✅ **Follow-up actions**: Faster identification of users needing support

---

## 🔄 Related Work

**Similar Implementations in Project:**
- **User Profiles Page** (`/user-profiles`): Shows user list with aggregated info
- **Org Management Page** (`/org-management`): Tabbed view with user lists
- **Hierarchy Display**: User-centric tree view with aggregated data

**Similar Performance Patterns:**
- **Concurrent data fetching**: Used in org-management for faster loads
- **Client-side aggregation**: Used in admin-goal-list for filtering
- **User mapping**: Existing pattern from user service

**Future Enhancements (Out of Scope):**
- Export to CSV/Excel for reporting
- Goal submission reminders from admin view
- Bulk status updates (approve multiple users at once)
- Dashboard analytics with charts/graphs

---

## 📝 Technical Notes

### Why User-Centric View is Better

**For Administrators:**
- Primary task is auditing compliance (who has/hasn't submitted goals)
- Need to identify users needing follow-up
- Want high-level overview before diving into details
- Goal-level details are secondary concern

**For Performance:**
- Fewer rows to render (100 users vs 600 goals)
- Aggregation can be done client-side or server-side
- Easier to implement virtual scrolling if needed
- Better for responsive design (mobile-friendly)

### Why Concurrent Fetching

**Problem with Sequential:**
```
Page 1 request → 500ms → Page 2 request → 500ms → Page 3 request → 500ms
Total: 1500ms + processing time
```

**Benefit with Concurrent:**
```
Page 1, 2, 3 requests (parallel) → 500ms max → all data arrives
Total: 500ms + processing time (3x faster!)
```

**Implementation:**
- Use `Promise.allSettled` to handle partial failures gracefully
- Show loading progress indicator for better UX
- Cancel pending requests if user navigates away
- Implement retry logic for failed pages

### Why Optional Backend Endpoint

**Client-Side Aggregation Works Well When:**
- ✅ Dataset is reasonably sized (< 10k goals)
- ✅ Data is already fetched with reviews embedded
- ✅ Filtering/sorting needs to be instant
- ✅ Development time is limited

**Server-Side Aggregation Better When:**
- ✅ Dataset is very large (> 10k goals)
- ✅ Payload size is a concern (mobile users)
- ✅ Want sub-second initial load
- ✅ Have time to implement SQL optimization

**Recommendation**: Start with client-side, add server-side later if needed.

---

## 🔗 References

- GitHub Issue: https://github.com/shintairiku/evaluation-system/issues/337
- Current Implementation: `frontend/src/feature/evaluation/admin/admin-goal-list/`
- Current Hook: `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`
- User Profiles (similar UX): `frontend/src/feature/user-profiles/`
- Org Management (similar UX): `frontend/src/feature/org-management/`
