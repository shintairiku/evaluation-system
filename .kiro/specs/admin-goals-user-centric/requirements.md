# Requirements Document: Admin Goals User-Centric View

## 1. Overview

This document defines the requirements for refactoring the admin goals list page from a goal-centric view to a user-centric view with significant performance improvements. The refactoring addresses usability and performance issues in the current implementation.

**Problem Statement:**
- Current view shows one row per goal, making user compliance tracking difficult
- Sequential pagination causes slow load times (5-10 seconds for large datasets)
- No aggregated view of user goal completion status
- Difficult to identify which users need follow-up

**Target Users:**
- **Primary**: System administrators monitoring goal compliance
- **Secondary**: HR managers reviewing organizational goal status
- **Tertiary**: Department heads checking team goal completion

**Business Value:**
- **Efficiency**: 50% reduction in time spent auditing goal compliance
- **Performance**: 70% faster page load times (p95 ≤ 2s vs current 5-10s)
- **Usability**: One-row-per-user view enables instant compliance checking
- **Scalability**: Handles organizations with 5k-10k goals efficiently

**Scope:**
- ✅ Create new `/admin/users-goals` route with user-centric view
- ✅ Implement concurrent data fetching for performance
- ✅ Add client-side user-level aggregation
- ✅ Maintain filtering and sorting capabilities
- ✅ Link to individual user goal details
- ❌ **NOT in scope**: Bulk editing or approval actions
- ❌ **NOT in scope**: Export to CSV (future enhancement)
- ❌ **NOT in scope**: Backend aggregate endpoint (optional Phase 4)

---

## 2. Functional Requirements

### 2.1 User-Centric Table View

**FR-1: One Row Per User Display**
- **Requirement**: Display one row per user regardless of goal count
- **Rationale**: Enables quick scanning and compliance auditing
- **Columns**:
  1. User name (with avatar/icon)
  2. Department name
  3. Stage name
  4. Total goal count (e.g., "6/6" if target is 6)
  5. Goal breakdown by category (Competency, Team, Individual)
  6. Status summary (e.g., "承認済み: 4, 下書き: 2")
  7. Last activity date
  8. Action button (e.g., "詳細を見る")

**FR-2: Goal Count Aggregation**
- **Requirement**: Show aggregated goal counts per user
- **Specification**:
  ```typescript
  interface UserGoalCounts {
    total: number;              // Total goals
    competency: number;         // Competency goals
    team: number;              // Team goals
    individual: number;        // Individual goals
    byStatus: {
      draft: number;           // Draft goals
      submitted: number;       // Submitted goals
      inReview: number;        // In review
      approved: number;        // Approved
      rejected: number;        // Rejected
    };
  }
  ```
- **Display Format**: "合計: 6 (コンピテンシー: 5, チーム: 3, 個人: 1)"

**FR-3: Status Summary Display**
- **Requirement**: Show user-level status summary
- **Display Rules**:
  - If all goals approved: "✅ 承認済み: 6"
  - If any goals in draft: "📝 下書き: 2, 提出済み: 4"
  - If any goals rejected: "❌ 差し戻し: 1, 承認済み: 5"
  - Color coding: Green (all approved), Yellow (pending), Red (rejected)

**FR-4: User Detail Navigation**
- **Requirement**: Click user row to view detailed goal list
- **Options**:
  - **Option A**: Expand row inline to show goal cards
  - **Option B**: Navigate to separate detail page `/admin/users-goals/{userId}`
  - **Option C**: Open modal with goal list
- **Recommendation**: Option B (separate page) for better deep linking and URL sharing

---

### 2.2 Filtering and Sorting

**FR-5: User-Level Filters**
- **Requirement**: Filter table by user attributes
- **Filters**:
  1. **Department filter**: Multi-select dropdown of departments
  2. **Stage filter**: Multi-select dropdown of stages
  3. **Status filter**: Options like "Has incomplete goals", "All approved", "Has rejections"
  4. **Search filter**: Search by user name or department
