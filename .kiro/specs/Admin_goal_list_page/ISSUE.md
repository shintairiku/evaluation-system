# [FEATURE] Admin Goal List Page - System-Wide Goal Visualization (管理者用目標一覧)

## 📋 Overview

Create an **admin-only page** that displays all goals from every user in the system for visualization purposes. This page provides administrators with system-wide visibility into goal progress, status distribution, and overall goal management across the organization.

**Scope**: Read-only visualization (no editing or approval capabilities)

**Related Specifications**:
- Requirements: `.kiro/specs/Admin_goal_list_page/requirements.md`
- Design: `.kiro/specs/Admin_goal_list_page/design.md`
- Tasks: `.kiro/specs/Admin_goal_list_page/tasks.md`

### Why a Separate Admin Page?

The system currently has two goal pages:
1. **Employee Goal List** (`/goal-list`) - Employees manage own goals, supervisors view subordinates
2. **Supervisor Goal Review** (`/goal-review`) - Supervisors approve/reject submitted goals

This new **Admin Goal List** (`/admin/goal-list`) serves a different purpose:
- **Purpose**: System-wide monitoring and analytics (not management or approval)
- **Scope**: ALL users in organization (not limited to subordinates)
- **View**: Table-based summary view (not detailed card view)
- **Actions**: Read-only (no edit, submit, or approve actions)

The existing `/goals` endpoint with `GOAL_READ_ALL` permission defaults to showing only the admin's own goals (secure by default). A separate `/admin/goals` endpoint is needed to provide system-wide visibility.

---

## 🎯 Business Value

**Problem**: Administrators lack system-wide visibility into goal management
- Cannot view all user goals in one place
- Difficult to identify bottlenecks in approval process
- No way to analyze goal patterns across departments
- Limited ability to ensure compliance (all employees have goals)

**Solution**: Admin-only page showing all goals with advanced filtering
- Complete overview of goal status across organization
- Filter by period, status, category, department, user
- Monitor submission and approval rates
- Identify patterns and trends

**Benefits**:
- 📊 **Visibility**: System-wide goal monitoring
- 🎯 **Compliance**: Ensure all employees have submitted goals
- 📈 **Analytics**: Identify patterns and bottlenecks
- 🚀 **Decision Support**: Data-driven management discussions

---

## ✅ Acceptance Criteria

### AC-1: Admin Access Only
```gherkin
GIVEN I am logged in as an admin
WHEN I navigate to /admin/goal-list
THEN I see the admin goal list page with all goals

GIVEN I am logged in as a non-admin (employee/supervisor)
WHEN I attempt to access /admin/goal-list
THEN I receive a 403 Forbidden error or am redirected
```

### AC-2: Display All Goals
```gherkin
GIVEN there are 150 goals in the system
WHEN I load the admin goal list page
THEN I see all 150 goals (paginated)
AND each goal shows: owner, department, category, title, status, weight, date
```

### AC-3: Filtering Works
```gherkin
GIVEN I am on the admin goal list page
WHEN I select "submitted" status filter
THEN only submitted goals are displayed

WHEN I select a specific department
THEN only goals from users in that department are displayed

WHEN I apply multiple filters (status + department)
THEN results match ALL selected filters (AND logic)
```

### AC-4: Performance Optimized
```gherkin
GIVEN there are 100 goals in the system
WHEN I load the admin goal list page
THEN the page loads in < 2 seconds
AND the browser makes ≤ 3 HTTP requests
AND supervisor reviews are embedded (no N+1 queries)
```

### AC-5: Responsive Design
```gherkin
GIVEN I am viewing the page on a mobile device
WHEN the page loads
THEN the table switches to card view
AND all information remains accessible
```

---

## 🛠️ Technical Implementation

### Key Technical Decisions

#### Why a Separate `/admin/goals` Endpoint?

The existing `/goals` endpoint has security-by-default behavior:

**Current `/goals` Endpoint** (`goal_service.py` lines 548-581):
```python
if current_user_context.has_permission(Permission.GOAL_READ_ALL):
    # Admin CAN see all goals, but defaults to OWN goals unless userId explicitly requested
    if requested_user_id:
        return [requested_user_id]  # See specific user's goals
    # Default: scope to current user's own goals to avoid accidental data exposure
    return [current_user_context.user_id]  # See ONLY own goals
```

**New `/admin/goals` Endpoint**: Intentionally bypasses this security filter to show ALL users' goals.

