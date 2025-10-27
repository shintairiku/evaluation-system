# Implementation Tasks: Admin Goal List Page (管理者用目標一覧)

## Overview

This document breaks down the implementation of the admin goal list page into concrete, actionable tasks. The feature provides system-wide visibility of all goals for administrators while maintaining security and performance.

**Goal:** Enable admins to view and filter all goals across the organization

**Approach:**
- Backend: New admin endpoint with GOAL_READ_ALL permission check
- Backend: Extend GoalService to support admin-scoped queries
- Frontend: New page under `/admin/goal-list` route
- Frontend: Reuse performance optimizations from employee goal-list
- Security: Enforce admin-only access at multiple layers

**Estimated Total Time:** 10-13 hours (1.5-2 days)

---

## Phase 1: Backend Implementation

### Task 1.1: Create Admin Goals API Endpoint
**Estimated Time:** 1.5 hours
**Assignee:** Backend Developer
**Dependencies:** None
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Create new `/api/org/{org_slug}/admin/goals` endpoint with admin permission enforcement.

**Acceptance Criteria:**
- [ ] Endpoint exists at `GET /api/org/{org_slug}/admin/goals`
- [ ] Requires valid Clerk authentication
- [ ] Checks `GOAL_READ_ALL` permission (admin only)
- [ ] Returns 403 Forbidden if user lacks permission
- [ ] Supports query parameters: `periodId`, `userId`, `departmentId`, `goalCategory`, `status`, `page`, `limit`
- [ ] Supports `includeReviews` parameter (default: true)
- [ ] Calls `GoalService.get_all_goals_for_admin()`
- [ ] Returns `GoalList` response model
- [ ] Logs admin access attempts

**Implementation Details:**

```python
# File: backend/app/api/v1/admin.py

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from typing import Optional, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ...database.session import get_db_session
from ...security.dependencies import get_auth_context
from ...security.context import AuthContext
from ...security.permissions import Permission
from ...schemas.goal import GoalList
from ...schemas.common import PaginationParams
from ...services.goal_service import GoalService
from ...core.exceptions import PermissionDeniedError
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/goals", response_model=GoalList)
async def get_admin_goals(
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId"),
    user_id: Optional[UUID] = Query(None, alias="userId"),
    department_id: Optional[UUID] = Query(None, alias="departmentId"),
    goal_category: Optional[str] = Query(None, alias="goalCategory"),
    status: Optional[List[str]] = Query(None),
    include_reviews: bool = Query(True, alias="includeReviews"),
    include_rejection_history: bool = Query(False, alias="includeRejectionHistory"),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all goals for admin visualization (admin-only endpoint).

    Requires: Admin role (GOAL_READ_ALL permission)
    """
    # Permission check
    if not context.has_permission(Permission.GOAL_READ_ALL):
        logger.warning(
            f"Non-admin user {context.user_id} attempted to access admin goals"
        )
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Admin role required to access all goals"
        )

    # Validate parameters
    if include_rejection_history and not include_reviews:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="includeRejectionHistory requires includeReviews=true"
        )

    try:
        service = GoalService(session)

        result = await service.get_all_goals_for_admin(
            org_id=context.organization_id,
            period_id=period_id,
            user_id=user_id,
            department_id=department_id,
            goal_category=goal_category,
            status=status,
            pagination=pagination,
            include_reviews=include_reviews,
            include_rejection_history=include_rejection_history
        )

        logger.info(
            f"Admin {context.user_id} fetched {len(result.items)} goals "
            f"(total: {result.total}, org: {context.organization_id})"
        )

        return result

    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error fetching admin goals: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching goals: {str(e)}"
        )
```

**Testing:**
- [ ] Integration test: Admin user can access endpoint
- [ ] Integration test: Non-admin user gets 403 Forbidden
- [ ] Integration test: Endpoint returns correct data format
- [ ] Integration test: Filter parameters work correctly
- [ ] Unit test: Permission check logic

**Related Requirements:** FR-1 (Admin Access), FR-2 (Display All Goals)
**Related Files:** `backend/app/api/v1/admin.py`

---

### Task 1.2: Implement Admin Service Method
**Estimated Time:** 2 hours
**Assignee:** Backend Developer
**Dependencies:** Task 1.1
**Priority:** HIGH
**Complexity:** Medium-High

**Description:**
Add `get_all_goals_for_admin()` method to `GoalService` that bypasses user-level filtering.