- **Behavior**: Filters apply instantly on client-side data

**FR-6: Goal Completion Filter**
- **Requirement**: Filter users by goal completion status
- **Options**:
  - "すべて" (All users)
  - "目標未設定" (No goals set)
  - "設定中" (Has draft goals)
  - "提出済み" (All submitted, pending review)
  - "承認済み" (All approved)
  - "差し戻しあり" (Has rejected goals)

**FR-7: Sorting Capabilities**
- **Requirement**: Sort table by multiple columns
- **Sortable Columns**:
  - User name (alphabetical)
  - Department name (alphabetical)
  - Stage name (hierarchical order)
  - Total goal count (numerical)
  - Last activity date (chronological)
- **Default Sort**: Last activity date (descending) - most recent first

---

### 2.3 Individual User Goal Details

**FR-8: Detail Page Structure**
- **Requirement**: Individual page showing all goals for selected user
- **Route**: `/admin/users-goals/{userId}?periodId={periodId}`
- **Components**:
  1. **User info card**: Name, department, stage, avatar (reuse EmployeeInfoCard)
  2. **Goal summary stats**: Total, by category, by status
  3. **Goal table**: Similar to existing AdminGoalListTable but filtered to user
  4. **Back button**: Return to user list
- **Reuse**: Leverage existing AdminGoalListTable component with userId filter

**FR-9: Goal Card Display**
- **Requirement**: Show detailed goal information
- **Content**:
  - Goal title and description
  - Category badge (Competency, Team, Individual)
  - Status badge (Draft, Submitted, In Review, Approved, Rejected)
  - Weight/priority
  - Competency name (if applicable)
  - Review status and comments
  - Last updated date

---

## 3. Non-Functional Requirements

### 3.1 Performance

**NFR-1: Page Load Time**
- **Requirement**: p95 page load time ≤ 2 seconds for 5k-10k goals
- **Current Performance**: 5-10 seconds (unacceptable)
- **Measurement**:
  - Start: User clicks on admin users-goals link
  - End: Table rendered with all data loaded
- **Testing**: Load test with 100 users, 6 goals each = 600 goals

**NFR-2: Concurrent Data Fetching**
- **Requirement**: Fetch all goal pages concurrently
- **Specification**:
  ```typescript
  // Instead of sequential
  for (let page = 1; page <= totalPages; page++) {
    await fetchPage(page); // SLOW: sequential
  }

  // Use concurrent
  const promises = Array.from({ length: totalPages }, (_, i) =>
    fetchPage(i + 1)
  );
  const results = await Promise.allSettled(promises); // FAST: parallel
  ```
- **Max Concurrent Requests**: 5-10 (to avoid overwhelming server)
- **Error Handling**: Use Promise.allSettled to handle partial failures

**NFR-3: Client-Side Filtering Performance**
- **Requirement**: Filtering and sorting must be instant (< 100ms)
- **Approach**: Pre-load all data, then filter/sort in memory
- **Dataset Size**: Support up to 500 users with 10 goals each (5000 total)
- **Optimization**: Use memoization (useMemo) for computed values

**NFR-4: Request Optimization**
- **Requirement**: Minimize number of HTTP requests
- **Target**: ≤ 3 requests to load page
  1. Evaluation periods (1 request)
  2. Users and departments (1 request, may be cached)
  3. Goals data (multiple concurrent requests counted as 1 logical group)
- **Caching**: Leverage existing user/department caching if available

---

### 3.2 Data Integrity

**NFR-5: Accurate Aggregation**
- **Requirement**: Goal counts and status summaries must be accurate
- **Validation**:
  - Sum of category counts = total goal count
  - Sum of status counts = total goal count
  - Last activity date matches most recent goal update
- **Testing**: Compare client-side aggregation with backend counts

**NFR-6: Consistent Data**
- **Requirement**: User data and goal data must be in sync
- **Approach**:
  - Fetch users and goals for same period
  - Handle case where user has no goals (show "0/0")
  - Handle case where goal references deleted user (show "Unknown User")

