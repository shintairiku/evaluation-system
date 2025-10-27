# Design Document: Admin Goal List Page (管理者用目標一覧)

## 1. Executive Summary

This document outlines the technical design for implementing an admin-only page that provides system-wide visibility of all goals across the organization. The design follows existing patterns from the employee goal-list page while extending functionality to support admin-level access and filtering.

**Key Design Principles:**
- **Reuse Existing Code**: Leverage `includeReviews` batch optimization from recent performance work
- **Follow Patterns**: Maintain consistency with existing admin pages
- **Security First**: Enforce admin-only access at both frontend and backend
- **Performance Optimized**: Support 500+ goals with < 2 second load time
- **Scalable Architecture**: Client-side filtering for smooth UX

**Technical Approach:**
- Backend: New admin endpoint `/api/org/{org_slug}/admin/goals`
- Backend: Extend `GoalService` with admin-scoped method
- Frontend: New route `/admin/goal-list` under `(admin)` group
- Frontend: Reuse components and hooks from employee goal-list
- Performance: Batch fetch with `includeReviews=true` (already implemented)

---

## 1.1 Comparison with Existing Goal Pages

### Overview of Goal-Related Pages

The system has three distinct goal pages, each serving different purposes:

| Page | Route | User Role | Purpose | View Type | Actions |
|------|-------|-----------|---------|-----------|---------|
| **Employee Goal List** | `/goal-list` | Employee / Supervisor | Manage own goals & view subordinates | Card (detailed) | Edit, Submit, Resubmit |
| **Supervisor Goal Review** | `/goal-review` | Supervisor | Approve subordinates' goals | Card (approval) | Approve, Reject |
| **Admin Goal List** ← NEW | `/admin/goal-list` | Admin | Monitor all goals | Table (summary) | None (read-only) |

### Detailed Comparison

#### 1. Employee Goal List (`/goal-list`)

**Current Implementation:**
- **File**: `frontend/src/feature/evaluation/employee/goal-list/display/index.tsx`
- **Hook**: `useGoalListData` hook
- **Permissions**:
  - Employee: `GOAL_READ_SELF` (own goals only)
  - Supervisor: `GOAL_READ_SELF` + `GOAL_READ_SUBORDINATES` (own + subordinates)
- **Backend Logic** (`goal_service.py` lines 548-581):
  ```python
  # Employee: return [current_user_id]
  # Supervisor: return [current_user_id] + subordinate_ids
  # Admin (WITHOUT userId param): return [current_user_id]  # Secure by default
  ```

**Features:**
- ✅ **View Type**: `GoalCard` - detailed card layout with full goal information
- ✅ **Actions**: Edit draft goals, submit, resubmit rejected goals
- ✅ **EmployeeSelector**: Supervisor can switch between subordinates (lines 216-224)
- ✅ **EmployeeInfoCard**: Shows selected employee info (lines 227-229)
- ✅ **Grouping**: Goals grouped by employee (`groupedGoals` - lines 221-247)
- ✅ **Filters**: Status, resubmissions only
- ✅ **Performance**: Uses `includeReviews=true` optimization

**Use Cases:**
- Employee manages their own goals
- Supervisor reviews subordinates' goals (read-only, no approval here)
- Supervisor can edit their own goals

---

#### 2. Supervisor Goal Review (`/goal-review`)

**Current Implementation:**
- **File**: `frontend/src/feature/evaluation/superviser/goal-review/display/index.tsx`
- **Components**: `GoalApprovalCard`, `ApprovalForm`, `ActionButtons`
- **Permissions**: `GOAL_APPROVE` (supervisors and above)

**Features:**
- ✅ **View Type**: `GoalApprovalCard` - detailed view with approval form
- ✅ **Actions**: Approve or Reject goals with feedback
- ✅ **Status Filter**: Only shows `submitted` goals (awaiting approval)
- ✅ **Employee Navigation**: Tabs to switch between subordinates
- ✅ **Guidelines**: `ApprovalGuidelinesPanel` with approval criteria

**Use Cases:**
- Supervisor approves/rejects subordinates' submitted goals
- Focused workflow for goal approval process

---

#### 3. Admin Goal List (`/admin/goal-list`) ← **NEW**

**Planned Implementation:**
- **File**: `frontend/src/feature/evaluation/admin/admin-goal-list/display/index.tsx`
- **Hook**: `useAdminGoalListData` (new, similar to `useGoalListData`)
- **Permission**: `GOAL_READ_ALL` (admin only)
- **Backend**: New endpoint `/admin/goals` with dedicated service method

**Features:**
- 🆕 **View Type**: `AdminGoalListTable` - table layout for system-wide overview
- 🆕 **Actions**: **None** (read-only, no editing or approving)
- 🆕 **Filters**: Status, Category, Department, User (more comprehensive than employee view)
- 🆕 **EmployeeInfoCard**: Shows when specific user is selected (reuse from goal-list)
- 🆕 **Scope**: ALL users in organization (not limited to subordinates)
- 🆕 **Performance**: Reuses `includeReviews=true` optimization
- 🆕 **Pagination**: Client-side, 50 items per page

**Key Differences from Employee Goal List:**