**Acceptance Criteria:**
- [ ] Method signature matches design document
- [ ] Calls `goal_repo.search_goals()` with `user_ids=None` (all users)
- [ ] Supports `department_id` filter parameter
- [ ] Reuses batch review fetching optimization (`includeReviews`)
- [ ] Enriches goals with user and department information
- [ ] Returns `PaginatedResponse[Goal]`
- [ ] Logs performance metrics
- [ ] Executes in < 500ms for 100 goals
- [ ] Executes in < 1000ms for 500 goals

**Implementation Details:**

```python
# File: backend/app/services/goal_service.py

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
    Get all goals for admin visualization (no user-level filtering).

    SECURITY: This method bypasses normal user permission checks.
    Should ONLY be called from admin-protected endpoints.
    """
    try:
        logger.info(
            f"Admin fetching goals: org={org_id}, period={period_id}, "
            f"user={user_id}, dept={department_id}"
        )

        # Search goals (user_ids=None means ALL users)
        goals = await self.goal_repo.search_goals(
            org_id=org_id,
            user_ids=None,  # ← KEY: None = all users
            period_id=period_id,
            department_id=department_id,
            goal_category=goal_category,
            status=status,
            pagination=pagination
        )

        # Get total count
        total_count = await self.goal_repo.count_goals(
            org_id=org_id,
            user_ids=None,
            period_id=period_id,
            department_id=department_id,
            goal_category=goal_category,
            status=status
        )

        # Batch fetch reviews (performance optimization)
        reviews_map = {}
        if include_reviews and goals:
            goal_ids = [goal.id for goal in goals]
            reviews_map = await self.supervisor_review_repo.get_by_goals_batch(
                goal_ids=goal_ids,
                org_id=org_id
            )
            logger.info(f"Batch fetched {len(reviews_map)} reviews")

        # Batch fetch rejection histories
        rejection_histories_map = {}
        if include_rejection_history and goals:
            rejection_histories_map = await self._get_rejection_histories_batch(
                goals=goals,
                org_id=org_id
            )

        # Enrich goal data
        enriched_goals = []
        for goal_model in goals:
            enriched_goal = await self._enrich_goal_data(
                goal_model,
                include_reviews=include_reviews,
                include_rejection_history=include_rejection_history,
                reviews_map=reviews_map,
                rejection_histories_map=rejection_histories_map,
                org_id=org_id
            )
            enriched_goals.append(enriched_goal)

        # Paginate
        if pagination:
            total_pages = (total_count + pagination.limit - 1) // pagination.limit
        else:
            total_pages = 1

        logger.info(
            f"Admin goals fetch complete: {len(enriched_goals)} items, "
            f"total: {total_count}"
        )

        return PaginatedResponse(
            items=enriched_goals,
            total=total_count,
            page=pagination.page if pagination else 1,
            limit=pagination.limit if pagination else len(enriched_goals),
            pages=total_pages
        )

    except Exception as e:
        logger.error(f"Error in get_all_goals_for_admin: {e}", exc_info=True)
        raise
```

**Testing:**
- [ ] Unit test: Method returns all goals (no user filtering)
- [ ] Unit test: Department filter works correctly
- [ ] Unit test: Batch review optimization is used
- [ ] Unit test: Organization scope is enforced
- [ ] Performance test: < 500ms for 100 goals
- [ ] Performance test: < 1000ms for 500 goals

**Related Requirements:** FR-2 (Display All Goals), NFR-1 (Performance)
**Related Files:** `backend/app/services/goal_service.py`

---

### Task 1.3: Update Repository for Department Filtering
**Estimated Time:** 1 hour
**Assignee:** Backend Developer
**Dependencies:** Task 1.2
**Priority:** MEDIUM
**Complexity:** Low-Medium

**Description:**
Update `GoalRepository.search_goals()` and `count_goals()` to support department filtering via JOIN with users table.

**Acceptance Criteria:**
- [ ] Add `department_id: Optional[UUID]` parameter to `search_goals()`
- [ ] Add `department_id: Optional[UUID]` parameter to `count_goals()`
- [ ] JOIN with `users` table when `department_id` is provided
- [ ] Filter by `users.department_id`
- [ ] Maintain backward compatibility (department_id=None works as before)
- [ ] Add proper query optimization (indexes should exist)

**Implementation Details:**

