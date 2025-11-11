# Implementation Tasks: Admin Goals User-Centric View

## Overview

This document breaks down the implementation of the admin goals user-centric view refactoring into concrete, actionable tasks. The refactoring replaces the current goal-centric view (one row per goal) with a user-centric view (one row per user) and implements concurrent data fetching for better performance.

**Goal:** Enable compliance monitoring with user-centric view and achieve p95 load time ≤ 2 seconds

**Approach:**
- Frontend: New route with user-centric table and concurrent fetching
- Reusability: Leverage existing components where possible
- Performance: Parallel requests and client-side aggregation
- Phased rollout: New route alongside existing, gradual migration

**Estimated Total Time:** 16-24 hours (Phases 1-3), +4-6 hours (Phase 4 optional)

---

## Phase 1: Core User-Centric View

### Task 1.1: Create Type Definitions
**Estimated Time:** 30 minutes
**Assignee:** Frontend Developer
**Dependencies:** None
**Priority:** HIGH
**Complexity:** Low

**Description:**
Create TypeScript type definitions for user-centric view.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/feature/evaluation/admin/admin-users-goals/types.ts`
- [ ] `UserGoalSummary` interface defined
- [ ] `StatusFilterOption` type defined
- [ ] Proper imports from `@/api/types`
- [ ] TypeScript compiles without errors

**Implementation Details:**

```typescript
// File: frontend/src/feature/evaluation/admin/admin-users-goals/types.ts

import type { GoalResponse, Department, Stage, UserBasicInfo } from '@/api/types';

/**
 * User goal summary for user-centric view
 */
