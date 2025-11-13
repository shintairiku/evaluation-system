# Design Document: Admin Goals User-Centric View

## 1. Executive Summary

This document outlines the technical design for refactoring the admin goals list page from a goal-centric view to a user-centric view with significant performance improvements. The design focuses on concurrent data fetching, client-side aggregation, and improved UX for compliance monitoring.

**Key Design Principles:**
- **User-First**: One row per user instead of one row per goal
- **Performance**: Concurrent fetching reduces load time by 50-70%
- **Reusability**: Leverage existing components where possible
- **Scalability**: Support 5k-10k goals efficiently
- **Progressive Enhancement**: Start with client-side aggregation, add backend later if needed

**Technical Approach:**
- **Frontend**: New route `/admin/users-goals` with React components
- **Data Fetching**: Concurrent Promise.allSettled pattern
- **Aggregation**: Client-side grouping and counting
- **Navigation**: Link to user detail page
- **Backend**: Optional aggregate endpoint (Phase 4)

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**Current Route**: `/admin/goal-list`

**Current Flow**:
```
User navigates to /admin/goal-list
↓
useAdminGoalListData hook loads data
↓
Sequential pagination (page 1 → page 2 → page 3)
↓
Client-side filtering on goal-level data
↓
Display table with one row per goal
```

**Current Files**:
```
frontend/src/
├── app/(evaluation)/(admin)/
│   └── admin-goal-list/
│       └── page.tsx
└── feature/evaluation/admin/admin-goal-list/
    ├── display/
    │   └── index.tsx
    ├── components/
    │   ├── AdminGoalListTable.tsx
    │   └── AdminGoalListFilters.tsx
    └── hooks/
        └── useAdminGoalListData.ts
```

**Current Issues**:

**Performance Problems**:
```typescript
// Sequential fetching (SLOW)
const firstPageResult = await getAdminGoalsAction({ page: 1 });
for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
  const pageResult = await getAdminGoalsAction({ page: nextPage }); // Waits for each page!
}
```

**Usability Problems**:
- Multiple rows per user (6 goals = 6 rows)
- No aggregated view of user status
- Difficult to identify compliance issues
- Poor scanning/auditing experience

---

### 2.2 Performance Analysis

**Current Performance** (100 users, 600 goals):
```
Sequential Loading Timeline:
Page 1 (100 goals): Request → 500ms → Process → 200ms
Page 2 (100 goals): Request → 500ms → Process → 200ms
Page 3 (100 goals): Request → 500ms → Process → 200ms
Page 4 (100 goals): Request → 500ms → Process → 200ms
Page 5 (100 goals): Request → 500ms → Process → 200ms
Page 6 (100 goals): Request → 500ms → Process → 200ms
─────────────────────────────────────────────────────
Total: ~4200ms (4.2 seconds)
```

**Proposed Performance** (concurrent):
```
Concurrent Loading Timeline:
All pages (1-6): Concurrent requests → 500ms max → Process all → 300ms
─────────────────────────────────────────────────────
Total: ~800ms (0.8 seconds)
```

**Performance Improvement**: 5.25x faster (4.2s → 0.8s)

---

## 3. Proposed Solution Architecture

### 3.1 Solution Overview

**New Route Structure**:
```
/admin/users-goals                    → User list view (new)
/admin/users-goals/{userId}           → User detail view (new)
/admin/goal-list                      → Keep existing for backward compatibility
```

**Component Hierarchy**:
```
AdminUsersGoalsPage
├── EvaluationPeriodSelector (reuse)
├── AdminUsersGoalsFilters (new)
├── AdminUsersGoalsTable (new)
│   ├── AdminUserRow (new)
│   │   ├── UserAvatar
│   │   ├── GoalCountBadge
│   │   └── StatusSummary
│   └── ...more rows
└── Pagination (reuse)

AdminUserGoalsDetailPage
├── EmployeeInfoCard (reuse)
├── GoalSummaryStats (new)
└── AdminGoalListTable (reuse with userId filter)
```

---

### 3.2 Data Flow Design