```python
# File: backend/app/database/repositories/goal_repo.py

async def search_goals(
    self,
    org_id: str,
    user_ids: Optional[List[UUID]] = None,
    period_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,  # ← NEW
    goal_category: Optional[str] = None,
    status: Optional[List[str]] = None,
    pagination: Optional[PaginationParams] = None
) -> List[GoalModel]:
    """Search goals with optional filters."""
    from ..models.user import User

    query = select(GoalModel).where(GoalModel.org_id == org_id)

    # Filter by user IDs
    if user_ids is not None:
        query = query.where(GoalModel.user_id.in_(user_ids))

    # NEW: Filter by department (requires JOIN)
    if department_id:
        query = (
            query
            .join(User, GoalModel.user_id == User.id)
            .where(User.department_id == department_id)
        )

    # ... existing filters ...

    if period_id:
        query = query.where(GoalModel.period_id == period_id)

    if goal_category:
        query = query.where(GoalModel.goal_category == goal_category)

    if status and len(status) > 0:
        query = query.where(GoalModel.status.in_(status))

    query = query.order_by(GoalModel.created_at.desc())

    if pagination:
        offset = (pagination.page - 1) * pagination.limit
        query = query.offset(offset).limit(pagination.limit)

    result = await self.session.execute(query)
    return result.scalars().all()


async def count_goals(
    self,
    org_id: str,
    user_ids: Optional[List[UUID]] = None,
    period_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,  # ← NEW
    goal_category: Optional[str] = None,
    status: Optional[List[str]] = None
) -> int:
    """Count goals matching filters."""
    from ..models.user import User

    query = select(func.count(GoalModel.id)).where(GoalModel.org_id == org_id)

    if user_ids is not None:
        query = query.where(GoalModel.user_id.in_(user_ids))

    # NEW: Department filter
    if department_id:
        query = (
            query
            .join(User, GoalModel.user_id == User.id)
            .where(User.department_id == department_id)
        )

    # ... existing filters ...

    result = await self.session.execute(query)
    return result.scalar() or 0
```

**Testing:**
- [ ] Unit test: Department filter returns correct goals
- [ ] Unit test: Department filter works with other filters
- [ ] Unit test: Method works without department_id (backward compat)
- [ ] Performance test: JOIN doesn't significantly impact query time

**Related Requirements:** FR-3 (Advanced Filtering)
**Related Files:** `backend/app/database/repositories/goal_repo.py`

---

### Task 1.4: Write Backend Tests
**Estimated Time:** 1.5 hours
**Assignee:** Backend Developer
**Dependencies:** Tasks 1.1, 1.2, 1.3
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Write comprehensive tests for admin goals endpoint and service.

**Acceptance Criteria:**
- [ ] Integration tests for endpoint (8+ tests)
- [ ] Unit tests for service method (5+ tests)
- [ ] Unit tests for repository changes (3+ tests)
- [ ] All tests pass
- [ ] Test coverage > 90% for new code

**Test Cases:**

```python
# File: backend/tests/api/test_admin.py

async def test_admin_goals_requires_authentication():
    """Test endpoint requires valid authentication"""

async def test_admin_goals_requires_admin_permission():
    """Test non-admin users get 403 Forbidden"""

async def test_admin_can_fetch_all_goals():
    """Test admin users can fetch all goals"""

async def test_admin_goals_filtered_by_organization():
    """Test admin only sees their org's goals"""

async def test_admin_goals_filtered_by_period():
    """Test period filter works correctly"""

async def test_admin_goals_filtered_by_department():
    """Test department filter works correctly"""

async def test_admin_goals_filtered_by_status():
    """Test status filter works correctly"""

async def test_admin_goals_includes_user_and_department_info():
    """Test response includes user and department data"""

async def test_admin_goals_uses_batch_review_optimization():
    """Test includeReviews=true fetches reviews efficiently"""

async def test_admin_goals_pagination():
    """Test pagination works correctly"""


# File: backend/tests/services/test_goal_service.py

async def test_get_all_goals_for_admin_returns_all_users_goals():
    """Test method returns goals from ALL users"""

async def test_get_all_goals_for_admin_filtered_by_department():
    """Test department filtering works"""

async def test_get_all_goals_for_admin_organization_scoped():
    """Test organization scope is enforced"""

async def test_get_all_goals_for_admin_uses_batch_optimization():
    """Test batch review fetching is used"""

async def test_get_all_goals_for_admin_performance():
    """Test method executes in < 500ms for 100 goals"""


# File: backend/tests/repositories/test_goal_repo.py

async def test_search_goals_department_filter():
    """Test department filter returns correct goals"""

async def test_count_goals_department_filter():
    """Test count with department filter is accurate"""

async def test_search_goals_user_ids_none_returns_all():
    """Test user_ids=None returns all users' goals"""
```

**Testing:**
- [ ] All tests pass
- [ ] Coverage report shows > 90% for new code
- [ ] CI/CD pipeline passes