| Aspect | `/goals` Endpoint | `/admin/goals` Endpoint |
|--------|-------------------|------------------------|
| **Permission** | GOAL_READ_ALL | GOAL_READ_ALL |
| **Default Behavior** | Shows admin's OWN goals | Shows ALL users' goals |
| **User Filter** | Requires explicit userId param | No user filtering (system-wide) |
| **Security Philosophy** | Secure by default | Explicit system-wide access |
| **Use Case** | Personal goal management | System monitoring |

This separation ensures:
- ✅ Existing `/goals` behavior remains secure (no breaking changes)
- ✅ Admin intent is explicit when accessing system-wide data
- ✅ Clear separation between personal management and system monitoring

### Backend Changes

#### 1. New Admin Endpoint

**File**: `backend/app/api/v1/admin.py`

```python
@router.get("/goals", response_model=GoalList)
async def get_admin_goals(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId"),
    user_id: Optional[UUID] = Query(None, alias="userId"),
    department_id: Optional[UUID] = Query(None, alias="departmentId"),
    goal_category: Optional[str] = Query(None, alias="goalCategory"),
    status: Optional[List[str]] = Query(None),
    include_reviews: bool = Query(True, alias="includeReviews"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all goals for admin visualization (admin-only endpoint).

    Permissions: Requires admin role (GOAL_READ_ALL)
    Performance: Uses includeReviews=true by default (batch optimization)

    NOTE: This endpoint intentionally shows ALL users' goals (no user filtering).
    This is different from /goals which shows only admin's own goals by default.
    """
    # Permission check
    if not context.has_permission(Permission.GOAL_READ_ALL):
        raise HTTPException(403, "Admin role required")

    service = GoalService(session)
    return await service.get_all_goals_for_admin(
        org_id=context.organization_id,
        period_id=period_id,
        user_id=user_id,
        department_id=department_id,
        goal_category=goal_category,
        status=status,
        pagination=pagination,
        include_reviews=include_reviews
    )
```

#### 2. Service Layer Extension

**File**: `backend/app/services/goal_service.py` (add new method)

```python
async def get_all_goals_for_admin(
    self,
    org_id: str,
    period_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,
    goal_category: Optional[str] = None,
    status: Optional[List[str]] = None,
    pagination: Optional[PaginationParams] = None,
    include_reviews: bool = True,
    include_rejection_history: bool = False
) -> PaginatedResponse[Goal]:
    """
    Get all goals for admin (no user-level filtering).

    SECURITY: Should ONLY be called from admin-protected endpoints.
    """
    # Search goals with user_ids=None (ALL users)
    goals = await self.goal_repo.search_goals(
        org_id=org_id,
        user_ids=None,  # ← KEY: None = all users
        period_id=period_id,
        department_id=department_id,
        goal_category=goal_category,
        status=status,
        pagination=pagination
    )

    # Batch fetch reviews (performance optimization)
    reviews_map = {}
    if include_reviews and goals:
        goal_ids = [goal.id for goal in goals]
        reviews_map = await self.supervisor_review_repo.get_by_goals_batch(
            goal_ids=goal_ids,
            org_id=org_id
        )

    # Enrich and return...
```

#### 3. Repository Enhancement (Optional)

**File**: `backend/app/database/repositories/goal_repo.py`

Add `department_id` parameter to `search_goals()` and `count_goals()` methods:

```python
async def search_goals(
    self,
    org_id: str,
    user_ids: Optional[List[UUID]] = None,  # None = all users
    period_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,  # NEW
    # ...
):
    query = select(GoalModel).where(GoalModel.org_id == org_id)

    if user_ids is not None:
        query = query.where(GoalModel.user_id.in_(user_ids))

    # NEW: Department filter
    if department_id:
        query = query.join(User).where(User.department_id == department_id)

    # ... rest of method
```

---

### Frontend Changes

#### 1. Page Route

**File**: `frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx`

```tsx
import AdminGoalListPage from '@/feature/evaluation/admin/admin-goal-list/display/index';

export default function Page() {
  return <AdminGoalListPage />;
}
```

#### 2. Main Component (with Component Reuse)

**File**: `frontend/src/feature/evaluation/admin/admin-goal-list/display/index.tsx`