export interface UserGoalSummary {
  userId: string;
  userName: string;
  userEmail: string;
  department: Department | null;
  stage: Stage | null;
  supervisor: UserBasicInfo | null;
  counts: {
    total: number;
    competency: number;
    team: number;
    individual: number;
  };
  statusCounts: {
    draft: number;
    submitted: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
  lastActivity: Date | null;
  goals: GoalResponse[];
}

/**
 * Status filter options
 */
export type StatusFilterOption =
  | 'all'
  | 'no-goals'
  | 'has-drafts'
  | 'all-submitted'
  | 'all-approved'
  | 'has-rejected';
```

**Verification:**
```bash
cd frontend
npm run type-check
# Expected: No errors
```

**Files to Create:**
- `frontend/src/feature/evaluation/admin/admin-users-goals/types.ts`

---

### Task 1.2: Create useAdminUsersGoalsData Hook
**Estimated Time:** 3-4 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 1.1
**Priority:** HIGH
**Complexity:** High

**Description:**
Create custom hook to load goals with concurrent fetching and aggregate by user.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/feature/evaluation/admin/admin-users-goals/hooks/useAdminUsersGoalsData.ts`
- [ ] Implements concurrent fetching with `Promise.allSettled`
- [ ] Aggregates goals by user (client-side)
- [ ] Calculates goal counts and status counts per user
- [ ] Provides filtering by department, stage, status
- [ ] Provides sorting and pagination
- [ ] Handles loading and error states
- [ ] Handles partial failures gracefully

**Implementation Details:**

**Key Functions:**
1. **Concurrent fetching**:
```typescript
// Fetch first page to get total
const firstPageResult = await getAdminGoalsAction({ page: 1, limit: 100 });
const totalPages = firstPageResult.data.pages ?? 1;

// Fetch remaining pages concurrently
if (totalPages > 1) {
  const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
    getAdminGoalsAction({ page: i + 2, limit: 100 })
  );
  const results = await Promise.allSettled(pagePromises);
  // Handle results...
}
```

2. **User aggregation**:
```typescript
const userSummaries = useMemo(() => {
  // Group goals by userId
  const goalsByUserId = goals.reduce((acc, goal) => {
    if (!acc[goal.userId]) acc[goal.userId] = [];
    acc[goal.userId].push(goal);
    return acc;
  }, {});

  // Create summary for each user
  return users.map(user => ({
    userId: user.id,
    // ... calculate counts, statusCounts, lastActivity
  }));
}, [goals, users]);
```

3. **Filtering logic**:
```typescript
const filteredUserSummaries = useMemo(() => {
  let result = userSummaries;

  // Apply search, department, stage, status filters
  // ...

  return result;
}, [userSummaries, searchQuery, selectedDepartmentId, /* ... */]);
```

**Verification:**
```typescript
// Test concurrent fetching
const { result } = renderHook(() => useAdminUsersGoalsData());
await waitFor(() => expect(result.current.isLoading).toBe(false));
expect(result.current.userSummaries).toHaveLength(100);

// Test aggregation accuracy
const user = result.current.userSummaries[0];
expect(user.counts.total).toBe(6);
expect(user.statusCounts.approved + user.statusCounts.draft).toBe(6);
```

**Files to Create:**
- `frontend/src/feature/evaluation/admin/admin-users-goals/hooks/useAdminUsersGoalsData.ts`

---

### Task 1.3: Create AdminUsersGoalsTable Component
**Estimated Time:** 2-3 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 1.1, 1.2
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Create table component to display user-centric goal summary.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/feature/evaluation/admin/admin-users-goals/components/AdminUsersGoalsTable.tsx`
- [ ] Displays one row per user
- [ ] Shows user name, department, stage, goal counts, status summary, last activity
- [ ] Rows are clickable, navigate to detail page
- [ ] Implements loading skeleton
- [ ] Implements empty state
- [ ] Status summary uses color-coded badges
- [ ] Responsive design (mobile-friendly)

**Implementation Details:**

**Table Columns:**
1. User (name)
2. Department
3. Stage
4. Goal Counts (total, breakdown by category)
5. Status Summary (badges showing status distribution)
6. Last Activity (date)
7. Actions (detail button)

**Status Summary Component:**
```typescript
function StatusSummary({ statusCounts }) {
  return (
    <div className="flex flex-col gap-1">
      {statusCounts.approved > 0 && <Badge variant="success">承認済み: {statusCounts.approved}</Badge>}
      {statusCounts.submitted > 0 && <Badge variant="default">提出済み: {statusCounts.submitted}</Badge>}
      {statusCounts.draft > 0 && <Badge variant="warning">下書き: {statusCounts.draft}</Badge>}
      {statusCounts.rejected > 0 && <Badge variant="destructive">差し戻し: {statusCounts.rejected}</Badge>}
    </div>
  );
}
```

**Verification:**
```typescript
// Test table rendering
render(<AdminUsersGoalsTable userSummaries={mockSummaries} isLoading={false} />);
expect(screen.getAllByRole('row')).toHaveLength(11); // 10 data + 1 header

// Test row click navigation
const row = screen.getAllByRole('row')[1];
fireEvent.click(row);
expect(mockRouter.push).toHaveBeenCalledWith('/admin/users-goals/user-123');
```

**Files to Create:**
- `frontend/src/feature/evaluation/admin/admin-users-goals/components/AdminUsersGoalsTable.tsx`

---

### Task 1.4: Create AdminUsersGoalsFilters Component
**Estimated Time:** 1.5 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 1.1
**Priority:** MEDIUM
**Complexity:** Medium

**Description:**
Create filter controls for user-centric view.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/feature/evaluation/admin/admin-users-goals/components/AdminUsersGoalsFilters.tsx`
- [ ] Search input for user name
- [ ] Department dropdown filter
- [ ] Stage dropdown filter
- [ ] Status filter dropdown (no goals, has drafts, all approved, etc.)
- [ ] Clear filters button
- [ ] Active filters displayed as chips
- [ ] Filters apply immediately on change

**Implementation Details:**

**Filter Controls:**
```typescript
<div className="flex flex-wrap gap-4 items-center">
  {/* Search */}
  <div className="flex-1 min-w-[200px]">
    <Input
      placeholder="ユーザー名で検索..."
      value={searchQuery}
      onChange={e => onSearchChange(e.target.value)}
    />
  </div>

  {/* Department Filter */}
  <Select value={selectedDepartmentId} onValueChange={onDepartmentChange}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="部署" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">すべての部署</SelectItem>
      {departments.map(dept => (
        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Stage Filter */}
  {/* ... similar pattern ... */}

  {/* Status Filter */}
  <Select value={selectedStatusFilter} onValueChange={onStatusFilterChange}>
    <SelectContent>
      <SelectItem value="all">すべてのステータス</SelectItem>
      <SelectItem value="no-goals">目標未設定</SelectItem>
      <SelectItem value="has-drafts">設定中</SelectItem>
      <SelectItem value="all-submitted">提出済み</SelectItem>
      <SelectItem value="all-approved">承認済み</SelectItem>
      <SelectItem value="has-rejected">差し戻しあり</SelectItem>
    </SelectContent>
  </Select>

  {/* Clear Filters */}
  <Button variant="outline" onClick={onClearFilters}>
    フィルタークリア
  </Button>
</div>
```

**Active Filters Chips:**
```typescript
{activeFilters.length > 0 && (
  <div className="flex gap-2 flex-wrap mt-2">
    {activeFilters.map(filter => (
      <Badge key={filter.key} variant="secondary">
        {filter.label}: {filter.value}
        <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => removeFilter(filter.key)} />
      </Badge>
    ))}
  </div>
)}
```

**Files to Create:**
- `frontend/src/feature/evaluation/admin/admin-users-goals/components/AdminUsersGoalsFilters.tsx`

---

### Task 1.5: Create AdminUsersGoalsPage Component
**Estimated Time:** 2 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 1.2, 1.3, 1.4
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Create main page component that orchestrates all child components.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/feature/evaluation/admin/admin-users-goals/display/AdminUsersGoalsPage.tsx`
- [ ] Integrates useAdminUsersGoalsData hook
- [ ] Renders EvaluationPeriodSelector (reuse)
- [ ] Renders AdminUsersGoalsFilters
- [ ] Renders AdminUsersGoalsTable
- [ ] Handles loading state
- [ ] Handles error state with retry button
- [ ] Implements pagination controls
- [ ] Shows summary stats (e.g., "100名中")

**Layout Structure:**
```
┌─────────────────────────────────────────────┐
│ Header + Period Selector                    │
├─────────────────────────────────────────────┤
│ Filters (search, dept, stage, status)       │
├─────────────────────────────────────────────┤
│ Error Banner (if any)                       │
├─────────────────────────────────────────────┤
│ User Table                                   │
│   - User 1                                   │
│   - User 2                                   │
│   - ...                                      │
├─────────────────────────────────────────────┤
│ Pagination Controls                          │
└─────────────────────────────────────────────┘
```

**Error Handling:**
```typescript
{error && (
  <div className="bg-warning/10 border border-warning rounded-lg p-4">
    <p className="text-sm text-warning">{error}</p>
    <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
      再読み込み
    </Button>
  </div>
)}
```

**Files to Create:**
- `frontend/src/feature/evaluation/admin/admin-users-goals/display/AdminUsersGoalsPage.tsx`

---

### Task 1.6: Create Route and Page
**Estimated Time:** 30 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 1.5
**Priority:** HIGH
**Complexity:** Low

**Description:**
Create Next.js page and route for user-centric view.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/app/(evaluation)/(admin)/admin-users-goals/page.tsx`
- [ ] Imports and exports AdminUsersGoalsPage
- [ ] Applies appropriate layout (admin layout)
- [ ] Protected by admin role check
- [ ] Accessible at `/admin/users-goals`

**Implementation Details:**

```typescript
// File: frontend/src/app/(evaluation)/(admin)/admin-users-goals/page.tsx

import AdminUsersGoalsPage from '@/feature/evaluation/admin/admin-users-goals/display/AdminUsersGoalsPage';

export const metadata = {
  title: 'ユーザー別目標一覧 | 管理者',
  description: '全ユーザーの目標設定状況を確認',
};

export default function Page() {
  return <AdminUsersGoalsPage />;
}
```

**Verification:**
```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/admin/users-goals
# Expected: Page loads and displays user list
```

**Files to Create:**
- `frontend/src/app/(evaluation)/(admin)/admin-users-goals/page.tsx`

---

## Phase 2: User Detail View

### Task 2.1: Create AdminUserGoalsDetailPage Component
**Estimated Time:** 2-3 hours
**Assignee:** Frontend Developer
**Dependencies:** Phase 1 complete
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Create detail page showing all goals for a specific user.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/feature/evaluation/admin/admin-users-goals/display/AdminUserGoalsDetailPage.tsx`
- [ ] Accepts userId as parameter
- [ ] Displays EmployeeInfoCard with user details (reuse)
- [ ] Shows goal summary stats (total, by category, by status)
- [ ] Renders AdminGoalListTable filtered to user's goals (reuse)
- [ ] Includes back button to return to user list
- [ ] Handles loading and error states

**Layout Structure:**
```
┌─────────────────────────────────────────────┐
│ Back Button | User Name                     │
├─────────────────────────────────────────────┤
│ Employee Info Card                           │
├─────────────────────────────────────────────┤
│ Goal Summary Stats                           │
│   合計: 6 | コンピテンシー: 5 | ...          │
├─────────────────────────────────────────────┤
│ Goal List Table (existing component)        │
│   - Goal 1                                   │
│   - Goal 2                                   │
│   - ...                                      │
└─────────────────────────────────────────────┘
```

**Component Reuse:**
```typescript
// Reuse existing components
<EmployeeInfoCard employee={selectedUser} />

<AdminGoalListTable
  goals={userGoals} // Filter to user's goals only
  userMap={userMap}
  isLoading={isLoading}
/>
```

**Goal Summary Stats:**
```typescript
<div className="grid grid-cols-4 gap-4">
  <Card>
    <CardHeader>
      <CardTitle>合計</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold">{summary.counts.total}</p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>コンピテンシー</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold">{summary.counts.competency}</p>
    </CardContent>
  </Card>