**Related Requirements:** All backend requirements
**Related Files:** `backend/tests/`

---

## Phase 2: Frontend Implementation

### Task 2.1: Create Page Route
**Estimated Time:** 15 minutes
**Assignee:** Frontend Developer
**Dependencies:** None
**Priority:** HIGH
**Complexity:** Low

**Description:**
Create new page route at `/admin/goal-list` under `(admin)` route group.

**Acceptance Criteria:**
- [ ] File exists: `frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx`
- [ ] Route imports and renders `AdminGoalListPage` component
- [ ] Route is accessible at `/admin/goal-list` URL
- [ ] Route follows Next.js App Router conventions

**Implementation Details:**

```tsx
// File: frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx

import AdminGoalListPage from '@/feature/evaluation/admin/admin-goal-list/display/index';

export default function Page() {
  return <AdminGoalListPage />;
}
```

**Testing:**
- [ ] Manual test: Navigate to `/admin/goal-list`
- [ ] Manual test: Page renders without errors
- [ ] E2E test: Route is accessible

**Related Requirements:** FR-1 (Admin Access)
**Related Files:** `frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx`

---

### Task 2.2: Create API Client Method
**Estimated Time:** 30 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 1.1 (backend endpoint)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Add `getAdminGoals()` method to goals API client.

**Acceptance Criteria:**
- [ ] Method exists in `frontend/src/api/endpoints/goals.ts`
- [ ] Calls `GET /api/org/{org_slug}/admin/goals`
- [ ] Supports all query parameters (periodId, userId, departmentId, etc.)
- [ ] Returns `ApiResponse<GoalListResponse>`
- [ ] Uses `buildOrgApiUrl()` helper
- [ ] Handles array parameters correctly (status)
- [ ] TypeScript types are correct

**Implementation Details:**

```typescript
// File: frontend/src/api/endpoints/goals.ts

export const goalsApi = {
  // ... existing methods ...

  /**
   * Get all goals for admin visualization (admin-only endpoint)
   */
  getAdminGoals: async (params?: {
    periodId?: UUID;
    userId?: UUID;
    departmentId?: UUID;
    goalCategory?: string;
    status?: string | string[];
    page?: number;
    limit?: number;
    includeReviews?: boolean;
    includeRejectionHistory?: boolean;
  }): Promise<ApiResponse<GoalListResponse>> => {
    const queryParams = new URLSearchParams();

    if (params?.periodId) queryParams.append('periodId', params.periodId);
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.goalCategory) queryParams.append('goalCategory', params.goalCategory);

    // Handle status array
    if (params?.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      statuses.forEach(s => queryParams.append('status', s));
    }

    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.includeReviews) queryParams.append('includeReviews', 'true');
    if (params?.includeRejectionHistory) queryParams.append('includeRejectionHistory', 'true');

    return apiClient.get<GoalListResponse>(
      `${buildOrgApiUrl('/admin/goals')}?${queryParams.toString()}`
    );
  },
};
```

**Testing:**
- [ ] Unit test: Query parameters are built correctly
- [ ] Unit test: Array parameters handled correctly
- [ ] Integration test: API call succeeds with mock server

**Related Requirements:** FR-2 (Display All Goals)
**Related Files:** `frontend/src/api/endpoints/goals.ts`

---

### Task 2.3: Create Server Action
**Estimated Time:** 20 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 2.2
**Priority:** HIGH
**Complexity:** Low

**Description:**
Add `getAdminGoalsAction()` server action with caching.

**Acceptance Criteria:**
- [ ] Server action exists in `frontend/src/api/server-actions/goals.ts`
- [ ] Uses `cache()` from React for request deduplication
- [ ] Calls `goalsApi.getAdminGoals()`
- [ ] Returns normalized response format
- [ ] Handles errors gracefully
- [ ] TypeScript types are correct

**Implementation Details:**

```typescript
// File: frontend/src/api/server-actions/goals.ts

import { cache } from 'react';
import { goalsApi } from '../endpoints/goals';
import type { UUID, GoalListResponse } from '../types';

/**
 * Server action to get all goals for admin (admin-only)
 */
export const getAdminGoalsAction = cache(async (params?: {
  periodId?: UUID;
  userId?: UUID;
  departmentId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
  includeReviews?: boolean;
  includeRejectionHistory?: boolean;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> => {
  try {
    const response = await goalsApi.getAdminGoals(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch admin goals',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get admin goals action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching goals',
    };
  }
});
```