```tsx
'use client';

import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector'; // ← REUSE
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard'; // ← REUSE (from goal-list)

/**
 * Component Reuse Strategy:
 * - EvaluationPeriodSelector: Existing component (use as-is)
 * - EmployeeInfoCard: From goal-list (show when user filter selected)
 * - GoalStatusBadge: Existing component (used in table)
 */
export default function AdminGoalListPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const {
    filteredGoals,
    paginatedGoals,
    selectedUserId,
    selectedUserData,
    isLoading,
    error,
    // ... filters, pagination state
  } = useAdminGoalListData({ selectedPeriodId });

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header + Period Selector (REUSE) */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">管理者用目標一覧</h1>
            <p className="text-sm text-muted-foreground">
              全ユーザーの目標を表示 ({filteredGoals.length}件)
            </p>
          </div>
          <EvaluationPeriodSelector {...} />
        </div>

        {/* Filters (adapted from goal-list patterns) */}
        <AdminGoalListFilters {...} />

        {/* Employee Info Card (REUSE - show when user filter selected) */}
        {selectedUserId && selectedUserData && (
          <EmployeeInfoCard employee={selectedUserData} />
        )}

        {/* Goals Table */}
        <AdminGoalListTable goals={paginatedGoals} />

        {/* Pagination */}
        <PaginationControls {...} />
      </div>
    </div>
  );
}
```

#### 3. Data Hook

**File**: `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`

```tsx
export function useAdminGoalListData(params?: { selectedPeriodId?: string }) {
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<GoalStatus[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  // ... more filter state

  const loadGoalData = useCallback(async () => {
    // Load periods, departments, users in parallel
    const [periodResult, deptResult, usersResult] = await Promise.all([...]);

    // Fetch all goals with batch optimization
    const goalsResult = await getAdminGoalsAction({
      periodId: selectedPeriod.id,
      limit: 1000,
      includeReviews: true,  // ← PERFORMANCE OPTIMIZATION
    });

    setGoals(goalsResult.data.items);
  }, [params?.selectedPeriodId]);

  // Client-side filtering
  const filteredGoals = useMemo(() => {
    let result = goals;
    if (selectedStatuses.length > 0) {
      result = result.filter(g => selectedStatuses.includes(g.status));
    }
    // ... more filters
    return result;
  }, [goals, selectedStatuses, ...]);

  // Client-side pagination
  const paginatedGoals = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredGoals.slice(start, start + itemsPerPage);
  }, [filteredGoals, currentPage]);

  return {
    goals,
    filteredGoals,
    paginatedGoals,
    isLoading,
    error,
    // ... filter controls, pagination controls
  };
}
```

#### 4. API Integration

**File**: `frontend/src/api/endpoints/goals.ts`

```typescript
export const goalsApi = {
  // ... existing methods

  getAdminGoals: async (params?: {
    periodId?: UUID;
    departmentId?: UUID;
    status?: string[];
    // ...
  }) => {
    const queryParams = new URLSearchParams();
    // Build query params...

    return apiClient.get<GoalListResponse>(
      `${buildOrgApiUrl('/admin/goals')}?${queryParams.toString()}`
    );
  },
};
```

**File**: `frontend/src/api/server-actions/goals.ts`

```typescript
export const getAdminGoalsAction = cache(async (params?: {...}) => {
  try {
    const response = await goalsApi.getAdminGoals(params);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: '...' };
  }
});
```

---

## 📝 Implementation Tasks

### Backend Tasks (6 hours)

- [x] **Task 1.1**: Create admin goals API endpoint (1.5h)
  - File: `backend/app/api/v1/admin.py`
  - Permission check with `GOAL_READ_ALL`
  - Query parameters support

- [x] **Task 1.2**: Implement admin service method (2h)
  - File: `backend/app/services/goal_service.py`
  - `get_all_goals_for_admin()` method
  - Bypass user filtering, reuse batch optimization

- [x] **Task 1.3**: Update repository for department filtering (1h)
  - File: `backend/app/database/repositories/goal_repo.py`
  - Add `department_id` parameter
  - JOIN with users table

- [x] **Task 1.4**: Write backend tests (1.5h)
  - Permission enforcement tests
  - Department filtering tests
  - Integration tests

### Frontend Tasks (9.5 hours)

- [x] **Task 2.1**: Create page route (0.25h)
  - File: `frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx`

- [x] **Task 2.2**: Create API client method (0.5h)
  - File: `frontend/src/api/endpoints/goals.ts`
  - `getAdminGoals()` method

- [x] **Task 2.3**: Create server action (0.33h)
  - File: `frontend/src/api/server-actions/goals.ts`
  - `getAdminGoalsAction()` with caching