| Aspect | Employee Goal List | Admin Goal List |
|--------|-------------------|-----------------|
| **Backend Endpoint** | `/goals` (existing) | `/admin/goals` (new) |
| **Service Method** | `get_goals()` with user filtering | `get_all_goals_for_admin()` - NO user filtering |
| **Default Scope** | Own goals / subordinates | ALL users |
| **View Type** | Card (detailed) | Table (summary) |
| **Actions** | Edit, Submit, Resubmit | **None** (read-only) |
| **Filters** | Status, Resubmissions | Status, Category, Dept, User |
| **Employee Selection** | `EmployeeSelector` (supervisor) | User filter (admin) |
| **Grouping** | By employee | Flat list, sortable |
| **Purpose** | Goal management | System monitoring |

**Use Cases:**
- Admin monitors goal submission rates across organization
- Admin identifies bottlenecks in approval process
- Admin analyzes goal patterns by department
- Admin ensures compliance (all employees have goals)

---

### Why Three Separate Pages?

**Separation of Concerns:**
1. **Employee Goal List**: Personal goal management + subordinate visibility
2. **Supervisor Goal Review**: Focused approval workflow
3. **Admin Goal List**: System-wide monitoring and analytics

**Benefits:**
- ✅ Clear user intent for each page
- ✅ Optimized UI for specific tasks
- ✅ Security: Different permission levels
- ✅ Performance: Each page loads only necessary data
- ✅ UX: No confusion between manage vs approve vs monitor

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /admin/goal-list (Page)                               │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  AdminGoalListPage Component                     │ │ │
│  │  │  ├─ Header + Period Selector                     │ │ │
│  │  │  ├─ AdminGoalListFilters (status, dept, user)    │ │ │
│  │  │  ├─ AdminGoalListTable (display goals)           │ │ │
│  │  │  └─ Pagination Controls                          │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │  useAdminGoalListData Hook                              │ │
│  │  ├─ Load periods, departments, users                   │ │
│  │  ├─ Load goals with embedded reviews                   │ │
│  │  ├─ Client-side filtering                              │ │
│  │  └─ Client-side pagination                             │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP/JSON
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                        Backend                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Layer: /api/v1/admin.py                          │ │
│  │  GET /api/org/{org_slug}/admin/goals                  │ │
│  │  ├─ Auth: Require valid Clerk token                   │ │
│  │  ├─ Permission: Check GOAL_READ_ALL                   │ │
│  │  ├─ Org Scope: Extract org_id from context            │ │
│  │  └─ Call: GoalService.get_all_goals_for_admin()       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Service Layer: goal_service.py                        │ │
│  │  get_all_goals_for_admin()                            │ │
│  │  ├─ Search goals (no user_ids filter = ALL users)    │ │
│  │  ├─ Batch fetch reviews (includeReviews optimization)│ │
│  │  ├─ Enrich with user/department info                 │ │
│  │  └─ Return paginated response                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Repository Layer: goal_repo.py                        │ │
│  │  search_goals(user_ids=None) ← ALL USERS             │ │
│  │  ├─ SELECT * FROM goals WHERE org_id = ?             │ │
│  │  ├─ Optional: JOIN users, departments                │ │
│  │  └─ Optional: Filter by period, status, category     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Database: PostgreSQL (Supabase)                       │ │
│  │  ├─ goals table                                        │ │
│  │  ├─ users table                                        │ │
│  │  ├─ departments table                                  │ │
│  │  └─ supervisor_reviews table                           │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Sequence

```
┌────────┐          ┌──────────┐          ┌─────────┐          ┌──────────┐
│ Admin  │          │ Frontend │          │ Backend │          │ Database │
│ User   │          │  React   │          │ FastAPI │          │ Postgres │
└────┬───┘          └─────┬────┘          └────┬────┘          └────┬─────┘
     │                    │                    │                    │
     │ 1. Navigate to     │                    ���                    │
     │    /admin/goal-list│                    │                    │
     ├───────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │ 2. useAdminGoalListData()               │
     │                    │    - Load periods  │                    │
     │                    │    - Load users    │                    │
     │                    ├───────────────────>│                    │
     │                    │                    │                    │
     │                    │ 3. getAdminGoalsAction()                │
     │                    │    includeReviews=true                  │
     │                    ├───────────────────>│                    │
     │                    │                    │                    │
     │                    │                    │ 4. Check auth      │
     │                    │                    │    Check GOAL_READ_ALL
     │                    │                    │                    │
     │                    │                    │ 5. get_all_goals_for_admin()
     │                    │                    ├───────────────────>│
     │                    │                    │                    │
     │                    │                    │ 6. SELECT goals    │
     │                    │                    │    WHERE org_id=?  │
     │                    │                    │    (no user filter)│
     │                    │                    │<───────────────────┤
     │                    │                    │                    │
     │                    │                    │ 7. SELECT reviews  │
     │                    │                    │    WHERE goal_id IN (...)
     │                    │                    │    (batch fetch)   │
     │                    │                    │<───────────────────┤
     │                    │                    │                    │
     │                    │ 8. Return goals    │                    │
     │                    │    with embedded   │                    │
     │                    │    reviews         │                    │
     │                    │<───────────────────┤                    │
     │                    │                    │                    │
     │                    │ 9. Client-side filter                   │
     │                    │    by status/dept  │                    │
     │                    │                    │                    │
     │ 10. Display goals  │                    │                    │
     │     in table       │                    │                    │
     │<───────────────────┤                    │                    │
```

---

## 3. Backend Design

### 3.1 API Endpoint Specification

**Endpoint**: `GET /api/org/{org_slug}/admin/goals`

**Purpose**: Retrieve all goals across the organization for admin visualization

**Authentication**: Required (Clerk token)

**Authorization**: Admin role only (`GOAL_READ_ALL` permission)