**Testing:**
- [ ] Unit test: Server action calls API correctly
- [ ] Unit test: Error handling works
- [ ] Unit test: Cache() is applied

**Related Requirements:** FR-2 (Display All Goals), NFR-1 (Performance)
**Related Files:** `frontend/src/api/server-actions/goals.ts`

---

### Task 2.4: Create Data Hook
**Estimated Time:** 2 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 2.3
**Priority:** HIGH
**Complexity:** Medium-High

**Description:**
Create `useAdminGoalListData` hook for data management, filtering, and pagination.

**Acceptance Criteria:**
- [ ] Hook exists in `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`
- [ ] Loads periods, departments, users, and goals
- [ ] Uses `includeReviews=true` for batch optimization
- [ ] Implements client-side filtering (status, category, department, user)
- [ ] Implements client-side pagination (50 items per page)
- [ ] Exposes clear API for components
- [ ] Handles loading and error states
- [ ] Uses memoization for performance
- [ ] Properly typed with TypeScript

**Implementation Details:**

See design document Section 4.3.2 for complete implementation.

Key features:
- `loadGoalData()` - Fetch data from server
- `filteredGoals` - Memoized filtered goals
- `paginatedGoals` - Memoized paginated subset
- `clearAllFilters()` - Reset all filters
- Filter state management
- Pagination state management

**Testing:**
- [ ] Unit test: Hook loads data correctly
- [ ] Unit test: Filtering works for each filter type
- [ ] Unit test: Pagination works correctly
- [ ] Unit test: clearAllFilters resets state
- [ ] Unit test: Memoization prevents unnecessary recalculations

**Related Requirements:** FR-3 (Advanced Filtering), FR-4 (Search and Sorting), NFR-1 (Performance)
**Related Files:** `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`

---

### Task 2.5: Create Main Page Component (with Employee Info Card)
**Estimated Time:** 1.5 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 2.4
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Create main `AdminGoalListPage` component with layout and sub-components, **including EmployeeInfoCard when a specific user is selected** (similar to supervisor view in goal-list).

**Component Reuse:**
- ✅ **Reuse**: `EvaluationPeriodSelector` from `@/components/evaluation/EvaluationPeriodSelector`
- ✅ **Reuse**: `EmployeeInfoCard` from `@/components/evaluation/EmployeeInfoCard` (show when user filter is selected)
- ✅ **Reuse**: Loading skeleton pattern from existing goal-list
- ✅ **Reuse**: Error/empty state patterns from existing goal-list

**Acceptance Criteria:**
- [ ] Component exists in `frontend/src/feature/evaluation/admin/admin-goal-list/display/index.tsx`
- [ ] Uses `useAdminGoalListData` hook
- [ ] Renders header with title and period selector (**reuse EvaluationPeriodSelector**)
- [ ] **NEW**: Renders `EmployeeInfoCard` when a specific user is selected in filters
- [ ] Renders filter bar
- [ ] Renders table/cards
- [ ] Renders pagination controls
- [ ] Shows loading skeleton
- [ ] Shows error state
- [ ] Shows empty state
- [ ] Responsive design (desktop/mobile)
- [ ] Accessible (keyboard navigation, ARIA labels)

**Implementation Details:**

See design document Section 4.3.1 for complete implementation.

Key sections:
- Header with period selector (**reuse existing component**)
- **NEW**: Employee info card (show when user filter is active)
- Filters bar
- Goals table/cards
- Pagination
- Loading state
- Error state
- Empty state

**New Feature: Show Employee Info When User Selected**
```tsx
// Add after filters, before table
{selectedUserId && selectedUserData && (
  <EmployeeInfoCard employee={selectedUserData} />
)}
```

This provides context similar to supervisor view when viewing a specific user's goals.

**Testing:**
- [ ] Unit test: Component renders without crashing
- [ ] Unit test: Loading state renders
- [ ] Unit test: Error state renders
- [ ] Unit test: Empty state renders
- [ ] Visual test: Screenshot comparison

**Related Requirements:** FR-2 (Display All Goals), NFR-3 (Usability)
**Related Files:** `frontend/src/feature/evaluation/admin/admin-goal-list/display/index.tsx`

---

### Task 2.6: Create Filter Component (Reusing Existing Patterns)
**Estimated Time:** 1 hour
**Assignee:** Frontend Developer
**Dependencies:** Task 2.5
**Priority:** MEDIUM
**Complexity:** Medium

**Description:**
Create `AdminGoalListFilters` component with all filter controls, **reusing patterns from existing `GoalListFilters` and `EmployeeSelector` components**.