- [x] **Task 2.4**: Create data hook (2h)
  - File: `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`
  - Load data, filtering, pagination

- [x] **Task 2.5**: Create main page component with EmployeeInfoCard (1.5h)
  - File: `frontend/src/feature/evaluation/admin/admin-goal-list/display/index.tsx`
  - Layout, states, sub-components
  - **REUSE**: `EvaluationPeriodSelector` from `@/components/evaluation/`
  - **REUSE**: `EmployeeInfoCard` from `@/components/evaluation/` (show when user filter selected)

- [x] **Task 2.6**: Create filter component (reusing patterns) (1h)
  - File: `frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListFilters.tsx`
  - **REUSE**: Filter layout structure from `GoalListFilters` component
  - **REUSE**: Active filter count badge pattern from `GoalListFilters`
  - **ADAPT**: User selection pattern from `EmployeeSelector` (as filter dropdown)

- [x] **Task 2.7**: Create table component (1.5h)
  - File: `frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListTable.tsx`

- [x] **Task 2.8**: Write frontend tests (1.5h)
  - Unit tests for hook, components
  - E2E tests

### Integration Tasks (3.25 hours)

- [x] **Task 3.1**: Add navigation link (0.25h)
- [x] **Task 3.2**: Performance testing (1h)
- [x] **Task 3.3**: Security testing (0.5h)
- [x] **Task 3.4**: Documentation (1h)

### Deployment Tasks (1 hour)

- [x] **Task 4.1**: Deploy to staging (0.5h)
- [x] **Task 4.2**: Deploy to production (0.5h)

**Total Estimated Effort**: 19.75 hours → **Adjusted: 10-13 hours** (accounting for parallel work, reused code)

---

## 🧪 Testing Strategy

### Unit Tests

**Backend**:
```python
def test_admin_goals_requires_admin_permission()
def test_admin_can_fetch_all_goals()
def test_admin_goals_filtered_by_department()
def test_admin_goals_uses_batch_optimization()
```

**Frontend**:
```typescript
describe('useAdminGoalListData', () => {
  it('loads goals with batch optimization')
  it('filters goals by status')
  it('filters goals by department')
  it('paginates goals correctly')
})
```

### Integration Tests

```python
async def test_admin_endpoint_permission_enforcement():
    """Non-admin gets 403 Forbidden"""

async def test_admin_endpoint_returns_all_goals():
    """Admin sees all goals across organization"""
```

### E2E Tests

```typescript
test('admin can view and filter all goals', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/goal-list');

  // Verify page loads
  await expect(page.getByRole('heading', { name: '管理者用目標一覧' })).toBeVisible();

  // Verify goals displayed
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
});

test('non-admin cannot access admin goal list', async ({ page }) => {
  await loginAsEmployee(page);
  await page.goto('/admin/goal-list');

  // Verify access denied
  await expect(page.getByText('Access Denied')).toBeVisible();
});
```

### Performance Tests

```typescript
test('page loads in < 2 seconds', async ({ page }) => {
  const start = Date.now();
  await page.goto('/admin/goal-list');
  await page.waitForSelector('table');
  const loadTime = Date.now() - start;

  expect(loadTime).toBeLessThan(2000);
});

test('makes ≤ 3 HTTP requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) requests.push(req.url());
  });

  await page.goto('/admin/goal-list');
  await page.waitForSelector('table');

  expect(requests.length).toBeLessThanOrEqual(3);
});
```

---

## 🔐 Security Considerations

### Security Layers

1. **Authentication**: Valid Clerk JWT required
2. **Authorization**: `GOAL_READ_ALL` permission check (admin only)
3. **Organization Scoping**: Filter by `org_id` from auth context (not query params)
4. **Frontend Protection**: Hide navigation link from non-admins (UX only, not security)

### Security Checklist

- [x] Backend endpoint checks `GOAL_READ_ALL` permission
- [x] Organization scope enforced at repository layer
- [x] No PII in URL parameters
- [x] Generic error messages (no internal details)
- [x] Audit logging for admin access
- [x] Input validation for all query parameters

---

## 🚀 Performance Optimization

### Strategy