**Request**:

```http
GET /api/org/my-company/admin/goals?periodId={period_id}&status=submitted&includeReviews=true
Authorization: Bearer {clerk_token}
```

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `periodId` | UUID | No | Current period | Filter by evaluation period |
| `userId` | UUID | No | All users | Filter by specific user |
| `departmentId` | UUID | No | All depts | Filter by department |
| `goalCategory` | string | No | All | Filter by category (業績目標, コンピテンシー) |
| `status` | string[] | No | All | Filter by status (draft, submitted, approved, rejected) |
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 50 | Items per page |
| `includeReviews` | boolean | No | true | Include supervisor reviews (batch fetch) |
| `includeRejectionHistory` | boolean | No | false | Include rejection history chain |

**Response** (200 OK):

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "660e8400-e29b-41d4-a716-446655440000",
      "periodId": "770e8400-e29b-41d4-a716-446655440000",
      "goalCategory": "業績目標",
      "status": "submitted",
      "weight": 30.0,
      "title": "売上目標の達成",
      "specificGoalText": "2024年度の売上を前年比20%増加させる",
      "achievementCriteriaText": "売上1億円を達成",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-20T10:30:00Z",

      // Embedded user info
      "user": {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "name": "田中太郎",
        "email": "tanaka@example.com",
        "departmentId": "880e8400-e29b-41d4-a716-446655440000",
        "department": {
          "id": "880e8400-e29b-41d4-a716-446655440000",
          "name": "営業部",
          "displayOrder": 1
        }
      },

      // Embedded supervisor review (if includeReviews=true)
      "supervisorReview": {
        "id": "990e8400-e29b-41d4-a716-446655440000",
        "goalId": "550e8400-e29b-41d4-a716-446655440000",
        "reviewerId": "aa0e8400-e29b-41d4-a716-446655440000",
        "action": "approved",
        "comment": "目標は適切です。承認します。",
        "reviewedAt": "2024-01-21T14:00:00Z"
      }
    },
    // ... more goals
  ],
  "total": 237,
  "page": 1,
  "limit": 50,
  "pages": 5
}
```

**Error Responses**:

| Status | Description | Response Body |
|--------|-------------|---------------|
| 401 Unauthorized | Invalid or missing auth token | `{"detail": "Authentication required"}` |
| 403 Forbidden | Non-admin user | `{"detail": "Admin role required to access all goals"}` |
| 404 Not Found | Organization not found | `{"detail": "Organization not found"}` |
| 500 Internal Server Error | Server error | `{"detail": "Error fetching goals: {error}"}` |

---

### 3.2 Backend Implementation

#### 3.2.1 API Endpoint

**File**: `backend/app/api/v1/admin.py`

```python
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
    period_id: Optional[UUID] = Query(None, alias="periodId", description="Filter by evaluation period"),
    user_id: Optional[UUID] = Query(None, alias="userId", description="Filter by specific user"),
    department_id: Optional[UUID] = Query(None, alias="departmentId", description="Filter by department"),
    goal_category: Optional[str] = Query(None, alias="goalCategory", description="Filter by category"),
    status: Optional[List[str]] = Query(None, description="Filter by status"),
    include_reviews: bool = Query(
        True,
        alias="includeReviews",
        description="Include supervisor reviews (batch optimization)"
    ),
    include_rejection_history: bool = Query(
        False,
        alias="includeRejectionHistory",
        description="Include rejection history chain"
    ),
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get all goals for admin visualization (admin-only endpoint).

    This endpoint provides system-wide visibility of all goals across the organization.
    Only users with admin role (GOAL_READ_ALL permission) can access this endpoint.

    Performance:
    - Uses includeReviews=true by default for batch fetch optimization
    - Leverages existing N+1 query optimization
    - Supports pagination for large datasets

    Access Control:
    - Requires admin role (GOAL_READ_ALL permission)
    - Organization-scoped (admin sees only their org's goals)

    Returns:
    - Paginated list of all goals with user and department information
    - Optional embedded supervisor reviews
    """
    # Permission check: Admin only
    if not context.has_permission(Permission.GOAL_READ_ALL):
        logger.warning(
            f"Non-admin user {context.user_id} attempted to access admin goals endpoint"
        )
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Admin role required to access all goals"
        )

    # Validate parameter combination
    if include_rejection_history and not include_reviews:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="includeRejectionHistory requires includeReviews=true"
        )

    try:
        service = GoalService(session)

        # Call admin-scoped service method
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

#### 3.2.2 Service Layer

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
    Get all goals for admin visualization (bypasses user-level permission filtering).

    This method is designed for admin-only endpoints and returns all goals
    in the organization without user-based access restrictions.

    SECURITY NOTE: This method should ONLY be called from permission-protected
    endpoints (e.g., /admin/goals with GOAL_READ_ALL check).

    Performance:
    - Reuses existing batch review fetching optimization (includeReviews)
    - Single SQL query for goals, single query for reviews
    - Client-side pagination in frontend for smooth UX

    Args:
        org_id: Organization ID (required)
        period_id: Filter by evaluation period (optional)
        user_id: Filter by specific user (optional)
        department_id: Filter by department (optional, NEW)
        goal_category: Filter by category (optional)
        status: Filter by status list (optional)
        pagination: Pagination parameters (optional)
        include_reviews: Batch fetch supervisor reviews (default: True)
        include_rejection_history: Fetch rejection history chain (default: False)

    Returns:
        PaginatedResponse containing goals with embedded user/department info
    """
    try:
        logger.info(
            f"Admin fetching goals: org={org_id}, period={period_id}, "
            f"user={user_id}, dept={department_id}, include_reviews={include_reviews}"
        )

        # Search goals with filters
        # user_ids=None means ALL users (admin scope)
        goals = await self.goal_repo.search_goals(
            org_id=org_id,
            user_ids=None,  # ← KEY: None = all users
            period_id=period_id,
            department_id=department_id,  # NEW: filter by department
            goal_category=goal_category,
            status=status,
            pagination=pagination
        )

        # Get total count for pagination
        total_count = await self.goal_repo.count_goals(
            org_id=org_id,
            user_ids=None,  # ← KEY: None = all users
            period_id=period_id,
            department_id=department_id,  # NEW
            goal_category=goal_category,
            status=status
        )

        # Batch fetch supervisor reviews if requested (performance optimization)
        reviews_map = {}
        if include_reviews and goals:
            goal_ids = [goal.id for goal in goals]
            reviews_map = await self.supervisor_review_repo.get_by_goals_batch(
                goal_ids=goal_ids,
                org_id=org_id
            )
            logger.info(f"Batch fetched {len(reviews_map)} reviews for {len(goal_ids)} goals")

        # Batch fetch rejection histories if requested
        rejection_histories_map = {}
        if include_rejection_history and goals:
            rejection_histories_map = await self._get_rejection_histories_batch(
                goals=goals,
                org_id=org_id
            )

        # Enrich goal data with user, department, and review info
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

        # Create paginated response
        if pagination:
            total_pages = (total_count + pagination.limit - 1) // pagination.limit
        else:
            total_pages = 1

        logger.info(
            f"Admin goals fetch complete: {len(enriched_goals)} goals, "
            f"total: {total_count}, page: {pagination.page if pagination else 1}"
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

#### 3.2.3 Repository Layer (Enhancement)

**File**: `backend/app/database/repositories/goal_repo.py` (update existing methods)

```python
async def search_goals(
    self,
    org_id: str,
    user_ids: Optional[List[UUID]] = None,  # ← None = all users
    period_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,  # ← NEW parameter
    goal_category: Optional[str] = None,
    status: Optional[List[str]] = None,
    pagination: Optional[PaginationParams] = None
) -> List[GoalModel]:
    """
    Search goals with optional filters.

    NEW: Supports department filtering via JOIN with users table

    Args:
        user_ids: List of user IDs to filter by. If None, returns goals for ALL users.
                  This is used for admin-level queries.
        department_id: NEW - Filter by department ID
    """
    from ..models.user import User  # Import here to avoid circular dependency

    query = select(GoalModel).where(GoalModel.org_id == org_id)

    # Filter by user IDs (if provided)
    if user_ids is not None:  # ← Check for None explicitly
        query = query.where(GoalModel.user_id.in_(user_ids))

    # NEW: Filter by department (requires JOIN with users table)
    if department_id:
        query = (
            query
            .join(User, GoalModel.user_id == User.id)
            .where(User.department_id == department_id)
        )

    # Filter by evaluation period
    if period_id:
        query = query.where(GoalModel.period_id == period_id)

    # Filter by goal category
    if goal_category:
        query = query.where(GoalModel.goal_category == goal_category)

    # Filter by status
    if status and len(status) > 0:
        query = query.where(GoalModel.status.in_(status))

    # Order by created_at DESC (newest first)
    query = query.order_by(GoalModel.created_at.desc())

    # Apply pagination
    if pagination:
        offset = (pagination.page - 1) * pagination.limit
        query = query.offset(offset).limit(pagination.limit)

    result = await self.session.execute(query)
    return result.scalars().all()


async def count_goals(
    self,
    org_id: str,
    user_ids: Optional[List[UUID]] = None,  # ← None = all users
    period_id: Optional[UUID] = None,
    department_id: Optional[UUID] = None,  # ← NEW parameter
    goal_category: Optional[str] = None,
    status: Optional[List[str]] = None
) -> int:
    """
    Count goals matching filters.

    NEW: Supports department filtering via JOIN with users table
    """
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

    if period_id:
        query = query.where(GoalModel.period_id == period_id)

    if goal_category:
        query = query.where(GoalModel.goal_category == goal_category)

    if status and len(status) > 0:
        query = query.where(GoalModel.status.in_(status))

    result = await self.session.execute(query)
    return result.scalar() or 0
```

---

## 4. Frontend Design

### 4.1 Component Architecture

```
/admin/goal-list (Route)
│
├─ AdminGoalListPage (Main Component)
│  ├─ Header
│  │  ├─ Title: "管理者用目標一覧"
│  │  ├─ Goal Count: "全ユーザーの目標を表示 (237件)"
│  │  └─ EvaluationPeriodSelector (reuse existing)
│  │
│  ├─ AdminGoalListFilters (Filter Bar)
│  │  ├─ Status Filter (multi-select)
│  │  ├─ Category Filter (dropdown)
│  │  ├─ Department Filter (dropdown)
│  │  ├─ User Filter (searchable dropdown)
│  │  ├─ Active Filter Badge: "3 active filters"
│  │  └─ Clear All Button
│  │
│  ├─ AdminGoalListTable (Desktop) / AdminGoalListCards (Mobile)
│  │  ├─ Table Columns:
│  │  │  ├─ User Name (sortable)
│  │  │  ├─ Department (sortable)
│  │  │  ├─ Category (filterable)
│  │  │  ├─ Title/Content (truncated)
│  │  │  ├─ Status Badge (color-coded)
│  │  │  ├─ Weight %
│  │  │  └─ Created Date (sortable)
│  │  │
│  │  └─ Row Actions:
│  │     └─ View Details (future: modal or side panel)
│  │
│  └─ Pagination Controls
│     ├─ Previous / Next buttons
│     ├─ Page numbers: [1] [2] [3] ... [10]
│     └─ Count: "Showing 1-50 of 237 goals"
│
├─ useAdminGoalListData (Custom Hook)
│  ├─ Load evaluation periods
│  ├─ Load departments
│  ├─ Load users
│  ├─ Load goals with embedded reviews (includeReviews=true)
│  ├─ Client-side filtering
│  ├─ Client-side sorting
│  └─ Client-side pagination
│
└─ getAdminGoalsAction (Server Action)
   └─ Call: goalsApi.getAdminGoals()
```

### 4.2 File Structure

```
frontend/src/
├─ app/(evaluation)/(admin)/
│  └─ admin-goal-list/
│     └─ page.tsx                    ← Route entry point
│
├─ feature/evaluation/admin/
│  └─ admin-goal-list/
│     ├─ display/
│     │  └─ index.tsx               ← Main AdminGoalListPage component
│     │
│     ├─ components/
│     │  ├─ AdminGoalListTable.tsx  ← Desktop table view
│     │  ├─ AdminGoalListCards.tsx  ← Mobile card view (optional)
│     │  ├─ AdminGoalListFilters.tsx ← Filter bar component
│     │  └─ AdminGoalTableRow.tsx   ← Individual row component
│     │
│     └─ hooks/
│        └─ useAdminGoalListData.ts ← Data management hook
│
├─ api/
│  ├─ endpoints/goals.ts            ← Add getAdminGoals() method
│  └─ server-actions/goals.ts       ← Add getAdminGoalsAction()
│
└─ components/
   ├─ ui/ (existing shadcn components)
   └─ evaluation/ (reusable components)
      ├─ GoalStatusBadge.tsx        ← ✅ REUSE existing
      ├─ EvaluationPeriodSelector.tsx ← ✅ REUSE existing
      └─ EmployeeInfoCard.tsx       ← ✅ REUSE existing (show when user selected)
```

---

### 4.2.1 Component Reuse Strategy

To maximize code reuse and maintain consistency, the admin goal list will reuse the following existing components:

| Component | Source | Usage in Admin Goal List | Changes Needed |
|-----------|--------|-------------------------|----------------|
| **EvaluationPeriodSelector** | `@/components/evaluation/` | Period selection in header | ✅ None (use as-is) |
| **GoalStatusBadge** | `@/components/evaluation/` | Status display in table | ✅ None (use as-is) |
| **EmployeeInfoCard** | `@/components/evaluation/` | Show when user filter selected | ✅ None (use as-is) |
| **GoalListFilters** (patterns) | `@/feature/evaluation/employee/goal-list/components/` | Base structure for AdminGoalListFilters | ⚠️ Adapt (add dept/user filters) |
| **EmployeeSelector** (patterns) | `@/feature/evaluation/employee/goal-list/components/` | User filter dropdown | ⚠️ Adapt (convert to filter) |
| **Loading Skeletons** | Existing goal-list | Loading states | ✅ Reuse patterns |
| **Error/Empty States** | Existing goal-list | Error handling | ✅ Reuse patterns |

**New Components Needed:**
- `AdminGoalListTable.tsx` - Table view (not in existing goal-list which uses cards)
- `AdminGoalListFilters.tsx` - Extended filters (dept + user filters)

---

### 4.3 Key Components

#### 4.3.1 Main Page Component

**File**: `frontend/src/feature/evaluation/admin/admin-goal-list/display/index.tsx`

```tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useAdminGoalListData } from '../hooks/useAdminGoalListData';
import { AdminGoalListTable } from '../components/AdminGoalListTable';
import { AdminGoalListFilters } from '../components/AdminGoalListFilters';
import { EvaluationPeriodSelector } from '@/components/evaluation/EvaluationPeriodSelector';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard'; // ← REUSE
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Admin Goal List Page - System-wide goal visualization
 *
 * Features:
 * - View all goals from all users across organization
 * - Filter by period, status, category, department, user
 * - Sort and paginate results
 * - Read-only (no editing or approval)
 * - Shows EmployeeInfoCard when specific user is selected (similar to supervisor view)
 *
 * Access Control:
 * - Admin only (enforced by backend)
 * - Frontend shows 403 error if non-admin attempts access
 *
 * Performance:
 * - Reuses includeReviews batch optimization
 * - Client-side filtering and pagination for smooth UX
 * - Loads all filtered data at once (up to 1000 goals)
 *
 * Component Reuse:
 * - EvaluationPeriodSelector (existing)
 * - EmployeeInfoCard (existing, from goal-list)
 * - GoalStatusBadge (existing, used in table)
 */
export default function AdminGoalListPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const {
    goals,
    filteredGoals,
    paginatedGoals,
    isLoading,
    error,
    currentPeriod,
    allPeriods,
    selectedStatuses,
    selectedCategory,
    selectedDepartmentId,
    selectedUserId,
    currentPage,
    totalPages,
    itemsPerPage,
    setSelectedStatuses,
    setSelectedCategory,
    setSelectedDepartmentId,
    setSelectedUserId,
    setCurrentPage,
    clearAllFilters,
    refetch,
  } = useAdminGoalListData({ selectedPeriodId: selectedPeriodId || undefined });

  // Initialize period to current
  React.useEffect(() => {
    if (!selectedPeriodId && currentPeriod) {
      setSelectedPeriodId(currentPeriod.id);
    }
  }, [currentPeriod, selectedPeriodId]);

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-9 w-80 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="h-32 bg-gray-100 rounded-lg animate-pulse"></div>
          <div className="h-96 bg-gray-100 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              再読み込み
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Calculate active filter count
  const activeFilterCount = [
    selectedStatuses.length > 0,
    selectedCategory !== '',
    selectedDepartmentId !== '',
    selectedUserId !== ''
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">管理者用目標一覧</h1>
            <p className="text-sm text-muted-foreground mt-1">
              全ユーザーの目標を表示 ({filteredGoals.length}件
              {goals.length !== filteredGoals.length && ` / 全${goals.length}件`})
            </p>
          </div>
          <EvaluationPeriodSelector
            periods={allPeriods}
            selectedPeriodId={selectedPeriodId}
            currentPeriodId={currentPeriod?.id || null}
            onPeriodChange={setSelectedPeriodId}
            isLoading={isLoading}
          />
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4">
          <AdminGoalListFilters
            selectedStatuses={selectedStatuses}
            selectedCategory={selectedCategory}
            selectedDepartmentId={selectedDepartmentId}
            selectedUserId={selectedUserId}
            onStatusChange={setSelectedStatuses}
            onCategoryChange={setSelectedCategory}
            onDepartmentChange={setSelectedDepartmentId}
            onUserChange={setSelectedUserId}
            activeFilterCount={activeFilterCount}
            onClearAll={clearAllFilters}
          />
        </div>

        {/* Empty State */}
        {filteredGoals.length === 0 && (
          <div className="text-center py-12 bg-card border rounded-lg">
            <p className="text-muted-foreground">
              {activeFilterCount > 0
                ? '該当する目標がありません'
                : '目標が設定されていません'}
            </p>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="mt-4"
              >
                フィルターをリセット
              </Button>
            )}
          </div>
        )}

        {/* Goals Table */}
        {filteredGoals.length > 0 && (
          <>
            <AdminGoalListTable goals={paginatedGoals} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, filteredGoals.length)} of{' '}
                  {filteredGoals.length} goals
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    )
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-2 py-1">...</span>
                        )}
                        <Button
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </React.Fragment>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

#### 4.3.2 Data Hook

**File**: `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAdminGoalsAction } from '@/api/server-actions/goals';
import { getCategorizedEvaluationPeriodsAction } from '@/api/server-actions/evaluation-periods';
import { getDepartmentsAction } from '@/api/server-actions/departments';
import { getUsersAction } from '@/api/server-actions/users';
import type { GoalResponse, GoalStatus, EvaluationPeriod, Department, UserDetailResponse } from '@/api/types';

/**
 * Custom hook for admin goal list data management
 *
 * Performance optimization:
 * - Reuses includeReviews=true batch fetching from goal-list optimization
 * - Loads all filtered data at once (up to reasonable limit)
 * - Client-side filtering, sorting, and pagination for smooth UX
 *
 * @param params.selectedPeriodId - Optional period ID to filter by
 */
export function useAdminGoalListData(params?: { selectedPeriodId?: string }) {
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPeriod, setCurrentPeriod] = useState<EvaluationPeriod | null>(null);
  const [allPeriods, setAllPeriods] = useState<EvaluationPeriod[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserDetailResponse[]>([]);

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<GoalStatus[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  /**
   * Load goal data from server
   * Uses includeReviews=true for batch optimization (1 request instead of N+1)
   */
  const loadGoalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load supporting data in parallel
      const [periodResult, departmentResult, usersResult] = await Promise.all([
        getCategorizedEvaluationPeriodsAction(),
        getDepartmentsAction(),
        getUsersAction()
      ]);

      // Set supporting data
      if (periodResult.success && periodResult.data) {
        setCurrentPeriod(periodResult.data.current || null);
        setAllPeriods(periodResult.data.all || []);
      }

      if (departmentResult.success && departmentResult.data?.items) {
        setDepartments(departmentResult.data.items);
      }

      if (usersResult.success && usersResult.data?.items) {
        setUsers(usersResult.data.items);
      }

      // Determine period to use
      const periodToUse = params?.selectedPeriodId
        ? periodResult.data?.all.find(p => p.id === params.selectedPeriodId)
        : periodResult.data?.current;

      if (!periodToUse) {
        setError(params?.selectedPeriodId ? '選択された評価期間が見つかりません' : '評価期間が設定されていません');
        setGoals([]);
        return;
      }

      // Fetch all goals with batch optimization
      // includeReviews=true reuses the N+1 query optimization
      const goalsResult = await getAdminGoalsAction({
        periodId: periodToUse.id,
        limit: 1000, // Higher limit for admin view (all goals at once)
        includeReviews: true, // ← PERFORMANCE OPTIMIZATION
      });

      if (!goalsResult.success || !goalsResult.data?.items) {
        setError(goalsResult.error || '目標の読み込みに失敗しました');
        return;
      }

      setGoals(goalsResult.data.items);
    } catch (err) {
      console.error('Error loading admin goal data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [params?.selectedPeriodId]);

  /**
   * Client-side filtering (for smooth UX)
   */
  const filteredGoals = useMemo(() => {
    let result = goals;

    // Filter by status
    if (selectedStatuses.length > 0) {
      result = result.filter(g => selectedStatuses.includes(g.status));
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter(g => g.goalCategory === selectedCategory);
    }

    // Filter by department
    if (selectedDepartmentId) {
      result = result.filter(g => g.user?.departmentId === selectedDepartmentId);
    }

    // Filter by user
    if (selectedUserId) {
      result = result.filter(g => g.userId === selectedUserId);
    }

    return result;
  }, [goals, selectedStatuses, selectedCategory, selectedDepartmentId, selectedUserId]);

  /**
   * Client-side pagination
   */
  const paginatedGoals = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredGoals.slice(startIndex, endIndex);
  }, [filteredGoals, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredGoals.length / itemsPerPage);

  /**
   * Clear all filters
   */
  const clearAllFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedCategory('');
    setSelectedDepartmentId('');
    setSelectedUserId('');
    setCurrentPage(1);
  }, []);

  /**
   * Reset page to 1 when filters change
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatuses, selectedCategory, selectedDepartmentId, selectedUserId]);

  /**
   * Load data on mount and when period changes
   */
  useEffect(() => {
    loadGoalData();
  }, [loadGoalData]);

  return {
    goals,
    filteredGoals,
    paginatedGoals,
    isLoading,
    error,
    currentPeriod,
    allPeriods,
    departments,
    users,
    selectedStatuses,
    selectedCategory,
    selectedDepartmentId,
    selectedUserId,
    currentPage,
    totalPages,
    itemsPerPage,
    setSelectedStatuses,
    setSelectedCategory,
    setSelectedDepartmentId,
    setSelectedUserId,
    setCurrentPage,
    clearAllFilters,
    refetch: loadGoalData,
  };
}
```

---

## 5. Security Design

### 5.1 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Authentication (Clerk)                             │
│ ✓ Valid JWT token required                                  │
│ ✓ Organization context extracted from token                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Authorization (RBAC)                               │
│ ✓ Check GOAL_READ_ALL permission                            │
│ ✓ Only admin role has this permission                       │
│ ✓ 403 Forbidden if permission denied                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Organization Scoping                               │
│ ✓ Filter goals by org_id from auth context                  │
│ ✓ Admin cannot see other organizations' data                │
│ ✓ Enforced at repository layer                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Frontend Protection (UX only, not security)        │
│ ✓ Hide navigation link from non-admins                      │
│ ✓ Client-side role check for early feedback                 │
│ ✓ NOT relied upon for security (backend enforces)           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Security Checklist

- [x] **Authentication**: Clerk JWT validation on every request
- [x] **Authorization**: `GOAL_READ_ALL` permission check in endpoint
- [x] **Organization Scoping**: Filter by `org_id` from auth context (NOT from query params)
- [x] **No Sensitive Data in URLs**: No PII in query parameters
- [x] **Input Validation**: Validate all query parameters (UUID format, enum values)
- [x] **Error Handling**: Generic error messages (no internal details leaked)
- [x] **Audit Logging**: Log admin access attempts (success and failure)
- [x] **Rate Limiting**: Respect existing API rate limits
- [x] **HTTPS Only**: All traffic over HTTPS (enforced by infrastructure)

---

## 6. Performance Optimization Strategy

### 6.1 Optimization Techniques

| Technique | Implementation | Benefit |
|-----------|----------------|---------|
| **Batch Review Fetching** | Reuse `includeReviews=true` from existing optimization | 95% fewer HTTP requests (20-50 → 1-2) |
| **Client-Side Filtering** | Filter loaded data in React state | Instant filter updates, no server round-trips |
| **Client-Side Pagination** | Paginate in memory | Smooth page transitions, no loading delays |
| **Memoization** | `useMemo` for filtered/paginated data | Prevent unnecessary recalculations |
| **Debounced Search** | 300ms debounce on user search | Reduce re-renders during typing |
| **Loading Skeletons** | Skeleton UI during data load | Perceived performance improvement |
| **Cached Supporting Data** | Cache periods, departments (rarely change) | Reduce redundant API calls |

### 6.2 Performance Metrics & Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Initial Page Load | < 2 seconds | Chrome DevTools Network tab |
| HTTP Requests | ≤ 3 | DevTools Network tab (periods, users, goals) |
| SQL Queries | ≤ 3 | Backend logs (goals, reviews, counts) |
| Time to Interactive | < 2.5 seconds | Lighthouse performance audit |
| Filter/Sort Response | < 100ms | Client-side, no API call |
| Page Navigation | < 50ms | Client-side pagination |
| Bundle Size Impact | < 50KB | Webpack analyzer |

### 6.3 Scalability Considerations

**Current Design (500-1000 goals)**:
- Load all goals at once
- Client-side filtering/pagination
- Smooth UX, no loading delays

**Future Enhancement (1000+ goals)**:
- Implement server-side pagination
- Add query parameter: `?page=1&limit=50`
- Backend returns paginated subset
- Trade-off: Server round-trips for filter changes

**Decision Point**: If organizations consistently have > 1000 goals, switch to server-side pagination

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Backend Tests** (`backend/tests/api/test_admin.py`):
```python
async def test_admin_goals_endpoint_requires_authentication():
    """Test that endpoint requires valid authentication"""