#### 3.2.1 User List View Data Flow

```
User navigates to /admin/users-goals
↓
useAdminUsersGoalsData hook initializes
↓
[PARALLEL REQUESTS]
├── Fetch evaluation periods
├── Fetch users (all in org)
└── Fetch departments
↓
Determine target period (selected or current)
↓
[CONCURRENT GOAL FETCHING]
First request → Get total pages count
↓
Create promises for all pages [page 1, page 2, ..., page N]
↓
await Promise.allSettled(promises) → All pages load in parallel
↓
[CLIENT-SIDE AGGREGATION]
Group goals by userId
↓
Calculate counts per user
├── Total goals
├── Goals by category (competency, team, individual)
└── Goals by status (draft, submitted, approved, rejected)
↓
Calculate last activity per user
↓
Merge user data with goal aggregations
↓
Apply client-side filters
↓
Apply sorting
↓
Apply pagination
↓
Render AdminUsersGoalsTable
```

---

#### 3.2.2 Concurrent Fetching Pattern

**Implementation**:
```typescript
// Step 1: Fetch first page to get total pages
const firstPageResult = await getAdminGoalsAction({
  periodId: targetPeriodId,
  page: 1,
  limit: 100,
  includeReviews: true,
});

const totalPages = firstPageResult.data.pages ?? 1;
const allGoals = [...firstPageResult.data.items];

// Step 2: Fetch remaining pages concurrently
if (totalPages > 1) {
  const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
    getAdminGoalsAction({
      periodId: targetPeriodId,
      page: i + 2, // Start from page 2
      limit: 100,
      includeReviews: true,
    })
  );

  // Concurrent fetching with error handling
  const results = await Promise.allSettled(pagePromises);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      allGoals.push(...result.value.data.items);
    } else {
      console.error(`Failed to load page ${index + 2}:`, result.reason);
      // Still show partial data, display error banner
    }
  });
}

// Step 3: All data loaded, proceed with aggregation
```

**Error Handling**:
- Use `Promise.allSettled` to handle partial failures
- Show loaded data even if some pages fail
- Display error banner with retry button
- Log failed page numbers for debugging

---

#### 3.2.3 Client-Side Aggregation Algorithm

```typescript
/**
 * Aggregate goals by user
 */
function aggregateGoalsByUser(
  goals: GoalResponse[],
  users: UserDetailResponse[]
): UserGoalSummary[] {
  // Step 1: Group goals by userId
  const goalsByUserId = goals.reduce((acc, goal) => {
    if (!acc[goal.userId]) {
      acc[goal.userId] = [];
    }
    acc[goal.userId].push(goal);
    return acc;
  }, {} as Record<string, GoalResponse[]>);

  // Step 2: Create user summary for each user
  return users.map(user => {
    const userGoals = goalsByUserId[user.id] || [];

    // Calculate counts
    const counts = {
      total: userGoals.length,
      competency: userGoals.filter(g => g.goalCategory === 'competency').length,
      team: userGoals.filter(g => g.goalCategory === 'team').length,
      individual: userGoals.filter(g => g.goalCategory === 'individual').length,
    };

    // Calculate status counts
    const statusCounts = {
      draft: userGoals.filter(g => g.status === 'draft').length,
      submitted: userGoals.filter(g => g.status === 'submitted').length,
      inReview: userGoals.filter(g => g.status === 'in_review').length,
      approved: userGoals.filter(g => g.status === 'approved').length,
      rejected: userGoals.filter(g => g.status === 'rejected').length,
    };

    // Calculate last activity
    const lastActivity = userGoals.length > 0
      ? Math.max(...userGoals.map(g => new Date(g.updatedAt).getTime()))
      : null;

    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      department: user.department,
      stage: user.stage,
      supervisor: user.supervisor,
      counts,
      statusCounts,
      lastActivity: lastActivity ? new Date(lastActivity) : null,
      goals: userGoals,
    };
  });
}
```

**Performance Optimization**:
- Use `useMemo` to cache aggregation results
- Only recalculate when goals or users change
- Filter and sort on pre-aggregated data