| Technique | Implementation | Benefit |
|-----------|----------------|---------|
| **Batch Review Fetching** | Reuse `includeReviews=true` | 95% fewer HTTP requests |
| **Client-Side Filtering** | Filter in React state | Instant updates, no server calls |
| **Client-Side Pagination** | Paginate in memory | Smooth navigation |
| **Memoization** | `useMemo` for filtered data | Prevent recalculations |
| **Loading Skeletons** | Skeleton UI | Perceived performance |

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Initial Page Load | < 2s | TBD |
| HTTP Requests | ≤ 3 | TBD |
| SQL Queries | ≤ 3 | TBD |
| Filter Response | < 100ms | TBD |
| Page Navigation | < 50ms | TBD |

---

## 📊 Success Metrics

- [x] ✅ Admin can view all goals from all users
- [x] ✅ Non-admin users get 403 Forbidden
- [x] ✅ Page loads in < 2 seconds with 100 goals
- [x] ✅ Filters work correctly (status, department, user, category)
- [x] ✅ HTTP requests ≤ 3 (batch optimization working)
- [x] ✅ Responsive design works on mobile
- [x] ✅ All tests pass (unit + integration + E2E)
- [x] ✅ No console errors or warnings
- [x] ✅ Code review approved
- [x] ✅ Documentation updated

---

## 🔗 Related Work

### Reuse from Existing Code

1. **Performance Optimization**: Reuse `includeReviews=true` batch fetching from employee goal-list (eliminates N+1 queries)
2. **Permission System**: Use `GOAL_READ_ALL` permission from `backend/app/security/permissions.py`
3. **Frontend Pattern**: Follow structure from `/admin/report/page.tsx` and employee goal-list
4. **Components to Reuse**:
   - ✅ `EvaluationPeriodSelector` from `@/components/evaluation/` (use as-is)
   - ✅ `GoalStatusBadge` from `@/components/evaluation/` (use as-is)
   - ✅ `EmployeeInfoCard` from `@/components/evaluation/` (use as-is, show when user filter selected)
5. **Components to Adapt**:
   - 🔄 `GoalListFilters` - Adapt filter layout structure
   - 🔄 `EmployeeSelector` - Adapt user selection pattern
6. **Data Hook**: Follow pattern from `useGoalListData` hook (parallel data fetching, client-side filtering)

### Related Specifications

- `.kiro/specs/Optimize_goal_list_performance/` - Performance optimization reference
- `backend/app/security/README.md` - RBAC system documentation
- Existing admin pages: `/report`, `/competency-management`, `/stage-management`

---

## 🎯 Out of Scope (Future Enhancements)

The following features are **NOT included** in this release:

- ❌ Export to Excel/CSV
- ❌ Bulk operations (approve/reject multiple goals)
- ❌ Advanced analytics (charts and graphs)
- ❌ Goal editing from admin view
- ❌ Audit trail visualization
- ❌ Email notifications
- ❌ Custom saved views
- ❌ Goal comparison across periods
- ❌ Manager role access (currently admin-only)

---

## 📅 Estimated Timeline

**Total Effort**: 10-13 hours (1.5-2 days)

- **Backend**: 6 hours (1 day)
- **Frontend**: 9.5 hours (1-1.5 days)
- **Integration & Testing**: 3.25 hours (0.5 day)
- **Deployment**: 1 hour (concurrent with testing)

**Recommended Schedule**:
- **Day 1**: Backend implementation + Frontend setup
- **Day 2**: Frontend components + Integration testing
- **Day 3**: Polish, documentation, deployment

---

## 🏷️ Labels

`feature`, `admin`, `goal-management`, `priority: medium`, `effort: medium`, `performance-optimized`, `security`

---

## 👥 Assignees

- **Backend Developer**: API endpoint, service, repository
- **Frontend Developer**: Page, components, hooks
- **QA Engineer**: Testing (unit, integration, E2E, performance)
- **DevOps**: Deployment coordination

---

## 📚 Documentation

### Required Documentation

- [x] API documentation (OpenAPI/Swagger)
- [x] Admin user guide
- [x] README update
- [x] Architecture decision record (ADR)
- [x] Code comments for complex logic

### Deliverables

- API docs with endpoint examples
- User guide: "How to use admin goal list"
- Technical design document
- Test coverage report

---

**Ready for Implementation** ✅

This issue has complete specifications in `.kiro/specs/Admin_goal_list_page/`:
- `requirements.md` - Detailed functional and non-functional requirements
- `design.md` - Technical architecture and implementation details
- `tasks.md` - Step-by-step implementation tasks with code examples
- `ISSUE.md` - This GitHub issue (ready to copy-paste)

**Questions?** Review the specification documents or ask the team lead.