async def test_admin_goals_endpoint_requires_admin_permission():
    """Test that non-admin users get 403 Forbidden"""

async def test_admin_can_fetch_all_goals():
    """Test that admin users can fetch all goals"""

async def test_admin_goals_filtered_by_organization():
    """Test that admin only sees their org's goals"""

async def test_admin_goals_department_filter():
    """Test filtering by department"""

async def test_admin_goals_includes_user_and_department_info():
    """Test that response includes user and department data"""

async def test_admin_goals_uses_batch_review_optimization():
    """Test that includeReviews=true fetches reviews efficiently"""
```

**Frontend Tests** (`frontend/src/feature/evaluation/admin/admin-goal-list/__tests__/`):
```tsx
describe('useAdminGoalListData', () => {
  it('loads goals with batch optimization', async () => {
    // Test that includeReviews=true is used
  });

  it('filters goals by status', () => {
    // Test client-side status filtering
  });

  it('filters goals by department', () => {
    // Test department filtering
  });

  it('paginates goals correctly', () => {
    // Test client-side pagination
  });

  it('clears all filters', () => {
    // Test clearAllFilters function
  });
});

describe('AdminGoalListPage', () => {
  it('renders table with goals', () => {
    // Test table rendering
  });

  it('shows loading skeleton', () => {
    // Test loading state
  });

  it('shows error state', () => {
    // Test error handling
  });

  it('shows empty state when no goals', () => {
    // Test empty state
  });
});
```

### 7.2 Integration Tests

**End-to-End Tests** (Playwright):
```typescript
test('admin can view all goals', async ({ page }) => {
  // Login as admin
  await loginAsAdmin(page);

  // Navigate to admin goal list
  await page.goto('/admin/goal-list');

  // Verify page loads
  await expect(page.getByRole('heading', { name: '管理者用目標一覧' })).toBeVisible();

  // Verify goals are displayed
  const table = page.getByRole('table');
  await expect(table).toBeVisible();

  // Verify goal count
  const count = await table.getByRole('row').count();
  expect(count).toBeGreaterThan(0);
});

