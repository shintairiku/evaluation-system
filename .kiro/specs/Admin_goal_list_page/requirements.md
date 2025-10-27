# Requirements Document: Admin Goal List Page (管理者用目標一覧)

## 1. Overview

This document defines the requirements for implementing an **admin-only page** that provides system-wide visibility of all goals across the organization. This feature enables administrators to monitor goal progress, analyze status distribution, and gain insights into overall goal management without the ability to edit or approve goals directly from this view.

**Problem Statement:**
- Administrators lack system-wide visibility into all user goals
- Current goal-list page is user/supervisor-scoped (cannot see all users)
- No centralized view for monitoring goal submission rates
- Difficult to analyze goal patterns across departments
- No way to quickly identify bottlenecks in the goal approval process

**Target Users:**
- **Primary**: System administrators (admin role)
- **Secondary**: HR managers monitoring evaluation process (future: may extend to manager role)

**Business Value:**
- **Visibility**: Complete overview of goal status across organization
- **Monitoring**: Track goal submission and approval rates
- **Analytics**: Identify patterns, bottlenecks, and trends
- **Compliance**: Ensure all employees have submitted goals
- **Decision Support**: Data for management discussions on goal quality

**Scope:**
- ✅ Read-only visualization of all goals
- ✅ Filtering by period, status, category, department, user
- ✅ Pagination and sorting
- ✅ Performance optimized (reuse `includeReviews` optimization)
- ❌ **NOT in scope**: Editing goals from this page
- ❌ **NOT in scope**: Approving/rejecting goals from this page
- ❌ **NOT in scope**: Exporting to Excel (future enhancement)

---

## 2. Requirements List

### Requirement 1: Admin-Only Access Control

**User Story:**
> As a system administrator, I want exclusive access to the admin goal list page so that only authorized personnel can view all user goals across the organization.

**Acceptance Criteria:**

```gherkin
GIVEN I am logged in as an admin user
WHEN I navigate to /admin/goal-list
THEN I should see the admin goal list page
AND I should see goals from all users in the organization

GIVEN I am logged in as a non-admin user (employee, supervisor, viewer)
WHEN I attempt to access /admin/goal-list
THEN I should receive a 403 Forbidden error
AND I should be redirected to an access denied page

GIVEN I am not logged in
WHEN I attempt to access /admin/goal-list
THEN I should be redirected to the login page
```

**Technical Requirements:**
- Frontend: Check user role before rendering page
- Frontend: Show/hide navigation link based on admin role
- Backend: Enforce `GOAL_READ_ALL` permission on endpoint
- Backend: Return 403 Forbidden if user lacks admin role
- Use existing `Permission.GOAL_READ_ALL` from RBAC system