**Component Reuse Strategy:**
- ✅ **Reuse**: Filter layout structure from `GoalListFilters`
- ✅ **Reuse**: Active filter count badge pattern from `GoalListFilters`
- ✅ **Reuse**: Clear all button pattern from `GoalListFilters`
- ✅ **Adapt**: User selection pattern from `EmployeeSelector` (but make it a filter dropdown)
- 🆕 **New**: Department filter (not in existing goal-list)

**Reference Components:**
- `frontend/src/feature/evaluation/employee/goal-list/components/GoalListFilters.tsx` - Base structure
- `frontend/src/feature/evaluation/employee/goal-list/components/EmployeeSelector.tsx` - User selection pattern

**Acceptance Criteria:**
- [ ] Component exists in `frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListFilters.tsx`
- [ ] Status filter (multi-select checkbox) - **reuse pattern from GoalListFilters**
- [ ] Category filter (dropdown)
- [ ] Department filter (dropdown) - **NEW**
- [ ] User filter (searchable select) - **adapt from EmployeeSelector**
- [ ] Active filter count badge - **reuse from GoalListFilters**
- [ ] "Clear all filters" button - **reuse pattern from GoalListFilters**
- [ ] Responsive layout
- [ ] Accessible

**Implementation Details:**

```tsx
// File: frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListFilters.tsx

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { GoalStatus } from '@/api/types';

interface AdminGoalListFiltersProps {
  selectedStatuses: GoalStatus[];
  selectedCategory: string;
  selectedDepartmentId: string;
  selectedUserId: string;
  onStatusChange: (statuses: GoalStatus[]) => void;
  onCategoryChange: (category: string) => void;
  onDepartmentChange: (departmentId: string) => void;
  onUserChange: (userId: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
}

export function AdminGoalListFilters({
  selectedStatuses,
  selectedCategory,
  selectedDepartmentId,
  selectedUserId,
  onStatusChange,
  onCategoryChange,
  onDepartmentChange,
  onUserChange,
  activeFilterCount,
  onClearAll,
}: AdminGoalListFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">フィルター</h3>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{activeFilterCount}件</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-7"
            >
              <X className="h-3 w-3 mr-1" />
              クリア
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          {/* Multi-select checkbox implementation */}
        </div>

        {/* Category Filter */}
        <div>
          {/* Dropdown implementation */}
        </div>

        {/* Department Filter */}
        <div>
          {/* Dropdown implementation */}
        </div>

        {/* User Filter */}
        <div>
          {/* Searchable select implementation */}
        </div>
      </div>
    </div>
  );
}
```

**Testing:**
- [ ] Unit test: All filters render
- [ ] Unit test: Filter changes trigger callbacks
- [ ] Unit test: Clear all button works
- [ ] Visual test: Filter layout

**Related Requirements:** FR-3 (Advanced Filtering)
**Related Files:** `frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListFilters.tsx`

---

### Task 2.7: Create Table Component
**Estimated Time:** 1.5 hours
**Assignee:** Frontend Developer
**Dependencies:** Task 2.5
**Priority:** MEDIUM
**Complexity:** Medium

**Description:**
Create `AdminGoalListTable` component to display goals in table format.

**Acceptance Criteria:**
- [ ] Component exists in `frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListTable.tsx`
- [ ] Displays columns: User, Department, Category, Title, Status, Weight, Date
- [ ] Uses shadcn/ui Table component
- [ ] Sortable columns (client-side)
- [ ] Truncates long text with ellipsis
- [ ] Shows status badges (reuse `GoalStatusBadge`)
- [ ] Responsive (switches to card view on mobile)
- [ ] Accessible (proper table semantics)

**Implementation Details:**