---

### 3.3 Usability

**NFR-7: Responsive Design**
- **Requirement**: View must work on desktop, tablet, and mobile
- **Breakpoints**:
  - Desktop (≥ 1024px): Full table with all columns
  - Tablet (768-1023px): Condensed table, some columns hidden
  - Mobile (< 768px): Card view instead of table
- **Testing**: Test on Chrome DevTools device emulation

**NFR-8: Loading State**
- **Requirement**: Provide clear loading feedback
- **Implementation**:
  - Skeleton loaders for table rows
  - Progress indicator showing "Loading page X of Y..."
  - Partial data display (show loaded data while rest loads)
  - Timeout after 30 seconds with error message

**NFR-9: Error Handling**
- **Requirement**: Graceful handling of data loading errors
- **Scenarios**:
  - Some pages fail to load: Show loaded data + error banner
  - All pages fail: Show error message + retry button
  - Network timeout: Show timeout message + retry option
- **User Action**: Always provide "再読み込み" (reload) button

---

## 4. Data Requirements

### 4.1 Data Sources

**DR-1: Goals Data**
- **Source**: `/admin/goals` endpoint with `includeReviews=true`
- **Pagination**: 100 items per page (backend limit)
- **Fetching Strategy**: Concurrent fetching of all pages
- **Embedded Data**: Reviews must be embedded to avoid N+1 queries

**DR-2: Users Data**
- **Source**: `/users` endpoint or existing cached data
- **Required Fields**:
  - id, name, email
  - department (id, name)
  - stage (id, name)
  - supervisor (id, name)
  - avatar URL (optional)
- **Caching**: May use existing cached user data if available

**DR-3: Evaluation Periods**
- **Source**: `/evaluation-periods` endpoint
- **Required**: Current period and all available periods
- **Default**: Use current active period if no period selected

---

### 4.2 Data Transformation

**DR-4: User-Goal Mapping**
- **Requirement**: Map goals to users for aggregation
- **Algorithm**:
  ```typescript
  const goalsByUser = goals.reduce((acc, goal) => {
    const userId = goal.userId;
    if (!acc[userId]) {
      acc[userId] = {
        userId,
        goals: [],
        counts: { total: 0, competency: 0, team: 0, individual: 0 },
        statusCounts: { draft: 0, submitted: 0, approved: 0, rejected: 0 }
      };
    }
    acc[userId].goals.push(goal);
    acc[userId].counts.total++;
    acc[userId].counts[goal.goalCategory]++;
    acc[userId].statusCounts[goal.status]++;
    return acc;
  }, {});
  ```

**DR-5: Last Activity Calculation**
- **Requirement**: Determine most recent activity for each user
- **Algorithm**:
  ```typescript
  const lastActivity = Math.max(
    ...userGoals.map(g => new Date(g.updatedAt).getTime())
  );
  ```

---

## 5. UI/UX Requirements

### 5.1 Table Layout

**UX-1: Table Structure**
- **Requirement**: Clean, scannable table design
- **Specifications**:
  - Fixed header (sticky on scroll)
  - Alternating row colors for readability
  - Row hover effect for interactivity
  - Clickable rows (cursor: pointer)
  - Loading skeleton during data fetch

**UX-2: Column Widths**
- **Requirement**: Optimized column widths
- **Recommended**:
  - User name: 20%
  - Department: 15%
  - Stage: 10%
  - Goal counts: 20%
  - Status summary: 20%
  - Last activity: 10%
  - Actions: 5%

**UX-3: Empty State**
- **Requirement**: Helpful message when no data
- **Scenarios**:
  - No users in system: "ユーザーが登録されていません"
  - No goals for period: "この期間の目標はまだ設定されていません"
  - All filtered out: "フィルター条件に一致するユーザーがいません"
  - Include illustration or icon

---

### 5.2 Filtering UI

**UX-4: Filter Controls Layout**
- **Requirement**: Intuitive filter interface
- **Layout**: Horizontal row above table with:
  - Search input (left)
  - Department dropdown
  - Stage dropdown
  - Status dropdown
  - Clear filters button (right)