---

### 3.3 Component Design

#### 3.3.1 AdminUsersGoalsPage Component

**File**: `frontend/src/feature/evaluation/admin/admin-users-goals/display/AdminUsersGoalsPage.tsx`

```typescript
'use client';

import { useState } from 'react';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { AdminUsersGoalsFilters } from '../components/AdminUsersGoalsFilters';
import { AdminUsersGoalsTable } from '../components/AdminUsersGoalsTable';
import { useAdminUsersGoalsData } from '../hooks/useAdminUsersGoalsData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminUsersGoalsPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const {
    userSummaries,
    filteredUserSummaries,
    paginatedUserSummaries,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedDepartmentId,
    setSelectedDepartmentId,
    selectedStageId,
    setSelectedStageId,
    selectedStatusFilter,
    setSelectedStatusFilter,
    currentPeriod,
    allPeriods,
    departments,
    stages,
    currentPage,
    totalPages,
    setCurrentPage,
    refetch,
  } = useAdminUsersGoalsData({ selectedPeriodId: selectedPeriodId || undefined });

  const handlePeriodChange = (periodId: string) => {
    setSelectedPeriodId(periodId);
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ユーザー別目標一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            全ユーザーの目標設定状況 ({filteredUserSummaries.length}名)
          </p>
        </div>

        {/* Period Selector */}
        {allPeriods.length > 0 && (
          <EvaluationPeriodSelector
            periods={allPeriods}
            selectedPeriodId={selectedPeriodId || currentPeriod?.id || ''}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Filters */}
      <AdminUsersGoalsFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDepartmentId={selectedDepartmentId}
        onDepartmentChange={setSelectedDepartmentId}
        selectedStageId={selectedStageId}
        onStageChange={setSelectedStageId}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        departments={departments}
        stages={stages}
      />

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
            再読み込み
          </Button>
        </div>
      )}

      {/* Users Table */}
      {!error && (
        <div className="bg-card border rounded-lg">
          <AdminUsersGoalsTable
            userSummaries={paginatedUserSummaries}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            表示: {(currentPage - 1) * 50 + 1}-
            {Math.min(currentPage * 50, filteredUserSummaries.length)} / {filteredUserSummaries.length}名
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              前へ
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {/* Similar to existing pagination logic */}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              次へ
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

#### 3.3.2 AdminUsersGoalsTable Component

**File**: `frontend/src/feature/evaluation/admin/admin-users-goals/components/AdminUsersGoalsTable.tsx`

```typescript
import { UserGoalSummary } from '../types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';

interface AdminUsersGoalsTableProps {
  userSummaries: UserGoalSummary[];
  isLoading: boolean;
}