**Security Considerations:**
- Endpoint must validate admin role on every request (no client-side only checks)
- Organization scope must be enforced (admin sees only their org's goals)
- Audit log for admin access (future enhancement)

---

### Requirement 2: Display All Goals System-Wide

**User Story:**
> As an administrator, I want to see all goals from all users in the organization so that I can monitor overall goal management and identify issues.

**Acceptance Criteria:**

```gherkin
GIVEN there are 150 goals across 50 users in my organization
WHEN I load the admin goal list page
THEN I should see all 150 goals (paginated)
AND each goal should display:
  - User name (goal owner)
  - Department name
  - Goal category (業績目標, コンピテンシー, コアバリュー)
  - Goal title/content preview (first 100 characters)
  - Goal status (draft, submitted, approved, rejected)
  - Goal weight percentage
  - Evaluation period
  - Created date
  - Updated date
  - Supervisor review status (if applicable)

GIVEN goals belong to users from different departments
WHEN I view the goal list
THEN I should see goals from ALL departments
AND department names should be displayed correctly

GIVEN goals are in different evaluation periods
WHEN I select a specific period
THEN I should see only goals from that period
AND I should be able to switch between periods
```

**Technical Requirements:**
- Backend endpoint: `GET /api/org/{org_slug}/admin/goals`
- Service: `GoalService.get_all_goals_for_admin()` (new method)
- Repository: Reuse `GoalRepository.search_goals()` with `user_ids=None` (all users)
- Include user and department information in response
- Default sort: `created_at DESC` (newest first)
- Pagination: 50 items per page (configurable)

**Data Requirements:**
- Join with `users` table for user name
- Join with `departments` table for department name
- Join with `evaluation_periods` table for period info
- Optionally include `supervisor_reviews` (batch fetch optimization)

---

### Requirement 3: Advanced Filtering Capabilities

**User Story:**
> As an administrator, I want to filter goals by various criteria so that I can focus on specific subsets of goals for analysis.

**Acceptance Criteria:**

```gherkin
GIVEN I am viewing the admin goal list
WHEN I select "submitted" status in the filter
THEN I should see only goals with status = "submitted"
AND the goal count should update to reflect filtered results

GIVEN I am viewing the admin goal list
WHEN I select "Engineering" department in the filter
THEN I should see only goals from users in the Engineering department
AND other departments' goals should be hidden

GIVEN I am viewing the admin goal list
WHEN I select multiple filters:
  - Status: submitted, approved
  - Category: 業績目標
  - Department: Engineering
THEN I should see goals matching ALL selected criteria (AND logic)
AND the filter count badge should show "3 active filters"

GIVEN I have applied multiple filters
WHEN I click "Clear all filters" button
THEN all filters should be reset
AND I should see all goals again

GIVEN I am filtering by status = "rejected"
WHEN the filtered results load
THEN I should see rejection comments for each goal
AND I should see which supervisor rejected each goal
```

**Filter Types:**

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| **Evaluation Period** | Dropdown | All periods | Current period |
| **Status** | Multi-select | draft, submitted, approved, rejected | All |
| **Goal Category** | Dropdown | 業績目標, コンピテンシー, コアバリュー | All |
| **Department** | Dropdown | All departments in org | All |
| **User** | Searchable dropdown | All users in org | All |

**Technical Requirements:**
- Frontend: Client-side filtering on loaded data (for performance)
- Backend: Support query parameters for each filter type
- Backend: Combine filters with AND logic
- Display active filter count badge
- "Clear all filters" button resets all filters
- Filters should persist in URL query params (shareable links)

---

### Requirement 4: Search and Sorting

**User Story:**
> As an administrator, I want to search for goals by user name and sort results by different fields so that I can quickly find specific goals.

**Acceptance Criteria:**

```gherkin
GIVEN I am viewing the admin goal list
WHEN I type "田中" in the user search box
THEN I should see only goals from users with "田中" in their name
AND the search should be case-insensitive
AND the results should update in real-time (debounced)

GIVEN I am viewing the goal list
WHEN I click the "Created Date" column header
THEN the goals should be sorted by created date (descending)
WHEN I click the column header again
THEN the goals should be sorted by created date (ascending)

GIVEN I have sorted goals by "Status"
WHEN I apply a department filter
THEN the sorting should be maintained
AND the filtered results should be sorted by status
```

**Sortable Fields:**
- Created date (default: DESC)
- Updated date
- User name (alphabetical, Japanese collation)
- Status (custom order: draft → submitted → approved → rejected)
- Goal category
- Weight percentage

**Technical Requirements:**
- Frontend: Implement client-side sorting for loaded data
- Backend: Support `sortBy` and `sortOrder` query parameters (future enhancement)
- Search: Debounce user input (300ms)
- Search: Case-insensitive, partial match
- Visual indicator: Show sort direction (↑↓) in column headers

---

### Requirement 5: Pagination and Performance

**User Story:**
> As an administrator viewing 500+ goals, I want the page to load quickly and navigate smoothly through pages so that I don't experience performance issues.

**Acceptance Criteria:**

```gherkin
GIVEN there are 500 goals in the system
WHEN I load the admin goal list page
THEN the initial page should load in < 2 seconds
AND I should see the first 50 goals
AND I should see pagination controls at the bottom

GIVEN I am viewing page 1 of 10
WHEN I click "Next page"
THEN I should see goals 51-100
AND the page should load in < 1 second (cached data)
AND the page number should update in the URL

GIVEN I am viewing page 5 of 10
WHEN I click "Go to page 8"
THEN I should jump directly to page 8
AND the page should load in < 1 second

GIVEN there are 1000 goals in the system
WHEN I load the admin goal list page
THEN the backend should use the includeReviews optimization
AND the frontend should make ≤ 3 HTTP requests total
AND SQL queries should be ≤ 3 (goals + reviews + counts)
```

**Pagination Requirements:**
- Items per page: 50 (default)
- Pagination controls: First, Previous, [1] [2] [3] ... [10], Next, Last
- Display: "Showing 1-50 of 237 goals"
- URL parameter: `?page=2` (shareable links)

**Performance Targets:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load time | < 2s | Chrome DevTools Network tab |
| Page navigation | < 1s | Client-side pagination |
| HTTP requests | ≤ 3 | DevTools Network tab |
| SQL queries | ≤ 3 | Backend logs |
| Time to interactive | < 2.5s | Lighthouse |

**Optimization Strategy:**
- **Reuse `includeReviews=true` batch optimization** from `perf/optimize-goal-list-performance`
- Load all filtered data at once (up to reasonable limit: 1000 goals)
- Client-side pagination for smooth UX
- Cache evaluation periods and departments (rarely change)
- Debounce search input to reduce re-renders

---

### Requirement 6: Responsive Design

**User Story:**
> As an administrator using a tablet or mobile device, I want the admin goal list to display properly on smaller screens so that I can monitor goals on the go.

**Acceptance Criteria:**

```gherkin
GIVEN I am viewing the admin goal list on a desktop (1920px wide)
WHEN the page loads
THEN I should see a full-width table with all columns visible
AND the table should fit within the viewport without horizontal scroll

GIVEN I am viewing the admin goal list on a tablet (768px wide)
WHEN the page loads
THEN the table should switch to a card-based layout
AND each card should display all goal information
AND cards should be stacked vertically

GIVEN I am viewing the admin goal list on a mobile phone (375px wide)
WHEN the page loads
THEN the page should be fully usable
AND filters should be collapsible
AND pagination should be simplified (Previous/Next only)
```

**Responsive Breakpoints:**
- **Desktop**: ≥ 1024px - Full table view
- **Tablet**: 768px - 1023px - Condensed table or card view
- **Mobile**: < 768px - Card view only

**Technical Requirements:**
- Use Tailwind responsive classes (`sm:`, `md:`, `lg:`)
- Table → Card layout switch at `md` breakpoint
- Collapsible filters on mobile (accordion style)
- Touch-friendly controls (minimum 44px tap targets)

---

### Requirement 7: Data Accuracy and Consistency

**User Story:**
> As an administrator, I want to see accurate and up-to-date goal data so that I can make informed decisions.

**Acceptance Criteria:**

```gherkin
GIVEN a user just submitted a goal 10 seconds ago
WHEN I load the admin goal list page
THEN I should see the newly submitted goal
AND the status should be "submitted"
AND the updated timestamp should reflect the submission time

GIVEN a supervisor just approved a goal
WHEN I refresh the admin goal list page
THEN the goal status should be "approved"
AND the supervisor review should be visible

GIVEN I am viewing goals from "2024 Q1" period
WHEN I switch to "2024 Q2" period
THEN I should see only goals from Q2
AND the goal count should update correctly
```

**Data Consistency Requirements:**
- No caching on admin endpoint (always fresh data)
- Display most recent data on every page load
- Show accurate counts for pagination
- Timestamps in local timezone (JST)

---

## 3. Non-Functional Requirements

### NFR-1: Performance

- **Page Load Time**: < 2 seconds for 500 goals
- **Time to Interactive**: < 2.5 seconds
- **HTTP Requests**: ≤ 3 (evaluation periods, users, goals)
- **SQL Queries**: ≤ 3 (goals, reviews, counts)
- **Database Query Time**: < 500ms per query
- **Frontend Bundle Size**: No significant increase (< 50KB added)

**Optimization Techniques:**
- ✅ Reuse `includeReviews=true` batch fetching optimization
- ✅ Client-side pagination (no server round-trips)
- ✅ Debounced search input (300ms)
- ✅ Memoized filter calculations
- ✅ Cached evaluation periods and departments

---

### NFR-2: Security

- **Authentication**: All requests require valid Clerk session
- **Authorization**: Enforce `GOAL_READ_ALL` permission (admin only)
- **Organization Scoping**: Admin sees only their organization's goals
- **Data Protection**: No PII in URL parameters
- **Audit Logging**: Log admin access (future enhancement)

**Security Controls:**
- Backend: Permission check on every request (no trust in frontend)
- Backend: Organization ID from auth context (not query param)
- Frontend: Hide navigation link from non-admins
- Frontend: Client-side role check for early UX feedback

---

### NFR-3: Usability

- **Ease of Use**: Intuitive filters and search
- **Consistency**: Follow existing admin page patterns
- **Feedback**: Show loading states for all async operations
- **Error Handling**: Clear error messages for failures
- **Accessibility**: Keyboard navigable, screen reader friendly

**UX Patterns to Follow:**
- Filter layout similar to existing goal-list page
- Period selector consistent with other pages
- Table styling matches admin pages
- Loading skeletons for async data

---

### NFR-4: Maintainability

- **Code Reuse**: Leverage existing components and hooks
- **Documentation**: Inline comments for complex logic
- **Testing**: Unit, integration, and E2E tests
- **Type Safety**: Full TypeScript coverage
- **Error Handling**: Comprehensive try-catch blocks

**Reusable Components:**
- `EvaluationPeriodSelector` (existing)
- `GoalStatusBadge` (existing)
- `EmployeeInfoCard` (existing)
- `GoalCard` or create `AdminGoalTableRow` (new)
- Filter components pattern from `GoalListFilters`

---

### NFR-5: Scalability

- **Data Volume**: Support up to 1000 goals per organization
- **Concurrent Users**: Handle 10 admins accessing simultaneously
- **Database Load**: Optimized queries with proper indexes
- **Frontend Performance**: Smooth rendering with 1000+ DOM elements

**Scalability Considerations:**
- Batch fetch optimization prevents N+1 queries
- Client-side pagination reduces server load
- Indexes on `org_id`, `period_id`, `status`, `user_id`
- Consider server-side pagination for orgs with 5000+ goals (future)

---

## 4. Success Criteria

This feature will be considered successful when:

- [ ] ✅ Admin users can access `/admin/goal-list` page
- [ ] ✅ Non-admin users receive 403 Forbidden
- [ ] ✅ Page displays all goals from all users
- [ ] ✅ All filters work correctly (period, status, category, department, user)
- [ ] ✅ Search by user name works
- [ ] ✅ Sorting by columns works
- [ ] ✅ Pagination works smoothly
- [ ] ✅ Page loads in < 2 seconds with 500 goals
- [ ] ✅ HTTP requests ≤ 3 (batch optimization working)
- [ ] ✅ Responsive design works on mobile/tablet
- [ ] ✅ All tests pass (unit, integration, E2E)
- [ ] ✅ No console errors or warnings
- [ ] ✅ Code review approved
- [ ] ✅ Documentation updated

---

## 5. Out of Scope (Future Enhancements)

The following features are **NOT included** in this initial release but may be considered for future iterations:

- ❌ **Export to Excel/CSV**: Download filtered goals as spreadsheet
- ❌ **Bulk Operations**: Approve/reject multiple goals at once
- ❌ **Advanced Analytics**: Charts and graphs for goal statistics
- ❌ **Goal Editing**: Edit goals directly from admin view
- ❌ **Audit Trail**: View history of all changes to a goal
- ❌ **Email Notifications**: Alert admin when goals are submitted
- ❌ **Custom Views**: Save filter combinations as custom views
- ❌ **Goal Comparison**: Compare goals across periods
- ❌ **Performance Dashboard**: System-wide goal metrics
- ❌ **Manager Role Access**: Extend to manager role (currently admin-only)

---

## 6. Assumptions and Dependencies

### Assumptions

1. Admin users have `GOAL_READ_ALL` permission in RBAC system
2. `includeReviews` batch optimization is already implemented and working
3. All goals belong to a valid evaluation period
4. All users belong to a valid department
5. Maximum 1000 goals per organization (reasonable limit)

### Dependencies

1. **Existing Features:**
   - RBAC system with `GOAL_READ_ALL` permission
   - Batch review fetching optimization (`includeReviews=true`)
   - Evaluation period management
   - Department management
   - User management

2. **Technical Dependencies:**
   - Backend: FastAPI, SQLAlchemy, PostgreSQL
   - Frontend: Next.js 15, React 19, TypeScript, shadcn/ui
   - Authentication: Clerk
   - Deployment: Vercel (frontend), GCP Cloud Run (backend)

3. **External Dependencies:**
   - Clerk authentication service (uptime: 99.9%)
   - Supabase database (uptime: 99.9%)

---

## 7. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Performance degradation with 1000+ goals** | High | Medium | Implement server-side pagination if needed; optimize SQL queries |
| **Admin permission misconfiguration** | Critical | Low | Comprehensive permission tests; security review |
| **UI complexity on mobile** | Medium | Medium | Thorough responsive testing; simplify mobile view |
| **Confusion with existing goal-review page** | Low | Low | Clear navigation labels; user documentation |
| **Database load from admin queries** | Medium | Low | Proper indexes; query optimization; monitoring |

---

## 8. Acceptance Testing Scenarios

### Scenario 1: Admin Access and Display

```gherkin
GIVEN I am logged in as admin "admin@example.com"
AND there are 50 goals from 20 users in the system
WHEN I navigate to /admin/goal-list
THEN I should see the admin goal list page
AND I should see "全ユーザーの目標を表示 (50件)" in the header
AND I should see a table with 50 goal rows
AND each row should display: user name, department, category, status, weight
```

### Scenario 2: Non-Admin Access Denied

```gherkin
GIVEN I am logged in as employee "employee@example.com"
WHEN I attempt to navigate to /admin/goal-list
THEN I should see an "Access Denied" page
AND I should see a message "この機能は管理者のみ利用可能です"
AND I should see a link to return to the dashboard
```

### Scenario 3: Filter by Status and Department

```gherkin
GIVEN I am viewing the admin goal list with 100 goals
WHEN I select status filter = "submitted"
AND I select department filter = "Engineering"
THEN I should see only submitted goals from Engineering department
AND the count should update to reflect the filtered results
AND the filter badge should show "2 active filters"
```

### Scenario 4: Search by User Name

```gherkin
GIVEN I am viewing the admin goal list
WHEN I type "田中太郎" in the user search box
THEN I should see only goals from user "田中太郎"
AND the results should update in real-time
AND the count should show the number of goals for that user
```

### Scenario 5: Performance with Large Dataset

```gherkin
GIVEN there are 500 goals in the system
WHEN I load the admin goal list page for the first time
THEN the page should load in less than 2 seconds
AND the browser should make exactly 3 HTTP requests:
  1. GET /evaluation-periods
  2. GET /users
  3. GET /admin/goals?includeReviews=true
AND I should see the first 50 goals
AND pagination should show "Showing 1-50 of 500 goals"
```

---

## 9. Documentation Requirements

### Technical Documentation

- [ ] API documentation for `GET /api/org/{org_slug}/admin/goals`
- [ ] Architecture decision record (ADR) for admin-only access
- [ ] Code comments for complex filtering logic
- [ ] README update with new admin feature

### User Documentation

- [ ] Admin guide: How to use the admin goal list page
- [ ] Admin guide: Understanding goal statuses and filters
- [ ] Troubleshooting: Common issues and solutions
- [ ] Release notes: Feature announcement

---

## Appendix A: Related Requirements

- **Performance Optimization**: `.kiro/specs/Optimize_goal_list_performance/requirements.md`
- **RBAC System**: `backend/app/security/README.md`
- **Goal Management**: Existing goal-list and goal-review requirements
- **Admin Features**: Competency management, evaluation period management

---

## Appendix B: Glossary

- **Admin**: User with `admin` role and `GOAL_READ_ALL` permission
- **Goal**: Employee objective set during evaluation period
- **Status**: Goal state (draft, submitted, approved, rejected)
- **Period**: Evaluation period (e.g., "2024 Q1")
- **Batch Optimization**: Technique to fetch multiple records in one query
- **N+1 Query**: Performance anti-pattern where N additional queries are made
- **Organization Scope**: Data filtering by organization ID

---

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Author**: Development Team
**Status**: Planning Phase