- **Behavior**: Filters apply immediately on change

**UX-5: Active Filters Display**
- **Requirement**: Show active filters clearly
- **Implementation**: Chips/badges below filter controls showing:
  - "Department: 営業部 ×"
  - "Status: 設定中 ×"
  - Click × to remove individual filter

---

## 6. Out of Scope

The following features are explicitly **NOT** included in this refactoring:

**OS-1: Bulk Actions**
- Bulk approve/reject goals from user list
- **Reason**: Approval should remain deliberate, one-by-one process
- **Future Work**: Separate feature if requested

**OS-2: Export Functionality**
- Export user goal summary to CSV/Excel
- **Reason**: Focus on viewing first, export later
- **Future Work**: Can add in Phase 5

**OS-3: Goal Submission Reminders**
- Send reminder emails to users with incomplete goals
- **Reason**: Notification system is separate concern
- **Future Work**: Separate feature request

**OS-4: Backend Aggregate Endpoint**
- New `/admin/goals/by-user` endpoint
- **Reason**: Client-side aggregation sufficient for Phase 1-3
- **Future Work**: Add in Phase 4 if needed for scale

**OS-5: Dashboard Analytics**
- Charts/graphs showing goal completion trends
- **Reason**: Separate dashboard feature
- **Future Work**: Admin dashboard project

**OS-6: Mobile App**
- Native mobile app for admin goal management
- **Reason**: Out of scope, web responsive design sufficient
- **Future Work**: Mobile app project

---

## 7. Success Criteria

### 7.1 Functional Success

- ✅ User-centric table displays one row per user
- ✅ Goal counts are accurate and aggregated correctly
- ✅ Status summaries reflect current goal states
- ✅ Clicking user row navigates to detail page
- ✅ Filtering works on all specified attributes
- ✅ Sorting works on all specified columns
- ✅ Detail page shows all goals for selected user

### 7.2 Performance Success

- ✅ p95 page load time ≤ 2 seconds (test with 600 goals)
- ✅ Concurrent fetching reduces load time by ≥ 50%
- ✅ Client-side filtering completes in < 100ms
- ✅ No increase in server error rate
- ✅ Browser memory usage acceptable (< 100MB)

### 7.3 User Experience Success

- ✅ Admins prefer new view over old (survey feedback)
- ✅ Time to identify incomplete goals reduced by 50%
- ✅ No user-reported bugs in first week
- ✅ Mobile view is usable and functional
- ✅ Loading states are clear and informative

---

## 8. Acceptance Testing

### 8.1 Functional Tests

**Test 1: Table Displays Users Correctly**
```gherkin
GIVEN organization has 10 users with goals
WHEN I navigate to /admin/users-goals
THEN I see 10 rows (one per user)
AND each row shows user name, department, goal counts, status
```

**Test 2: Goal Counts Are Accurate**
```gherkin
GIVEN user "山田太郎" has 6 goals (5 competency, 1 team)
WHEN I view the user list
THEN 山田太郎's row shows "合計: 6 (コンピテンシー: 5, チーム: 1)"
AND clicking the row shows all 6 goals in detail view
```

**Test 3: Status Summaries Are Correct**
```gherkin
GIVEN user has 4 approved goals, 2 draft goals
WHEN I view the user list
THEN status shows "承認済み: 4, 下書き: 2"
AND status indicator is yellow (not all approved)
```

**Test 4: Filtering Works**
```gherkin
GIVEN I select department filter "営業部"
WHEN the filter is applied
THEN only users in 営業部 are shown
AND goal counts remain accurate for shown users
```

**Test 5: Detail Page Navigation**
```gherkin
GIVEN I am on the user list
WHEN I click on "山田太郎" row
THEN I navigate to /admin/users-goals/{userId}
AND I see all goals for 山田太郎
AND I see a "戻る" button to return to list
```

---

### 8.2 Performance Tests