export function AdminUsersGoalsTable({ userSummaries, isLoading }: AdminUsersGoalsTableProps) {
  const router = useRouter();

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (userSummaries.length === 0) {
    return <EmptyState />;
  }

  const handleUserClick = (userId: string) => {
    router.push(`/admin/users-goals/${userId}`);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ユーザー</TableHead>
          <TableHead>部署</TableHead>
          <TableHead>ステージ</TableHead>
          <TableHead>目標数</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>最終更新</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {userSummaries.map(summary => (
          <TableRow
            key={summary.userId}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => handleUserClick(summary.userId)}
          >
            {/* User Name */}
            <TableCell className="font-medium">{summary.userName}</TableCell>

            {/* Department */}
            <TableCell>{summary.department?.name || '-'}</TableCell>

            {/* Stage */}
            <TableCell>{summary.stage?.name || '-'}</TableCell>

            {/* Goal Counts */}
            <TableCell>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">合計: {summary.counts.total}</span>
                <span className="text-xs text-muted-foreground">
                  コンピテンシー: {summary.counts.competency} /
                  チーム: {summary.counts.team} /
                  個人: {summary.counts.individual}
                </span>
              </div>
            </TableCell>

            {/* Status Summary */}
            <TableCell>
              <StatusSummary statusCounts={summary.statusCounts} />
            </TableCell>

            {/* Last Activity */}
            <TableCell>
              {summary.lastActivity ? formatDate(summary.lastActivity) : '-'}
            </TableCell>

            {/* Actions */}
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUserClick(summary.userId);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                詳細
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Status summary component with color-coded badges
 */
function StatusSummary({ statusCounts }: { statusCounts: UserGoalSummary['statusCounts'] }) {
  const { draft, submitted, approved, rejected, inReview } = statusCounts;
  const total = draft + submitted + approved + rejected + inReview;

  // Determine overall status color
  let variant: 'default' | 'success' | 'warning' | 'destructive' = 'default';
  if (approved === total && total > 0) {
    variant = 'success'; // All approved
  } else if (rejected > 0) {
    variant = 'destructive'; // Has rejections
  } else if (draft > 0) {
    variant = 'warning'; // Has drafts
  }

  return (
    <div className="flex flex-col gap-1">
      {approved > 0 && <Badge variant="success">承認済み: {approved}</Badge>}
      {submitted > 0 && <Badge variant="default">提出済み: {submitted}</Badge>}
      {inReview > 0 && <Badge variant="default">レビュー中: {inReview}</Badge>}
      {draft > 0 && <Badge variant="warning">下書き: {draft}</Badge>}
      {rejected > 0 && <Badge variant="destructive">差し戻し: {rejected}</Badge>}
      {total === 0 && <span className="text-muted-foreground text-sm">目標なし</span>}
    </div>
  );
}
```

---

#### 3.3.3 useAdminUsersGoalsData Hook

**File**: `frontend/src/feature/evaluation/admin/admin-users-goals/hooks/useAdminUsersGoalsData.ts`

```typescript
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getAdminGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getUsersAction } from '@/api/server-actions/users';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import type { GoalResponse, UserDetailResponse, Department, EvaluationPeriod } from '@/api/types';
import { UserGoalSummary } from '../types';

export interface UseAdminUsersGoalsDataParams {
  selectedPeriodId?: string;
}

export interface UseAdminUsersGoalsDataReturn {
  userSummaries: UserGoalSummary[];
  filteredUserSummaries: UserGoalSummary[];
  paginatedUserSummaries: UserGoalSummary[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedDepartmentId: string;
  setSelectedDepartmentId: (id: string) => void;
  selectedStageId: string;
  setSelectedStageId: (id: string) => void;
  selectedStatusFilter: string;
  setSelectedStatusFilter: (filter: string) => void;
  currentPeriod: EvaluationPeriod | null;
  allPeriods: EvaluationPeriod[];
  departments: Department[];
  stages: Stage[];
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  refetch: () => Promise<void>;
}

export function useAdminUsersGoalsData(params?: UseAdminUsersGoalsDataParams): UseAdminUsersGoalsDataReturn {
  // State
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [users, setUsers] = useState<UserDetailResponse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  /**
   * Load data with concurrent fetching
   */
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Load metadata in parallel
      const [periodResult, usersResult, departmentsResult] = await Promise.all([
        getCategorizedEvaluationPeriodsAction(),
        getUsersAction(),
        getDepartmentsAction(),
      ]);

      // Set users
      if (usersResult.success && usersResult.data?.items) {
        setUsers(usersResult.data.items);
      }

      // Set departments
      if (departmentsResult.success && Array.isArray(departmentsResult.data)) {
        setDepartments(departmentsResult.data);
      }

      // Set periods
      if (!periodResult.success || !periodResult.data) {
        setError('評価期間の読み込みに失敗しました');
        return;
      }

      const allPeriodsArray = periodResult.data.all || [];
      setAllPeriods(allPeriodsArray);
      setCurrentPeriod(periodResult.data.current || null);

      // Determine target period
      let targetPeriod: EvaluationPeriod | undefined;
      if (params?.selectedPeriodId) {
        targetPeriod = allPeriodsArray.find(p => p.id === params.selectedPeriodId);
      }
      if (!targetPeriod) {
        targetPeriod = periodResult.data.current ?? allPeriodsArray[0];
      }

      if (!targetPeriod) {
        setError('評価期間が設定されていません');
        return;
      }

      // Step 2: Fetch first page to determine total pages
      const firstPageResult = await getAdminGoalsAction({
        periodId: targetPeriod.id,
        page: 1,
        limit: 100,
        includeReviews: true,
      });

      if (!firstPageResult.success || !firstPageResult.data?.items) {
        setError(firstPageResult.error || '目標の読み込みに失敗しました');
        return;
      }

      const allGoals: GoalResponse[] = [...firstPageResult.data.items];
      const totalPages = firstPageResult.data.pages ?? 1;

      // Step 3: Fetch remaining pages concurrently (PERFORMANCE IMPROVEMENT)
      if (totalPages > 1) {
        const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
          getAdminGoalsAction({
            periodId: targetPeriod!.id,
            page: i + 2,
            limit: 100,
            includeReviews: true,
          })
        );

        const results = await Promise.allSettled(pagePromises);

        let failedPages = 0;
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success && result.value.data?.items) {
            allGoals.push(...result.value.data.items);
          } else {
            failedPages++;
            console.error(`Failed to load page ${index + 2}`);
          }
        });

        if (failedPages > 0) {
          setError(`一部のデータの読み込みに失敗しました (${failedPages}ページ)`);
        }
      }

      setGoals(allGoals);
    } catch (err) {
      console.error('Error loading admin users goals data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [params?.selectedPeriodId]);

  /**
   * Aggregate goals by user (CLIENT-SIDE AGGREGATION)
   */
  const userSummaries = useMemo<UserGoalSummary[]>(() => {
    // Group goals by userId
    const goalsByUserId = goals.reduce((acc, goal) => {
      if (!acc[goal.userId]) {
        acc[goal.userId] = [];
      }
      acc[goal.userId].push(goal);
      return acc;
    }, {} as Record<string, GoalResponse[]>);

    // Create summary for each user
    return users.map(user => {
      const userGoals = goalsByUserId[user.id] || [];

      // Calculate counts
      const counts = {
        total: userGoals.length,
        competency: userGoals.filter(g => g.goalCategory === 'competency').length,
        team: userGoals.filter(g => g.goalCategory === 'team').length,
        individual: userGoals.filter(g => g.goalCategory === 'individual').length,
      };

      // Calculate status counts
      const statusCounts = {
        draft: userGoals.filter(g => g.status === 'draft').length,
        submitted: userGoals.filter(g => g.status === 'submitted').length,
        inReview: userGoals.filter(g => g.status === 'in_review').length,
        approved: userGoals.filter(g => g.status === 'approved').length,
        rejected: userGoals.filter(g => g.status === 'rejected').length,
      };

      // Calculate last activity
      const lastActivity = userGoals.length > 0
        ? new Date(Math.max(...userGoals.map(g => new Date(g.updatedAt).getTime())))
        : null;

      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        department: user.department,
        stage: user.stage,
        supervisor: user.supervisor,
        counts,
        statusCounts,
        lastActivity,
        goals: userGoals,
      };
    });
  }, [goals, users]);

  /**
   * Filter user summaries (CLIENT-SIDE FILTERING)
   */
  const filteredUserSummaries = useMemo(() => {
    let result = userSummaries;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        summary =>
          summary.userName.toLowerCase().includes(query) ||
          summary.department?.name.toLowerCase().includes(query)
      );
    }

    // Department filter
    if (selectedDepartmentId && selectedDepartmentId !== 'all') {
      result = result.filter(summary => summary.department?.id === selectedDepartmentId);
    }

    // Stage filter
    if (selectedStageId && selectedStageId !== 'all') {
      result = result.filter(summary => summary.stage?.id === selectedStageId);
    }

    // Status filter
    if (selectedStatusFilter && selectedStatusFilter !== 'all') {
      switch (selectedStatusFilter) {
        case 'no-goals':
          result = result.filter(s => s.counts.total === 0);
          break;
        case 'has-drafts':
          result = result.filter(s => s.statusCounts.draft > 0);
          break;
        case 'all-submitted':
          result = result.filter(s => s.counts.total > 0 && s.statusCounts.draft === 0);
          break;
        case 'all-approved':
          result = result.filter(s => s.counts.total > 0 && s.statusCounts.approved === s.counts.total);
          break;
        case 'has-rejected':
          result = result.filter(s => s.statusCounts.rejected > 0);
          break;
      }
    }

    return result;
  }, [userSummaries, searchQuery, selectedDepartmentId, selectedStageId, selectedStatusFilter]);

  /**
   * Paginate filtered results (CLIENT-SIDE PAGINATION)
   */
  const paginatedUserSummaries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUserSummaries.slice(startIndex, endIndex);
  }, [filteredUserSummaries, currentPage, itemsPerPage]);

  /**
   * Calculate total pages
   */
  const totalPages = useMemo(() => {
    return Math.ceil(filteredUserSummaries.length / itemsPerPage);
  }, [filteredUserSummaries.length, itemsPerPage]);

  /**
   * Extract unique stages from users
   */
  const stages = useMemo(() => {
    const stageMap = new Map();
    users.forEach(user => {
      if (user.stage) {
        stageMap.set(user.stage.id, user.stage);
      }
    });
    return Array.from(stageMap.values());
  }, [users]);

  /**
   * Load data on mount or when period changes
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Reset to page 1 when filters change
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartmentId, selectedStageId, selectedStatusFilter]);

  return {
    userSummaries,
    filteredUserSummaries,
    paginatedUserSummaries,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedDepartmentId,
    setSelectedDepartmentId,
    selectedStageId,
    setSelectedStageId,
    selectedStatusFilter,
    setSelectedStatusFilter,
    currentPeriod,
    allPeriods,
    departments,
    stages,
    currentPage,
    totalPages,
    setCurrentPage,
    refetch: loadData,
  };
}
```

---

### 3.4 Type Definitions

**File**: `frontend/src/feature/evaluation/admin/admin-users-goals/types.ts`

```typescript
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

---

## 4. Backend Considerations (Optional Phase 4)

### 4.1 Aggregate Endpoint Design

**New Endpoint**: `GET /api/admin/goals/by-user`

**Purpose**: Server-side aggregation for improved performance with very large datasets

**Response Schema**:
```python
class UserGoalSummaryResponse(BaseModel):
    user_id: UUID
    user_name: str
    user_email: str
    department_id: Optional[UUID]
    department_name: Optional[str]
    stage_id: Optional[UUID]
    stage_name: Optional[str]
    counts: GoalCountsSchema
    status_counts: StatusCountsSchema
    last_activity: Optional[datetime]

class GoalCountsSchema(BaseModel):
    total: int
    competency: int
    team: int
    individual: int

class StatusCountsSchema(BaseModel):
    draft: int
    submitted: int
    in_review: int
    approved: int
    rejected: int
```

**SQL Query** (Optimized):
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
    COUNT(CASE WHEN g.status = 'in_review' THEN 1 END) AS in_review_count,
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

**Benefits of Backend Aggregation**:
- ✅ Faster for very large datasets (> 10k goals)
- ✅ Reduced payload size (summaries vs full goal objects)
- ✅ Database does heavy lifting (optimized query)
- ✅ Scalable to 100k+ goals

**When to Use**:
- Organization has > 5k goals per period
- Client-side aggregation becomes slow (> 500ms)
- Payload size is concern (mobile users)
- Want sub-second initial load

---

## 5. Migration Strategy

### 5.1 Phased Rollout

**Phase 1: Add New Route (Week 1)**
- Create `/admin/users-goals` route
- Implement user-centric table
- Add concurrent fetching
- Keep existing `/admin/goal-list` untouched
- Deploy behind feature flag or to beta users

**Phase 2: Gather Feedback (Week 2)**
- Collect user feedback on new view
- Monitor performance metrics
- Fix bugs and UX issues
- Improve based on feedback

**Phase 3: Switch Default (Week 3)**
- Update navigation to point to new route
- Redirect `/admin/goal-list` to `/admin/users-goals`
- Deprecate old route (or keep as "goal detail view")
- Update documentation

**Phase 4: Backend Optimization (Week 4, Optional)**
- Implement `/admin/goals/by-user` endpoint
- Update frontend to use new endpoint
- Keep client-side as fallback
- Measure performance improvements

---

### 5.2 Feature Flag Implementation

**Environment Variable**:
```env
NEXT_PUBLIC_ENABLE_USER_CENTRIC_GOALS=true
```

**Usage in Code**:
```typescript
// In navigation menu
const goalsRoute = process.env.NEXT_PUBLIC_ENABLE_USER_CENTRIC_GOALS === 'true'
  ? '/admin/users-goals'
  : '/admin/goal-list';
```

**Rollout Strategy**:
1. Deploy with flag OFF for all users
2. Enable for internal testing
3. Enable for selected beta users
4. Enable for 10% of admins (A/B test)
5. Enable for 50% of admins
6. Enable for 100% of admins
7. Remove flag and old code

---

## 6. Testing Strategy

### 6.1 Performance Testing

**Test 1: Concurrent Fetching Performance**
```typescript
describe('Concurrent fetching performance', () => {
  it('should load 600 goals in under 2 seconds', async () => {
    const startTime = Date.now();

    // Mock 6 pages of goals (100 per page)
    const mockPages = Array.from({ length: 6 }, (_, i) => ({
      success: true,
      data: {
        items: generateMockGoals(100),
        pages: 6,
      },
    }));

    // Execute concurrent fetching
    const results = await Promise.allSettled(mockPages);

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    expect(loadTime).toBeLessThan(2000); // p95 target
  });
});
```

**Test 2: Client-Side Aggregation Performance**
```typescript
describe('Client-side aggregation performance', () => {
  it('should aggregate 500 users with 10 goals each in under 100ms', () => {
    const users = generateMockUsers(500);
    const goals = generateMockGoals(5000); // 500 users × 10 goals

    const startTime = Date.now();
    const aggregated = aggregateGoalsByUser(goals, users);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(100);
    expect(aggregated).toHaveLength(500);
  });
});
```

---

### 6.2 Functional Testing

**Test 3: User Summary Display**
```typescript
describe('User summary display', () => {
  it('should show correct goal counts for each user', () => {
    render(<AdminUsersGoalsTable userSummaries={mockSummaries} isLoading={false} />);

    // User with 6 goals (4 competency, 2 team)
    expect(screen.getByText('合計: 6')).toBeInTheDocument();
    expect(screen.getByText(/コンピテンシー: 4/)).toBeInTheDocument();
    expect(screen.getByText(/チーム: 2/)).toBeInTheDocument();
  });

  it('should show correct status summary', () => {
    // User with 4 approved, 2 draft
    render(<StatusSummary statusCounts={{ approved: 4, draft: 2, submitted: 0, rejected: 0, inReview: 0 }} />);

    expect(screen.getByText('承認済み: 4')).toBeInTheDocument();
    expect(screen.getByText('下書き: 2')).toBeInTheDocument();
  });
});
```

**Test 4: Filtering Logic**
```typescript
describe('User filtering', () => {
  it('should filter by department', () => {
    const { result } = renderHook(() => useAdminUsersGoalsData());

    act(() => {
      result.current.setSelectedDepartmentId('dept-1');
    });

    expect(result.current.filteredUserSummaries).toHaveLength(3); // 3 users in dept-1
  });

  it('should filter by status', () => {
    const { result } = renderHook(() => useAdminUsersGoalsData());

    act(() => {
      result.current.setSelectedStatusFilter('has-drafts');
    });

    // Only users with draft goals
    expect(result.current.filteredUserSummaries.every(s => s.statusCounts.draft > 0)).toBe(true);
  });
});
```

---

## 7. Performance Optimizations

### 7.1 React Performance

**Memoization**:
```typescript
// Memoize expensive aggregation
const userSummaries = useMemo(() => {
  return aggregateGoalsByUser(goals, users);
}, [goals, users]);

// Memoize filtered results
const filteredUserSummaries = useMemo(() => {
  return applyFilters(userSummaries, filters);
}, [userSummaries, filters]);

// Memoize user map for quick lookup
const userMap = useMemo(() => {
  return new Map(users.map(u => [u.id, u]));
}, [users]);
```

**Component Optimization**:
```typescript
// Memoize row components to prevent unnecessary re-renders
const UserRow = memo(({ summary }: { summary: UserGoalSummary }) => {
  return (
    <TableRow>
      {/* ... row content */}
    </TableRow>
  );
});
```

---

### 7.2 Request Optimization

**Limit Concurrent Requests**:
```typescript
// Batch requests to avoid overwhelming server
const CONCURRENT_LIMIT = 5;