test('non-admin cannot access admin goal list', async ({ page }) => {
  // Login as employee
  await loginAsEmployee(page);

  // Attempt to navigate to admin goal list
  await page.goto('/admin/goal-list');

  // Verify 403 error or redirect
  await expect(page.getByText('Access Denied')).toBeVisible();
});

test('admin can filter goals by status', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/goal-list');

  // Select "submitted" status filter
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'submitted' }).click();

  // Verify filtered results
  const rows = page.getByRole('row');
  for (const row of await rows.all()) {
    const statusBadge = row.getByTestId('status-badge');
    await expect(statusBadge).toHaveText('submitted');
  }
});
```

### 7.3 Performance Tests

```typescript
test('admin goal list loads in < 2 seconds', async ({ page }) => {
  await loginAsAdmin(page);

  const start = Date.now();
  await page.goto('/admin/goal-list');
  await page.waitForSelector('table');
  const loadTime = Date.now() - start;

  expect(loadTime).toBeLessThan(2000); // < 2 seconds
});

test('admin goal list makes ≤ 3 HTTP requests', async ({ page }) => {
  const requests: string[] = [];

  page.on('request', req => {
    if (req.url().includes('/api/')) {
      requests.push(req.url());
    }
  });

  await loginAsAdmin(page);
  await page.goto('/admin/goal-list');
  await page.waitForSelector('table');

  expect(requests.length).toBeLessThanOrEqual(3);
});
```

---

## 8. Migration and Deployment

### 8.1 Deployment Strategy

**Phase 1: Backend Deployment** (Day 1)
1. Deploy backend changes (new admin endpoint)
2. Run integration tests in staging
3. Verify permission enforcement
4. Monitor error logs

**Phase 2: Frontend Deployment** (Day 2)
1. Deploy frontend changes (new admin page)
2. Verify admin access works
3. Verify non-admin gets 403
4. Monitor performance metrics

**Phase 3: Monitoring** (Day 3-7)
1. Monitor page load times
2. Collect user feedback
3. Verify no security issues
4. Document any issues

### 8.2 Rollback Plan

**If Issues Found:**
- Frontend: Revert frontend deployment (backend still works)
- Backend: Revert endpoint (new code not accessible yet)
- No data migration, so rollback is safe

---

## 9. Future Enhancements

### Potential Future Features (Out of Scope for V1)

1. **Export to Excel/CSV**: Download filtered goals as spreadsheet
2. **Bulk Operations**: Approve/reject multiple goals at once
3. **Advanced Analytics**: Charts and graphs for goal statistics
4. **Goal Editing from Admin View**: Edit any goal (currently view-only)
5. **Audit Trail**: View complete history of changes to a goal
6. **Email Notifications**: Alert admin when certain events occur
7. **Custom Views**: Save filter combinations for quick access
8. **Goal Comparison**: Compare goals across periods
9. **Performance Dashboard**: System-wide metrics and KPIs
10. **Manager Role Access**: Extend to manager role (department-scoped)

---

## 10. Appendices

### Appendix A: Database Indexes

**Existing Indexes** (should be sufficient):
- `goals.org_id` (primary filter)
- `goals.period_id` (period filter)
- `goals.user_id` (user filter)
- `goals.status` (status filter)
- `goals.created_at` (sorting)
- `users.department_id` (department filter)

**No New Indexes Required** for this feature.

### Appendix B: API Response Examples

See Section 3.1 for complete API response format.

### Appendix C: Related Documentation

- Performance Optimization: `.kiro/specs/Optimize_goal_list_performance/design.md`
- RBAC System: `backend/app/security/README.md`
- Goal Management: Existing goal-list documentation
- Admin Pages: Competency/period management implementations

---

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Author**: Development Team
**Status**: Planning Phase - Ready for Review