**Test 6: Load Time Under 2 Seconds**
```gherkin
GIVEN organization has 100 users with 6 goals each (600 goals)
WHEN I navigate to /admin/users-goals
THEN page fully loads in ≤ 2 seconds (p95)
AND all data is displayed correctly
```

**Test 7: Concurrent Fetching Works**
```gherkin
GIVEN goals require 6 pages to fetch (100 per page)
WHEN data loading starts
THEN all 6 pages are fetched concurrently
AND loading indicator shows progress
AND page renders as soon as all data arrives
```

**Test 8: Partial Failure Handling**
```gherkin
GIVEN 6 pages need to be fetched
AND page 3 fails due to network error
WHEN loading completes
THEN pages 1,2,4,5,6 data is displayed
AND error message indicates page 3 failed
AND "再読み込み" button is available
```

---

### 8.3 Usability Tests

**Test 9: Mobile Responsive**
```gherkin
GIVEN I view page on mobile device (375px width)
WHEN page loads
THEN table switches to card view
AND all information is accessible
AND cards are scrollable/swipeable
```

**Test 10: Loading State Clear**
```gherkin
GIVEN I navigate to page with slow network
WHEN data is loading
THEN I see skeleton loaders in table
AND progress message shows "Loading page X of Y"
AND I can cancel/navigate away
```

---

## 9. Dependencies

### 9.1 Technical Dependencies

- **Frontend Framework**: Next.js (App Router) - existing
- **UI Library**: shadcn/ui - existing
- **API Client**: Existing server actions and endpoints
- **State Management**: React hooks (useState, useMemo, useEffect)

### 9.2 Data Dependencies

- **Goals API**: `/admin/goals` with `includeReviews=true`
- **Users API**: `/users` endpoint
- **Departments API**: `/departments` endpoint
- **Periods API**: `/evaluation-periods` endpoint

### 9.3 Component Dependencies

- **Reusable Components**:
  - `EmployeeInfoCard`: Show user details
  - `EvaluationPeriodSelector`: Period selection
  - `GoalStatusBadge`: Status badges
  - `AdminGoalListTable`: Goal list (can reuse with userId filter)
  - Existing filter components

---

## 10. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Concurrent requests overload server | HIGH | MEDIUM | Limit concurrent requests to 5-10, implement request throttling |
| Client-side aggregation is slow for large datasets | MEDIUM | LOW | Use useMemo for optimization, consider backend endpoint if needed |
| Users confused by new UI | MEDIUM | LOW | Provide onboarding tooltip, keep old view accessible temporarily |
| Partial data loading creates inconsistencies | MEDIUM | MEDIUM | Use Promise.allSettled, show clear error messages, provide retry |
| Memory issues with large datasets | MEDIUM | LOW | Implement pagination or virtual scrolling if needed |

---

## 11. Implementation Timeline

**Estimated Total Time**: 16-24 hours

| Phase | Tasks | Time | Deliverable |
|-------|-------|------|-------------|
| **Phase 1: Core Implementation** | New route, components, concurrent fetching | 8-10h | Working user-centric view |
| **Phase 2: Filtering & Sorting** | Implement all filters and sorting | 4-6h | Full feature parity |
| **Phase 3: Detail Page** | User detail view | 2-3h | Complete navigation flow |
| **Phase 4: Testing & Polish** | Performance testing, bug fixes, UX polish | 2-3h | Production-ready |
| **Phase 5 (Optional)**: Backend endpoint | Aggregate endpoint for scale | 4-6h | Optimized for large orgs |

---

## 12. References

- GitHub Issue: [#337](https://github.com/shintairiku/evaluation-system/issues/337)
- ISSUE.md: `.kiro/specs/admin-goals-user-centric/ISSUE.md`
- Design Doc: `.kiro/specs/admin-goals-user-centric/design.md`
- Tasks Doc: `.kiro/specs/admin-goals-user-centric/tasks.md`
- Current Implementation: `frontend/src/feature/evaluation/admin/admin-goal-list/`
- Current Hook: `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`