```tsx
// File: frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListTable.tsx

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GoalStatusBadge } from '@/components/evaluation/GoalStatusBadge';
import type { GoalResponse } from '@/api/types';

interface AdminGoalListTableProps {
  goals: GoalResponse[];
  onSort?: (field: string) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export function AdminGoalListTable({
  goals,
  onSort,
  sortField,
  sortDirection,
}: AdminGoalListTableProps) {
  if (goals.length === 0) {
    return (
      <div className="text-center py-12 bg-card border rounded-lg">
        <p className="text-muted-foreground">該当する目標がありません</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ユーザー</TableHead>
            <TableHead>部署</TableHead>
            <TableHead>カテゴリー</TableHead>
            <TableHead className="max-w-xs">タイトル</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="text-right">ウェイト</TableHead>
            <TableHead>作成日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals.map((goal) => (
            <TableRow key={goal.id}>
              <TableCell className="font-medium">
                {goal.user?.name || '-'}
              </TableCell>
              <TableCell>{goal.user?.department?.name || '-'}</TableCell>
              <TableCell>
                <span className="text-sm">{goal.goalCategory}</span>
              </TableCell>
              <TableCell className="max-w-xs">
                <div className="truncate" title={goal.title || goal.actionPlan}>
                  {goal.title || goal.actionPlan || '-'}
                </div>
              </TableCell>
              <TableCell>
                <GoalStatusBadge status={goal.status} />
              </TableCell>
              <TableCell className="text-right">{goal.weight}%</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(goal.createdAt).toLocaleDateString('ja-JP')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Testing:**
- [ ] Unit test: Table renders with goals
- [ ] Unit test: Empty state renders
- [ ] Visual test: Table layout
- [ ] Accessibility test: Table semantics

**Related Requirements:** FR-2 (Display All Goals), NFR-3 (Usability)
**Related Files:** `frontend/src/feature/evaluation/admin/admin-goal-list/components/AdminGoalListTable.tsx`

---

### Task 2.8: Write Frontend Tests
**Estimated Time:** 1.5 hours
**Assignee:** Frontend Developer
**Dependencies:** Tasks 2.1-2.7
**Priority:** HIGH
**Complexity:** Medium

**Description:**
Write comprehensive tests for all frontend components and hooks.

**Acceptance Criteria:**
- [ ] Unit tests for `useAdminGoalListData` hook (8+ tests)
- [ ] Unit tests for `AdminGoalListPage` component (5+ tests)
- [ ] Unit tests for `AdminGoalListFilters` component (5+ tests)
- [ ] Unit tests for `AdminGoalListTable` component (4+ tests)
- [ ] E2E tests for complete user flows (3+ tests)
- [ ] All tests pass
- [ ] Test coverage > 80% for new code

**Test Cases:**

```typescript
// Unit tests for hook
describe('useAdminGoalListData', () => {
  it('loads goals with batch optimization', async () => {});
  it('filters goals by status', () => {});
  it('filters goals by department', () => {});
  it('filters goals by user', () => {});
  it('paginates goals correctly', () => {});
  it('clears all filters', () => {});
  it('handles loading state', () => {});
  it('handles error state', () => {});
});

// E2E tests
test('admin can view and filter all goals', async ({ page }) => {
  // Login as admin
  // Navigate to /admin/goal-list
  // Verify goals are displayed
  // Apply filters
  // Verify filtered results
});

test('non-admin cannot access admin goal list', async ({ page }) => {
  // Login as employee
  // Attempt to access /admin/goal-list
  // Verify 403 or redirect
});
```

**Testing:**
- [ ] All tests pass
- [ ] Coverage report shows > 80%
- [ ] CI/CD pipeline passes

**Related Requirements:** All frontend requirements
**Related Files:** `frontend/src/feature/evaluation/admin/admin-goal-list/__tests__/`

---

## Phase 3: Integration and Polish

### Task 3.1: Add Navigation Link (Optional)
**Estimated Time:** 15 minutes
**Assignee:** Frontend Developer
**Dependencies:** Task 2.1
**Priority:** LOW
**Complexity:** Low

**Description:**
Add navigation link to admin goal list in sidebar (admin section).

**Acceptance Criteria:**
- [ ] Link appears in sidebar under "Admin" section
- [ ] Link only visible to admin users
- [ ] Link navigates to `/admin/goal-list`
- [ ] Active state styling works

**Implementation Details:**

```tsx
// File: frontend/src/components/display/sidebar.tsx (or similar)