async function fetchAllPagesWithLimit(totalPages: number) {
  const allGoals: GoalResponse[] = [];

  // Process in batches of 5
  for (let batch = 0; batch < Math.ceil(totalPages / CONCURRENT_LIMIT); batch++) {
    const batchStart = batch * CONCURRENT_LIMIT + 1;
    const batchEnd = Math.min(batchStart + CONCURRENT_LIMIT - 1, totalPages);

    const batchPromises = Array.from({ length: batchEnd - batchStart + 1 }, (_, i) =>
      getAdminGoalsAction({ page: batchStart + i, limit: 100 })
    );

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        allGoals.push(...result.value.data.items);
      }
    });
  }

  return allGoals;
}
```

---

## 8. Error Handling

### 8.1 Partial Data Loading

**Scenario**: Some pages fail to load

**Handling**:
```typescript
const results = await Promise.allSettled(pagePromises);

let failedPages: number[] = [];
results.forEach((result, index) => {
  if (result.status === 'fulfilled' && result.value.success) {
    allGoals.push(...result.value.data.items);
  } else {
    failedPages.push(index + 2); // Page numbers start from 2
    console.error(`Failed to load page ${index + 2}:`, result.reason);
  }
});

if (failedPages.length > 0) {
  setError(
    `一部のデータの読み込みに失敗しました。ページ: ${failedPages.join(', ')}。` +
    `データは不完全な可能性があります。`
  );
  // Still show partial data
} else {
  setError(null);
}
```

**UI Display**:
```tsx
{error && (
  <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-4">
    <p className="text-sm text-warning">{error}</p>
    <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
      再読み込み
    </Button>
  </div>
)}
```

---

## 9. Conclusion

This design implements a user-centric view with concurrent data fetching to improve both usability and performance of the admin goals list page. The phased rollout approach allows for safe deployment and gradual migration, while the optional backend endpoint provides a path for further optimization if needed.

**Strengths**:
- ✅ **Usability**: One-row-per-user view enables compliance auditing
- ✅ **Performance**: 5x faster load times with concurrent fetching
- ✅ **Scalability**: Handles 5k-10k goals efficiently
- ✅ **Maintainability**: Reuses existing components and patterns
- ✅ **Flexibility**: Optional backend endpoint for future scale

**Implementation Effort**:
- Phase 1-3: 16-24 hours (frontend only)
- Phase 4: +4-6 hours (backend endpoint)
- **Total: 20-30 hours**

**Next Steps**:
1. Review and approve this design
2. Implement per tasks.md
3. Test with realistic data volumes
4. Deploy behind feature flag
5. Gather user feedback
6. Roll out to all admins
7. Consider backend endpoint if scale requires

---

## 10. References

- GitHub Issue: [#337](https://github.com/shintairiku/evaluation-system/issues/337)
- ISSUE.md: `.kiro/specs/admin-goals-user-centric/ISSUE.md`
- Requirements: `.kiro/specs/admin-goals-user-centric/requirements.md`
- Tasks: `.kiro/specs/admin-goals-user-centric/tasks.md`
- Current Implementation: `frontend/src/feature/evaluation/admin/admin-goal-list/`
- Similar Implementation: `frontend/src/feature/user-profiles/` (user-centric list)