  {/* ... team, individual cards ... */}
</div>
```

**Files to Create:**
- `frontend/src/feature/evaluation/admin/admin-users-goals/display/AdminUserGoalsDetailPage.tsx`

---

### Task 2.2: Create Detail Page Route
**Estimated Time:** 30 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 2.1
**Priority:** HIGH
**Complexity:** Low

**Description:**
Create Next.js dynamic route for user detail page.

**Acceptance Criteria:**
- [ ] File created: `frontend/src/app/(evaluation)/(admin)/admin-users-goals/[userId]/page.tsx`
- [ ] Accepts userId as route parameter
- [ ] Passes userId and periodId to detail page component
- [ ] Protected by admin role check
- [ ] Accessible at `/admin/users-goals/{userId}`

**Implementation Details:**

```typescript
// File: frontend/src/app/(evaluation)/(admin)/admin-users-goals/[userId]/page.tsx

import AdminUserGoalsDetailPage from '@/feature/evaluation/admin/admin-users-goals/display/AdminUserGoalsDetailPage';

export const metadata = {
  title: 'ユーザー目標詳細 | 管理者',
};

interface PageProps {
  params: {
    userId: string;
  };
  searchParams: {
    periodId?: string;
  };
}

export default function Page({ params, searchParams }: PageProps) {
  return (
    <AdminUserGoalsDetailPage
      userId={params.userId}
      periodId={searchParams.periodId}
    />
  );
}
```

**Verification:**
```bash
# Navigate to http://localhost:3000/admin/users-goals/user-123
# Expected: Detail page loads with user's goals
```

**Files to Create:**
- `frontend/src/app/(evaluation)/(admin)/admin-users-goals/[userId]/page.tsx`

---

## Phase 3: Testing and Polish

### Task 3.1: Performance Testing
**Estimated Time:** 2 hours
**Assignee:** Frontend Developer / QA
**Dependencies:** Phase 1, 2 complete
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Test and verify performance improvements.

**Acceptance Criteria:**
- [ ] Load time tested with 600 goals (100 users × 6 goals)
- [ ] p95 load time ≤ 2 seconds achieved
- [ ] Concurrent fetching verified (all pages load in parallel)
- [ ] Client-side filtering < 100ms verified
- [ ] Memory usage acceptable (< 100MB)
- [ ] No increase in server error rate

**Test Scenarios:**

**Test 1: Sequential vs Concurrent Load Time**
```typescript
// Measure current sequential approach
const sequentialStart = Date.now();
// ... sequential loading code
const sequentialEnd = Date.now();
console.log(`Sequential: ${sequentialEnd - sequentialStart}ms`);

// Measure new concurrent approach
const concurrentStart = Date.now();
// ... concurrent loading code
const concurrentEnd = Date.now();
console.log(`Concurrent: ${concurrentEnd - concurrentStart}ms`);

// Verify improvement
expect(concurrentEnd - concurrentStart).toBeLessThan((sequentialEnd - sequentialStart) * 0.5);
```

**Test 2: Client-Side Aggregation Performance**
```typescript
const users = generateMockUsers(100);
const goals = generateMockGoals(600);

const start = Date.now();
const aggregated = aggregateGoalsByUser(goals, users);
const end = Date.now();

console.log(`Aggregation time: ${end - start}ms`);
expect(end - start).toBeLessThan(100);
```

**Test 3: Filtering Performance**
```typescript
const summaries = generateUserSummaries(100);

const start = Date.now();
const filtered = summaries.filter(/* filter logic */);
const end = Date.now();

console.log(`Filtering time: ${end - start}ms`);
expect(end - start).toBeLessThan(50);
```

**Performance Report Template:**
```markdown
# Performance Test Results

## Test Environment
- Browser: Chrome 120
- Device: MacBook Pro 16GB RAM
- Network: Fast 3G simulation
- Dataset: 100 users, 600 goals

## Results
| Metric | Sequential (old) | Concurrent (new) | Improvement |
|--------|------------------|------------------|-------------|
| Load Time (p50) | 3500ms | 800ms | 77% faster |
| Load Time (p95) | 6000ms | 1500ms | 75% faster |
| Aggregation | N/A | 45ms | - |
| Filtering | N/A | 12ms | - |
| Memory Usage | 85MB | 92MB | +8% |

## Conclusion
✅ All performance targets met
✅ p95 load time < 2s achieved
✅ 75%+ improvement in load times
```

---

### Task 3.2: Functional Testing
**Estimated Time:** 2 hours
**Assignee:** Frontend Developer / QA
**Dependencies:** Phase 1, 2 complete
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Test all functionality to ensure correctness.

**Acceptance Criteria:**
- [ ] User list displays correctly (one row per user)
- [ ] Goal counts are accurate for each user
- [ ] Status summaries are correct
- [ ] Filtering works (department, stage, status)
- [ ] Sorting works (name, last activity)
- [ ] Pagination works correctly
- [ ] Navigation to detail page works
- [ ] Detail page shows all user's goals
- [ ] Back button returns to list

**Test Cases:**

**Test 1: User List Display**
```gherkin
GIVEN organization has 10 users with goals
WHEN I navigate to /admin/users-goals
THEN I see 10 rows (one per user)
AND each row shows correct user info and goal counts
```

**Test 2: Goal Count Accuracy**
```gherkin
GIVEN user "山田太郎" has 6 goals (5 competency, 1 team)
WHEN I view the user list
THEN 山田太郎's row shows "合計: 6 (コンピテンシー: 5, チーム: 1)"
```

**Test 3: Status Summary Accuracy**
```gherkin
GIVEN user has 4 approved goals, 2 draft goals
WHEN I view the user list
THEN status shows badges: "承認済み: 4" and "下書き: 2"
AND status indicator is yellow (has drafts)
```

**Test 4: Department Filtering**
```gherkin
GIVEN I am on user list page
WHEN I select department filter "営業部"
THEN only users in 営業部 are displayed
AND goal counts remain accurate
```

**Test 5: Detail Page Navigation**
```gherkin
GIVEN I am on user list page
WHEN I click on user row for "山田太郎"
THEN I navigate to /admin/users-goals/{userId}
AND I see all 6 goals for 山田太郎
AND I see EmployeeInfoCard with user details
AND I see back button to return to list
```

**Test Checklist:**
```markdown
## Functional Test Checklist

### User List View
- [ ] Table displays correctly
- [ ] One row per user
- [ ] Goal counts accurate
- [ ] Status summaries accurate
- [ ] Last activity dates correct
- [ ] Users with no goals show "0"

### Filtering
- [ ] Search by name works
- [ ] Department filter works
- [ ] Stage filter works
- [ ] Status filter works
- [ ] Multiple filters work together (AND logic)
- [ ] Clear filters button works

### Sorting
- [ ] Sort by name works (A-Z, Z-A)
- [ ] Sort by last activity works (newest/oldest)

### Pagination
- [ ] Page numbers display correctly
- [ ] Next/Previous buttons work
- [ ] Page count is accurate
- [ ] Clicking page number navigates correctly

### Detail Page
- [ ] Navigation from list works
- [ ] User info displays correctly
- [ ] Goal summary stats accurate
- [ ] Goal table shows all user's goals
- [ ] Back button returns to list
- [ ] Period context maintained
```

---

### Task 3.3: Error Handling Testing
**Estimated Time:** 1 hour
**Assignee:** Frontend Developer / QA
**Dependencies:** Phase 1 complete
**Priority:** MEDIUM
**Complexity:** Low

**Description:**
Test error scenarios and partial failure handling.

**Acceptance Criteria:**
- [ ] Partial page load failures handled gracefully
- [ ] Error messages displayed clearly
- [ ] Retry button works
- [ ] Partial data displayed when some pages fail
- [ ] Network timeout handled properly
- [ ] Empty state displays correctly

**Test Scenarios:**

**Test 1: Partial Page Failure**
```gherkin
GIVEN data requires 6 pages to fetch
AND page 3 fails due to network error
WHEN loading completes
THEN pages 1,2,4,5,6 data is displayed
AND error banner shows "一部のデータの読み込みに失敗しました"
AND retry button is available
```

**Test 2: All Pages Fail**
```gherkin
GIVEN all API requests fail
WHEN page loads
THEN error message is displayed
AND retry button is shown
AND no partial data is displayed
```

**Test 3: Empty State**
```gherkin
GIVEN no users have goals in selected period
WHEN page loads
THEN empty state message is displayed
AND message says "この期間の目標はまだ設定されていません"
```

**Test 4: Network Timeout**
```gherkin
GIVEN API requests timeout after 30 seconds
WHEN page is loading
THEN timeout error message is displayed
AND user can retry loading
```

---

### Task 3.4: Responsive Design Testing
**Estimated Time:** 1 hour
**Assignee:** Frontend Developer / QA
**Dependencies:** Phase 1 complete
**Priority:** MEDIUM
**Complexity:** Low

**Description:**
Test responsive design on various screen sizes.

**Acceptance Criteria:**
- [ ] Desktop (≥1024px): Full table with all columns
- [ ] Tablet (768-1023px): Condensed table, some columns hidden
- [ ] Mobile (<768px): Card view instead of table
- [ ] All functionality accessible on all devices
- [ ] No horizontal scrolling on mobile

**Test Devices:**
- Desktop: 1920×1080, 1440×900
- Tablet: iPad (1024×768), iPad Pro (1366×1024)
- Mobile: iPhone 12 (390×844), iPhone SE (375×667)

**Responsive Behavior:**
```
Desktop (≥1024px):
- Full table with all 7 columns
- Horizontal layout for filters

Tablet (768-1023px):
- Hide "Last Activity" column
- Condense goal counts column
- Stack filters vertically

Mobile (<768px):
- Switch to card view
- Each user = one card
- Swipe/scroll for navigation
- Tap card to view details
```

**Verification Checklist:**
- [ ] Desktop view looks good
- [ ] Tablet view readable
- [ ] Mobile card view functional
- [ ] Filters usable on all devices
- [ ] Navigation works on touch devices
- [ ] No layout breaks or overlaps

---

### Task 3.5: UX Polish
**Estimated Time:** 1.5 hours
**Assignee:** Frontend Developer
**Dependencies:** Phase 1, 2 complete
**Priority:** LOW
**Complexity:** Low

**Description:**
Polish user experience with small improvements.

**Acceptance Criteria:**
- [ ] Loading skeleton looks good
- [ ] Smooth transitions between states
- [ ] Hover effects on interactive elements
- [ ] Clear visual hierarchy
- [ ] Consistent spacing and alignment
- [ ] Tooltips for unclear elements
- [ ] Keyboard navigation support

**Improvements:**

**1. Loading Skeleton:**
```typescript
function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        {/* ... header ... */}
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            {/* ... more skeleton cells ... */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**2. Loading Progress Indicator:**
```typescript
{isLoading && pageLoadProgress && (
  <div className="text-sm text-muted-foreground">
    ページ {pageLoadProgress.loaded} / {pageLoadProgress.total} を読み込み中...
  </div>
)}
```

**3. Empty State with Icon:**
```typescript
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Users className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">目標が設定されていません</h3>
      <p className="text-sm text-muted-foreground mb-4">
        この期間の目標はまだ設定されていません。
      </p>
    </div>
  );
}
```

**4. Hover Effects:**
```css
/* Table row hover */
.table-row {
  @apply cursor-pointer transition-colors;
}
.table-row:hover {
  @apply bg-muted/50;
}

/* Button hover */
.detail-button:hover {
  @apply bg-accent;
}
```

**5. Tooltips:**
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      <Badge>合計: 6</Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>コンピテンシー: 5</p>
      <p>チーム: 1</p>
      <p>個人: 0</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Phase 4: Backend Optimization (Optional)

### Task 4.1: Design Aggregate Endpoint
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Phase 3 complete, decision to implement backend
**Priority:** LOW
**Complexity:** Medium

**Description:**
Design backend endpoint for server-side goal aggregation.

**Acceptance Criteria:**
- [ ] API spec documented
- [ ] Response schema defined
- [ ] SQL query optimized
- [ ] Performance benefits estimated
- [ ] Migration plan defined

**API Specification:**

```yaml
GET /api/admin/goals/by-user

Query Parameters:
  - period_id: UUID (required)
  - department_id: UUID (optional)
  - stage_id: UUID (optional)

Response:
  - items: List[UserGoalSummaryResponse]
    - user_id: UUID
    - user_name: str
    - department: Department
    - stage: Stage
    - counts: GoalCountsSchema
    - status_counts: StatusCountsSchema
    - last_activity: datetime
  - total: int
```

**SQL Query (Optimized):**
```sql
SELECT
    u.id AS user_id,
    u.name AS user_name,
    u.email AS user_email,
    d.id AS department_id,
    d.name AS department_name,
    s.id AS stage_id,
    s.name AS stage_name,
    COUNT(g.id) AS total_goals,
    COUNT(CASE WHEN g.goal_category = 'competency' THEN 1 END) AS competency_goals,
    COUNT(CASE WHEN g.goal_category = 'team' THEN 1 END) AS team_goals,
    COUNT(CASE WHEN g.goal_category = 'individual' THEN 1 END) AS individual_goals,
    COUNT(CASE WHEN g.status = 'draft' THEN 1 END) AS draft_count,
    COUNT(CASE WHEN g.status = 'submitted' THEN 1 END) AS submitted_count,
    COUNT(CASE WHEN g.status = 'approved' THEN 1 END) AS approved_count,
    COUNT(CASE WHEN g.status = 'rejected' THEN 1 END) AS rejected_count,
    MAX(g.updated_at) AS last_activity
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN stages s ON u.stage_id = s.id
LEFT JOIN goals g ON u.id = g.user_id AND g.period_id = :period_id
WHERE u.organization_id = :org_id
GROUP BY u.id, u.name, u.email, d.id, d.name, s.id, s.name
ORDER BY last_activity DESC NULLS LAST;
```

**Performance Estimate:**
- Current (client-side): ~800ms (concurrent fetch) + 45ms (aggregation) = 845ms
- With backend: ~200ms (single optimized query)
- **Improvement**: 76% faster

---

### Task 4.2: Implement Aggregate Endpoint (Optional)
**Estimated Time:** 3-4 hours
**Assignee:** Backend Developer
**Dependencies:** Task 4.1
**Priority:** LOW
**Complexity:** High

**Description:**
Implement backend endpoint for goal aggregation.

**Implementation Steps:**
1. Create Pydantic schemas for response
2. Implement repository method with SQL query
3. Create service method for business logic
4. Create API endpoint with authorization
5. Add tests for endpoint
6. Update API documentation

**Files to Create/Modify:**
- `backend/app/schemas/goal.py` - Add UserGoalSummaryResponse
- `backend/app/database/repositories/goal_repository.py` - Add aggregate method
- `backend/app/services/goal_service.py` - Add aggregate service
- `backend/app/api/v1/goals.py` - Add endpoint
- `backend/tests/api/test_goals.py` - Add tests

---

### Task 4.3: Update Frontend to Use Aggregate Endpoint (Optional)
**Estimated Time:** 1-2 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 4.2
**Priority:** LOW
**Complexity:** Low

**Description:**
Update frontend to use new aggregate endpoint.

**Changes:**
1. Create server action for aggregate endpoint
2. Update useAdminUsersGoalsData to use aggregate endpoint
3. Keep concurrent fetch as fallback
4. Measure performance improvement

**Implementation:**
```typescript
// Try aggregate endpoint first, fallback to concurrent fetch
try {
  const aggregateResult = await getAdminGoalsByUserAction({ periodId });
  if (aggregateResult.success) {
    // Use aggregated data
    setUserSummaries(aggregateResult.data.items);
    return;
  }
} catch (err) {
  console.warn('Aggregate endpoint failed, falling back to concurrent fetch');
}

// Fallback: concurrent fetch + client-side aggregation
// ... existing code ...
```

---

## Phase 5: Documentation and Deployment

### Task 5.1: Update Documentation
**Estimated Time:** 1 hour
**Assignee:** Any Developer
**Dependencies:** All implementation complete
**Priority:** MEDIUM
**Complexity:** Low

**Description:**
Update project documentation for new feature.

**Acceptance Criteria:**
- [ ] README updated with new route
- [ ] Navigation documentation updated
- [ ] Performance improvements documented
- [ ] User guide updated (if exists)
- [ ] Developer guide updated

**Documentation Updates:**

**README.md**:
```markdown
## Admin Pages

### Users Goals List
- **Route**: `/admin/users-goals`
- **Description**: User-centric view of all goals in organization
- **Features**:
  - One row per user for easy compliance tracking
  - Concurrent data fetching for fast load times
  - Filterable by department, stage, and status
  - Click user to view detailed goals
- **Performance**: p95 load time < 2 seconds for 5k-10k goals
```

**CHANGELOG.md**:
```markdown
## [1.x.0] - 2024-XX-XX

### Added
- User-centric admin goals view at `/admin/users-goals`
- Concurrent data fetching for improved performance
- User goal aggregation and summary stats
- Filtering by department, stage, and goal status

### Improved
- Admin goals page load time reduced by 75% (5-10s → 0.8-2s)
- Better compliance tracking with one-row-per-user view

### Changed
- Admin goals default view changed to user-centric (old view still available at `/admin/goal-list`)
```

---

### Task 5.2: Deploy to Staging
**Estimated Time:** 1 hour
**Assignee:** DevOps / Frontend Lead
**Dependencies:** All tasks complete, testing passed
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Deploy to staging environment and perform smoke tests.

**Acceptance Criteria:**
- [ ] Code deployed to staging
- [ ] New route accessible
- [ ] Smoke tests passed
- [ ] Performance verified in staging
- [ ] No errors in logs

**Deployment Steps:**

```bash
# 1. Merge to staging branch
git checkout staging
git merge feat/admin-goals-user-centric

# 2. Deploy to staging
# (deployment process varies by infrastructure)

# 3. Smoke tests
curl https://staging.example.com/admin/users-goals
# Expected: 200 OK

# 4. Performance test
# Use browser DevTools Network tab
# Expected: Load time < 2s

# 5. Check logs
# Expected: No errors related to new feature
```

---

### Task 5.3: Deploy to Production
**Estimated Time:** 1 hour
**Assignee:** DevOps / Frontend Lead
**Dependencies:** Task 5.2 passed
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Deploy to production with monitoring.

**Acceptance Criteria:**
- [ ] Deployment plan approved
- [ ] Feature flag configured (if using)
- [ ] Code deployed to production
- [ ] Smoke tests passed
- [ ] Performance metrics monitored
- [ ] User feedback collected

**Deployment Plan:**

**Option A: Feature Flag Rollout**
1. Deploy with feature flag OFF
2. Enable for internal users (beta test)
3. Enable for 10% of admins
4. Enable for 50% of admins
5. Enable for 100% of admins
6. Remove flag and old code

**Option B: Direct Rollout**
1. Deploy new route
2. Update navigation to point to new route
3. Monitor for issues
4. Keep old route as fallback for 1 week
5. Deprecate old route

**Monitoring:**
```bash
# Monitor error rates
# Expected: No increase in error rate

# Monitor page load times
# Expected: p95 < 2s

# Monitor user feedback
# Expected: Positive feedback, no major complaints
```

---

## Task Summary

### By Priority

**HIGH Priority** (Must complete):
- Task 1.1: Create type definitions (30min)
- Task 1.2: Create useAdminUsersGoalsData hook (3-4h)
- Task 1.3: Create AdminUsersGoalsTable (2-3h)
- Task 1.4: Create AdminUsersGoalsFilters (1.5h)
- Task 1.5: Create AdminUsersGoalsPage (2h)
- Task 1.6: Create route and page (30min)
- Task 2.1: Create detail page (2-3h)
- Task 2.2: Create detail route (30min)
- Task 3.1: Performance testing (2h)
- Task 3.2: Functional testing (2h)
- Task 5.2: Deploy to staging (1h)
- Task 5.3: Deploy to production (1h)

**MEDIUM Priority** (Should complete):
- Task 3.3: Error handling testing (1h)
- Task 3.4: Responsive design testing (1h)
- Task 5.1: Update documentation (1h)

**LOW Priority** (Nice to have):
- Task 3.5: UX polish (1.5h)
- Task 4.1: Design aggregate endpoint (1h)
- Task 4.2: Implement aggregate endpoint (3-4h)
- Task 4.3: Update frontend for aggregate (1-2h)

---

### By Phase

| Phase | Time | Tasks |
|-------|------|-------|
| Phase 1: Core View | 8-10h | 1.1-1.6 |
| Phase 2: Detail View | 2.5-3.5h | 2.1-2.2 |
| Phase 3: Testing | 5.5-7.5h | 3.1-3.5 |
| Phase 4: Backend (Optional) | 5-7h | 4.1-4.3 |
| Phase 5: Deployment | 3h | 5.1-5.3 |
| **Total (Phases 1-3)** | **16-21h** | |
| **Total (All Phases)** | **24-31h** | |

---

### By Developer

**Frontend Developer:**
- Tasks 1.1-1.6, 2.1-2.2, 3.1-3.5, 4.3
- Estimated: 18-24 hours

**Backend Developer (Optional):**
- Tasks 4.1-4.2
- Estimated: 4-5 hours

**QA:**
- Tasks 3.1-3.4
- Estimated: 6-7 hours (can overlap with frontend dev)

**DevOps:**
- Tasks 5.2-5.3
- Estimated: 2 hours

**Total Team Effort:** ~24-31 hours

---

## Dependencies Graph

```
1.1 (Types)
  ↓
1.2 (Hook) → 1.3 (Table) → 1.5 (Page) → 1.6 (Route)
  ↓             ↓
  └─────→ 1.4 (Filters) ──┘
              ↓
         2.1 (Detail) → 2.2 (Detail Route)
              ↓
         3.1 (Perf Test)
         3.2 (Func Test)
         3.3 (Error Test)
         3.4 (Responsive)
         3.5 (Polish)
              ↓
         5.1 (Docs) → 5.2 (Staging) → 5.3 (Production)
              ↓
         4.1 (Design) → 4.2 (Backend) → 4.3 (Frontend Update)
```

---

## Risk Mitigation

| Risk | Mitigation | Responsible |
|------|------------|-------------|
| Concurrent requests overload server | Limit to 5-10 concurrent, implement throttling | Frontend Dev |
| Client-side aggregation slow | Use useMemo, test with large datasets, add backend if needed | Frontend Dev |
| Users confused by new UI | Provide onboarding, keep old view accessible | Frontend Dev |
| Partial data loading issues | Use Promise.allSettled, show partial data, clear error messages | Frontend Dev |
| Performance targets not met | Profile and optimize, consider backend endpoint | Frontend Dev |

---

## Definition of Done

A task is considered "done" when:
- [ ] Code is written and reviewed
- [ ] Tests pass (unit, integration, or manual)
- [ ] Documentation updated
- [ ] Code merged to development branch
- [ ] Deployed to staging successfully
- [ ] Staging tests passed
- [ ] Deployed to production successfully
- [ ] Production smoke tests passed
- [ ] No critical bugs reported within 24 hours

Feature is considered "complete" when:
- [ ] All HIGH priority tasks completed
- [ ] Performance targets met (p95 ≤ 2s)
- [ ] User-centric view displays correctly
- [ ] Concurrent fetching works
- [ ] Filtering and navigation work
- [ ] Detail page works
- [ ] Responsive design works
- [ ] Documentation updated
- [ ] Deployed to production
- [ ] User feedback positive

---

## References

- GitHub Issue: [#337](https://github.com/shintairiku/evaluation-system/issues/337)
- ISSUE.md: `.kiro/specs/admin-goals-user-centric/ISSUE.md`
- Requirements: `.kiro/specs/admin-goals-user-centric/requirements.md`
- Design: `.kiro/specs/admin-goals-user-centric/design.md`
- Current Implementation: `frontend/src/feature/evaluation/admin/admin-goal-list/`