// Add to admin section:
{isAdmin && (
  <SidebarItem
    href="/admin/goal-list"
    icon={<List className="h-4 w-4" />}
    label="管理者用目標一覧"
  />
)}
```

**Testing:**
- [ ] Manual test: Link appears for admin
- [ ] Manual test: Link hidden for non-admin
- [ ] Manual test: Navigation works

**Related Requirements:** FR-1 (Admin Access)
**Related Files:** `frontend/src/components/display/sidebar.tsx`

---

### Task 3.2: Performance Testing
**Estimated Time:** 1 hour
**Assignee:** QA / Developer
**Dependencies:** All implementation tasks
**Priority:** HIGH
**Complexity:** Low

**Description:**
Verify performance targets are met.

**Acceptance Criteria:**
- [ ] Initial page load < 2 seconds (with 500 goals)
- [ ] HTTP requests ≤ 3
- [ ] SQL queries ≤ 3
- [ ] Time to interactive < 2.5 seconds
- [ ] Filter response < 100ms
- [ ] Page navigation < 50ms
- [ ] Lighthouse score > 90

**Testing Procedure:**
1. Seed database with 500 goals
2. Open Chrome DevTools
3. Clear cache and hard reload
4. Measure Network tab metrics
5. Run Lighthouse audit
6. Test filter/pagination responsiveness
7. Document results

**Related Requirements:** NFR-1 (Performance)

---

### Task 3.3: Security Testing
**Estimated Time:** 30 minutes
**Assignee:** QA / Security Engineer
**Dependencies:** All implementation tasks
**Priority:** HIGH
**Complexity:** Low

**Description:**
Verify security controls are working correctly.

**Acceptance Criteria:**
- [ ] Non-admin users get 403 Forbidden
- [ ] Unauthenticated requests get 401 Unauthorized
- [ ] Organization scoping works (admin can't see other orgs)
- [ ] No PII in URL parameters
- [ ] Admin access is logged

**Testing Procedure:**
1. Test with admin user (should succeed)
2. Test with employee user (should get 403)
3. Test with no auth token (should get 401)
4. Test with admin from different org (should see no data)
5. Check audit logs

**Related Requirements:** NFR-2 (Security)

---

### Task 3.4: Documentation
**Estimated Time:** 1 hour
**Assignee:** Developer / Tech Writer
**Dependencies:** All implementation tasks
**Priority:** MEDIUM
**Complexity:** Low

**Description:**
Write user and technical documentation.

**Acceptance Criteria:**
- [ ] API documentation updated (OpenAPI/Swagger)
- [ ] Admin user guide created
- [ ] README updated with new feature
- [ ] Architecture decision recorded
- [ ] Code comments added to complex sections

**Deliverables:**
- API docs: Endpoint description, parameters, examples
- User guide: How to use admin goal list
- README: Feature announcement
- ADR: Why admin-only, why batch optimization

**Related Requirements:** Documentation requirements

---

## Phase 4: Deployment

### Task 4.1: Deploy to Staging
**Estimated Time:** 30 minutes
**Assignee:** DevOps / Developer
**Dependencies:** All implementation and testing tasks
**Priority:** HIGH
**Complexity:** Low

**Description:**
Deploy changes to staging environment for final testing.

**Acceptance Criteria:**
- [ ] Backend deployed to staging
- [ ] Frontend deployed to staging
- [ ] Database migrations run (if any)
- [ ] Feature works in staging
- [ ] Performance verified in staging
- [ ] Security verified in staging

**Related Requirements:** Deployment requirements

---

### Task 4.2: Deploy to Production
**Estimated Time:** 30 minutes
**Assignee:** DevOps / Developer
**Dependencies:** Task 4.1 (staging verification)
**Priority:** HIGH
**Complexity:** Low

**Description:**
Deploy changes to production environment.

**Acceptance Criteria:**
- [ ] Backend deployed to production
- [ ] Frontend deployed to production
- [ ] Feature works in production
- [ ] No errors in logs
- [ ] Performance metrics normal
- [ ] User feedback collected

**Related Requirements:** Deployment requirements

---

## Summary

### Total Effort Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Backend | 4 tasks | 6.0 hours |
| Phase 2: Frontend | 8 tasks | 9.5 hours |
| Phase 3: Integration | 4 tasks | 3.25 hours |
| Phase 4: Deployment | 2 tasks | 1.0 hour |
| **Total** | **18 tasks** | **19.75 hours** |

**Adjusted Estimate**: 10-13 hours (accounting for parallel work, reused code, developer experience)

---

### Task Dependencies

```
Backend Track:
Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4
  ↓
Task 2.2

Frontend Track (can start in parallel):
Task 2.1 (no dependencies)
Task 2.2 → Task 2.3 → Task 2.4 → Task 2.5 → Task 2.6 & 2.7 → Task 2.8

Integration (requires both tracks):
Tasks 3.1, 3.2, 3.3, 3.4 → Task 4.1 → Task 4.2
```

---

### Priority Matrix

| Priority | Tasks |
|----------|-------|
| **CRITICAL** | 1.1, 1.2, 1.3, 2.2, 2.3, 2.4, 2.5 |
| **HIGH** | 1.4, 2.1, 2.8, 3.2, 3.3, 4.1, 4.2 |
| **MEDIUM** | 2.6, 2.7, 3.4 |
| **LOW** | 3.1 |

---

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Status**: Planning Phase - Ready for Implementation
