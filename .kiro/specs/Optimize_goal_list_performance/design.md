# Design Document: Optimize Goal List Performance

## 1. Executive Summary

This document outlines the technical design for optimizing the Goal List page performance by eliminating N+1 query problems. The current implementation makes 20-50 HTTP requests taking 3-5 seconds to load. The proposed solution embeds supervisor reviews directly in the goals API response, reducing requests to 1-2 and load time to < 1 second (10x improvement).

**Key Changes:**
- Backend: Add optional `includeReviews` and `includeRejectionHistory` query parameters
- Backend: Implement batch review fetching with SQL JOIN
- Frontend: Remove N+1 review fetching logic
- Frontend: Use embedded reviews from API response

**Impact:**
- ⚡ **10x faster** page load (3-5s → 0.3-0.5s)
- 📉 **95% fewer requests** (20-50 → 1-2)
- 🎯 **Better UX** - instant feedback for users
- 📊 **Scalable** - O(1) requests regardless of goal count

---

## 2. Current Architecture (Problem)

### 2.1 Current Data Flow

```
┌─────────────┐
│  Frontend   │
│  goal-list  │
└──────┬──────┘
       │
       │ 1. GET /evaluation-periods (1 request)
       ├──────────────────────────────────────┐
       │                                      │
       │ 2. GET /goals?periodId=X (1 request)│
       ├──────────────────────────────────────┤
       │                                      │
       │ Returns: [goal1, goal2, ..., goal10]│
       │                                      │
       │ 3. For EACH goal, fetch reviews:    │
       │    (N requests = 10)                 │
       ├──────────────────────────────────────┤
       ├─ GET /reviews?goalId=goal1          │
       ├─ GET /reviews?goalId=goal2          │
       ├─ GET /reviews?goalId=goal3          │
       │  ...                                 │
       ├─ GET /reviews?goalId=goal10         │
       │                                      │
       │ 4. For goals with previousGoalId:   │
       │    (M requests = 10)                 │
       ├──────────────────────────────────────┤
       ├─ GET /reviews?goalId=prevGoal1      │
       ├─ GET /reviews?goalId=prevGoal2      │
       │  ...                                 │
       │                                      │
       │ 5. Recursively fetch history:       │
       │    (M × depth requests = 10-30)     │
       ├──────────────────────────────────────┤
       ├─ GET /goals/prevGoal1               │
       ├─ GET /reviews?goalId=prevPrevGoal1  │
       │  ...                                 │
       │                                      │
       └──────────────────────────────────────┘

Total: 1 + 1 + N + M + (M × depth) = 32-62 requests
Load time: 3-5 seconds
```

### 2.2 Performance Bottlenecks

1. **N+1 Query Problem**: For each goal, make separate request for reviews
2. **Recursive History Fetching**: For each goal with previousGoalId, recursively fetch chain
3. **Sequential Processing**: Requests are partially sequential (must fetch goal before fetching its previousGoal)
4. **Network Overhead**: Each HTTP request has ~50-100ms overhead (headers, auth, parsing)
5. **No Caching**: Reviews are fetched fresh every time (not cacheable due to dynamic goalId)

### 2.3 Current Code (Simplified)

```typescript
// frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts

const loadGoalData = async () => {
  // 1. Fetch goals (1 request)
  const goalsResult = await getGoalsAction({ periodId, limit: 100 });
  const goals = goalsResult.data.items;

  // 2. For EACH goal, fetch reviews (N requests)
  const reviewPromises = goals.map(goal =>
    getSupervisorReviewsAction({ goalId: goal.id, limit: 10 })
  );

  // 3. For goals with previousGoalId, fetch previous reviews (M requests)
  const previousGoalReviewPromises = goals
    .filter(goal => goal.previousGoalId)
    .map(goal =>
      getSupervisorReviewsAction({ goalId: goal.previousGoalId!, limit: 10 })
    );

  // 4. For goals with previousGoalId, fetch FULL rejection history (M × depth requests)
  const goalsWithReviews = await Promise.all(
    goals.map(async (goal) => {
      let rejectionHistory: SupervisorReview[] = [];
      if (goal.previousGoalId) {
        // RECURSIVE: This is the performance killer!
        rejectionHistory = await fetchRejectionHistory(goal.previousGoalId);
      }
      return { ...goal, rejectionHistory };
    })
  );
};

// RECURSIVE FUNCTION - exponential complexity!
const fetchRejectionHistory = async (goalId: string): Promise<SupervisorReview[]> => {
  const history: SupervisorReview[] = [];
  let currentGoalId: string | null = goalId;

  while (currentGoalId) {
    // Each iteration makes 2 requests (goal + review)
    const goalResult = await getGoalByIdAction(currentGoalId);
    const reviewResult = await getSupervisorReviewsAction({ goalId: currentGoalId });

    if (reviewResult.success) {
      history.unshift(reviewResult.data.items[0]);
    }

    currentGoalId = goalResult.data.previousGoalId || null;
  }

  return history;
};
```

---

## 3. Proposed Architecture (Solution)

### 3.1 New Data Flow

```
┌─────────────┐
│  Frontend   │
│  goal-list  │
└──────┬──────┘
       │
       │ 1. GET /evaluation-periods (1 request)
       ├────────────────────────────────────────┐
       │                                        │
       │ 2. GET /goals?periodId=X              │
       │       &includeReviews=true            │
       │       &includeRejectionHistory=true   │
       │    (1 request with embedded data)     │
       ├────────────────────────────────────────┤
       │                                        │
       │  Backend performs SQL JOIN:           │
       │  ┌──────────────────────────────────┐ │
       │  │ SELECT g.*, sr.*                 │ │
       │  │ FROM goals g                     │ │
       │  │ LEFT JOIN supervisor_reviews sr  │ │
       │  │   ON sr.goal_id = g.id           │ │
       │  │ WHERE g.period_id = ?            │ │
       │  │   AND g.user_id IN (...)         │ │
       │  │                                  │ │
       │  │ -- Recursive CTE for history    │ │
       │  │ WITH RECURSIVE goal_chain AS ... │ │
       │  └──────────────────────────────────┘ │
       │                                        │
       │  Returns: [                            │
       │    {                                   │
       │      ...goal1,                         │
       │      supervisorReview: {...},         │
       │      rejectionHistory: [...]          │
       │    },                                  │
       │    { ...goal2, ... },                  │
       │    ...                                 │
       │  ]                                     │
       │                                        │
       └────────────────────────────────────────┘

Total: 2 requests (periods + goals with embedded reviews)
Load time: 0.3-0.5 seconds
```

### 3.2 Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                        Frontend                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  useGoalListData Hook                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  - Call: getGoalsAction({                        │    │
│  │      periodId,                                   │    │
│  │      includeReviews: true,                      │    │
│  │      includeRejectionHistory: true              │    │
│  │    })                                            │    │
│  │  - Process embedded reviews (no additional calls)│    │
│  │  - Render goals with reviews immediately         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
└─────────────────┬──────────────────────────────────────────┘
                  │
                  │ HTTP: GET /goals?includeReviews=true
                  │
┌─────────────────▼──────────────────────────────────────────┐
│                     Backend API                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  GET /api/org/{org}/goals/                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Query Params:                                   │    │
│  │  - periodId: UUID                                │    │
│  │  - includeReviews: boolean = false (NEW)        │    │
│  │  - includeRejectionHistory: boolean = false(NEW)│    │
│  │                                                   │    │
│  │  If includeReviews=true:                         │    │
│  │    1. Fetch goals (existing logic)               │    │
│  │    2. Batch fetch reviews for all goals          │    │
│  │    3. Map reviews to goals                       │    │
│  │    4. Embed in response                          │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
└─────────────────┬──────────────────────────────────────────┘
                  │
                  │ SQL Queries (2 total)
                  │
┌─────────────────▼──────────────────────────────────────────┐
│                      Database                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Query 1: Fetch Goals                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  SELECT * FROM goals                             │    │
│  │  WHERE period_id = ? AND user_id IN (...)       │    │
│  │  ORDER BY created_at DESC                        │    │
│  │  LIMIT 100;                                       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  Query 2: Batch Fetch Reviews                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │  SELECT sr.*                                      │    │
│  │  FROM supervisor_reviews sr                      │    │
│  │  WHERE sr.goal_id IN (goal1, goal2, ..., goal10) │    │
│  │  ORDER BY sr.goal_id, sr.reviewed_at DESC;      │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  Query 3: Recursive History (optional - Python loop)     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  # Python loop in GoalService                     │    │
│  │  async def get_rejection_history(goal_id):       │    │
│  │    history = []                                   │    │
│  │    current_id = goal_id                          │    │
│  │    visited = set()                                │    │
│  │    max_depth = 10                                 │    │
│  │                                                   │    │
│  │    while current_id and len(visited) < max_depth:│    │
│  │      if current_id in visited:                   │    │
│  │        break  # Prevent infinite loops            │    │
│  │      visited.add(current_id)                     │    │
│  │                                                   │    │
│  │      # Fetch goal by ID                          │    │
│  │      goal = await goal_repo.get_by_id(current_id)│    │
│  │      if not goal or not goal.previous_goal_id:   │    │
│  │        break                                      │    │
│  │                                                   │    │
│  │      # Fetch review for previous goal            │    │
│  │      review = await review_repo.get_by_goal(     │    │
│  │        goal.previous_goal_id, org_id             │    │
│  │      )                                            │    │
│  │      if review:                                   │    │
│  │        history.insert(0, review[0])  # Prepend   │    │
│  │                                                   │    │
│  │      current_id = goal.previous_goal_id          │    │
│  │                                                   │    │
│  │    return history  # Chronological order         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  Note: This approach is simpler than SQL recursive CTE    │
│  and works well for typical rejection depth (1-3 levels). │
│  Max depth limit (10) prevents infinite loops.            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Design

### 4.1 Backend: Updated Goal Schema

```python
# backend/app/schemas/goal.py

from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

# Import SupervisorReview schema
from .supervisor_review import SupervisorReview

class Goal(BaseModel):
    """
    Goal schema with optional embedded supervisor reviews.
    Reviews are only included when includeReviews=true in API request.
    """
    # Existing fields
    id: UUID
    user_id: UUID = Field(..., alias="userId")
    period_id: UUID = Field(..., alias="periodId")
    goal_category: str = Field(..., alias="goalCategory")
    weight: float
    status: GoalStatus
    approved_by: Optional[UUID] = Field(None, alias="approvedBy")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    previous_goal_id: Optional[UUID] = Field(None, alias="previousGoalId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    # Performance goal fields
    title: Optional[str] = None
    performance_goal_type: Optional[PerformanceGoalType] = Field(None, alias="performanceGoalType")
    specific_goal_text: Optional[str] = Field(None, alias="specificGoalText")
    achievement_criteria_text: Optional[str] = Field(None, alias="achievementCriteriaText")
    means_methods_text: Optional[str] = Field(None, alias="meansMethodsText")

    # Competency goal fields
    competency_ids: Optional[List[UUID]] = Field(None, alias="competencyIds")
    selected_ideal_actions: Optional[Dict[str, List[str]]] = Field(None, alias="selectedIdealActions")
    action_plan: Optional[str] = Field(None, alias="actionPlan")

    # NEW: Optional embedded review fields
    supervisor_review: Optional[SupervisorReview] = Field(
        None,
        alias="supervisorReview",
        description="Most recent supervisor review (when includeReviews=true)"
    )
    rejection_history: Optional[List[SupervisorReview]] = Field(
        None,
        alias="rejectionHistory",
        description="Full rejection history chain (when includeRejectionHistory=true)"
    )

    model_config = {"populate_by_name": True}
```

### 4.2 Backend: Updated API Endpoint

```python
# backend/app/api/v1/goals.py

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from typing import Optional, List
from uuid import UUID

router = APIRouter(prefix="/goals", tags=["goals"])

@router.get("/", response_model=GoalList)
async def get_goals(
    # Existing parameters
    pagination: PaginationParams = Depends(),
    period_id: Optional[UUID] = Query(None, alias="periodId"),
    user_id: Optional[UUID] = Query(None, alias="userId"),
    goal_category: Optional[str] = Query(None, alias="goalCategory"),
    status: Optional[List[str]] = Query(None),

    # NEW: Performance optimization parameters
    include_reviews: bool = Query(
        False,
        alias="includeReviews",
        description="Include supervisor reviews in response (default: false for backward compatibility)"
    ),
    include_rejection_history: bool = Query(
        False,
        alias="includeRejectionHistory",
        description="Include full rejection history chain (default: false, requires includeReviews=true)"
    ),

    # Existing dependencies
    context: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db_session)
):
    """
    Get goals with optional embedded supervisor reviews.

    Performance:
    - Without includeReviews: Same as before (backward compatible)
    - With includeReviews=true: 10x faster (1-2 SQL queries vs N+1)

    Examples:
    - GET /goals?periodId=X                           # Original behavior
    - GET /goals?periodId=X&includeReviews=true      # With reviews (fast!)
    - GET /goals?periodId=X&includeReviews=true&includeRejectionHistory=true  # With full history
    """
    try:
        service = GoalService(session)

        # Validate: includeRejectionHistory requires includeReviews
        if include_rejection_history and not include_reviews:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="includeRejectionHistory requires includeReviews=true"
            )

        result = await service.get_goals(
            current_user_context=context,
            user_id=user_id,
            period_id=period_id,
            goal_category=goal_category,
            status=status,
            pagination=pagination,
            include_reviews=include_reviews,  # NEW
            include_rejection_history=include_rejection_history  # NEW
        )

        return result

    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionDeniedError as e:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching goals: {str(e)}"
        )
```

### 4.3 Backend: Updated Goal Service

```python
# backend/app/services/goal_service.py

class GoalService:
    """Service layer for goal-related business logic"""

    async def get_goals(
        self,
        current_user_context: AuthContext,
        user_id: Optional[UUID] = None,
        period_id: Optional[UUID] = None,
        goal_category: Optional[str] = None,
        status: Optional[List[str]] = None,
        pagination: Optional[PaginationParams] = None,
        include_reviews: bool = False,  # NEW
        include_rejection_history: bool = False  # NEW
    ) -> PaginatedResponse[Goal]:
        """
        Get goals with optional embedded reviews (performance optimized).

        Performance improvement:
        - Without include_reviews: O(1) query (same as before)
        - With include_reviews: O(1) batch query (vs O(N) individual queries)
        - Result: 10-20x faster when include_reviews=true
        """
        try:
            # Existing logic: Get accessible users and fetch goals
            accessible_user_ids = await self._get_accessible_goal_user_ids(
                current_user_context, user_id
            )
            org_id = current_user_context.organization_id

            # Fetch goals (existing query - unchanged)
            goals = await self.goal_repo.search_goals(
                org_id=org_id,
                user_ids=accessible_user_ids,
                period_id=period_id,
                goal_category=goal_category,
                status=status,
                pagination=pagination
            )

            # NEW: Optionally fetch reviews in batch
            reviews_map = {}
            if include_reviews and goals:
                goal_ids = [goal.id for goal in goals]

                # PERFORMANCE KEY: Single batch query for all reviews
                reviews = await self.supervisor_review_repo.get_by_goals_batch(
                    goal_ids=goal_ids,
                    org_id=org_id,
                    limit_per_goal=10
                )

                # Create map: goal_id → reviews (sorted by date)
                for review in reviews:
                    goal_id_str = str(review.goal_id)
                    if goal_id_str not in reviews_map:
                        reviews_map[goal_id_str] = []
                    reviews_map[goal_id_str].append(review)

            # Convert to response format with optional reviews
            enriched_goals = []
            for goal_model in goals:
                enriched_goal = await self._enrich_goal_data(
                    goal_model,
                    reviews_map=reviews_map if include_reviews else None,
                    include_rejection_history=include_rejection_history,
                    org_id=org_id
                )
                enriched_goals.append(enriched_goal)

            # Get total count and return paginated response
            total_count = await self.goal_repo.count_goals(...)

            return PaginatedResponse(
                items=enriched_goals,
                total=total_count,
                page=pagination.page if pagination else 1,
                limit=pagination.limit if pagination else len(enriched_goals),
                pages=...
            )

        except Exception as e:
            logger.error(f"Error in get_goals: {e}")
            raise

    async def _enrich_goal_data(
        self,
        goal_model: GoalModel,
        reviews_map: Optional[Dict[str, List[SupervisorReview]]] = None,
        include_rejection_history: bool = False,
        org_id: Optional[str] = None
    ) -> Goal:
        """
        Enrich goal with optional embedded reviews.

        Args:
            goal_model: The goal database model
            reviews_map: Pre-fetched reviews map (goal_id → reviews)
            include_rejection_history: Whether to fetch full rejection chain
            org_id: Organization ID for permission checks
        """
        # Existing logic: Convert goal model to schema
        goal_dict = {
            "id": goal_model.id,
            "user_id": goal_model.user_id,
            # ... all existing fields ...
        }

        # Add target_data fields
        if goal_model.target_data:
            goal_dict.update(goal_model.target_data)

        # NEW: Add supervisor review if available
        if reviews_map:
            goal_id_str = str(goal_model.id)
            goal_reviews = reviews_map.get(goal_id_str, [])

            if goal_reviews:
                # Most recent review (already sorted by date in batch query)
                goal_dict["supervisor_review"] = goal_reviews[0]

        # NEW: Add rejection history if requested
        if include_rejection_history and goal_model.previous_goal_id:
            rejection_history = await self._fetch_rejection_history_batch(
                starting_goal_id=goal_model.previous_goal_id,
                org_id=org_id,
                reviews_map=reviews_map
            )
            if rejection_history:
                goal_dict["rejection_history"] = rejection_history

        return Goal(**goal_dict)

    async def _fetch_rejection_history_batch(
        self,
        starting_goal_id: UUID,
        org_id: str,
        reviews_map: Optional[Dict[str, List[SupervisorReview]]] = None
    ) -> List[SupervisorReview]:
        """
        Fetch complete rejection history chain using recursive CTE.

        Performance: O(1) query (vs O(depth) individual queries)
        """
        # Use recursive CTE to fetch entire previousGoalId chain
        history = await self.supervisor_review_repo.get_rejection_history_chain(
            starting_goal_id=starting_goal_id,
            org_id=org_id,
            max_depth=10  # Prevent infinite loops
        )

        # Sort chronologically (oldest → newest)
        history.sort(key=lambda r: r.reviewed_at or r.created_at)

        return history
```

### 4.4 Backend: New Repository Method

```python
# backend/app/database/repositories/supervisor_review_repository.py

from sqlalchemy import select, and_, func, text
from sqlalchemy.orm import joinedload
from typing import List, Optional
from uuid import UUID

class SupervisorReviewRepository(BaseRepository[SupervisorReview]):
    """Repository for SupervisorReview database operations"""

    async def get_by_goals_batch(
        self,
        goal_ids: List[UUID],
        org_id: str,
        limit_per_goal: int = 10
    ) -> List[SupervisorReview]:
        """
        Fetch reviews for multiple goals in a single batch query (PERFORMANCE CRITICAL).

        This method eliminates N+1 queries by fetching all reviews at once.

        Performance:
        - Old: N queries (1 per goal) = N × 50ms = 500ms for 10 goals
        - New: 1 query (batch) = 50ms for 10 goals
        - Improvement: 10x faster

        Args:
            goal_ids: List of goal UUIDs to fetch reviews for
            org_id: Organization ID for security filtering
            limit_per_goal: Max reviews per goal (default: 10)

        Returns:
            List of reviews sorted by (goal_id, reviewed_at DESC)

        SQL Generated:
            SELECT sr.*
            FROM supervisor_reviews sr
            INNER JOIN goals g ON sr.goal_id = g.id
            INNER JOIN users u ON g.user_id = u.id
            WHERE sr.goal_id IN (goal1, goal2, ..., goalN)
              AND u.org_id = ?
            ORDER BY sr.goal_id, sr.reviewed_at DESC, sr.updated_at DESC;
        """
        if not goal_ids:
            return []

        # Build query with IN clause for batch fetching
        query = (
            select(SupervisorReview)
            .filter(SupervisorReview.goal_id.in_(goal_ids))
            .order_by(
                SupervisorReview.goal_id.asc(),  # Group by goal
                SupervisorReview.reviewed_at.desc().nulls_last(),  # Most recent first
                SupervisorReview.updated_at.desc()
            )
        )

        # Apply organization scope via goal -> user relationship
        query = self.apply_org_scope_via_goal(query, SupervisorReview.goal_id, org_id)

        # Execute query
        result = await self.session.execute(query)
        reviews = result.scalars().all()

        logger.info(f"Batch fetched {len(reviews)} reviews for {len(goal_ids)} goals in org {org_id}")

        return reviews

    async def get_rejection_history_chain(
        self,
        starting_goal_id: UUID,
        org_id: str,
        max_depth: int = 10
    ) -> List[SupervisorReview]:
        """
        Fetch complete rejection history by following previousGoalId chain.
        Uses recursive CTE for optimal performance.

        Performance:
        - Old: depth × 2 queries (fetch goal + review per level) = 6 queries for depth=3
        - New: 1 recursive query = 1 query for any depth
        - Improvement: 6x faster for depth=3, scales better for deeper chains

        Args:
            starting_goal_id: ID of the previous goal to start chain from
            org_id: Organization ID for security
            max_depth: Maximum recursion depth (prevent infinite loops)

        Returns:
            List of rejection reviews in chronological order (oldest → newest)

        SQL Generated (PostgreSQL):
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
            ORDER BY gc.depth DESC;  -- Chronological (oldest first)
        """
        # Use raw SQL for recursive CTE (SQLAlchemy ORM doesn't support it well)
        cte_query = text("""
            WITH RECURSIVE goal_chain AS (
              -- Base case
              SELECT id, previous_goal_id, user_id, 0 as depth
              FROM goals
              WHERE id = :starting_goal_id

              UNION ALL

              -- Recursive case
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
            ORDER BY gc.depth DESC
        """)

        result = await self.session.execute(
            cte_query,
            {
                "starting_goal_id": str(starting_goal_id),
                "max_depth": max_depth,
                "org_id": org_id
            }
        )

        # Map raw SQL results to SupervisorReview objects
        reviews = []
        for row in result:
            review = SupervisorReview(**dict(row._mapping))
            reviews.append(review)

        logger.info(f"Fetched {len(reviews)} rejection history reviews for chain starting at {starting_goal_id}")

        return reviews
```

### 4.5 Frontend: Updated Server Action

```typescript
// frontend/src/api/server-actions/goals.ts

export const getGoalsAction = cache(async (params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
  includeReviews?: boolean;  // NEW
  includeRejectionHistory?: boolean;  // NEW
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> => {
  return _getGoalsAction(params);
});

async function _getGoalsAction(params?: {
  periodId?: UUID;
  userId?: UUID;
  goalCategory?: string;
  status?: string | string[];
  page?: number;
  limit?: number;
  includeReviews?: boolean;
  includeRejectionHistory?: boolean;
}): Promise<{ success: boolean; data?: GoalListResponse; error?: string }> {
  try {
    const response = await goalsApi.getGoals(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.errorMessage || 'Failed to fetch goals',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Get goals action error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while fetching goals',
    };
  }
}
```

### 4.6 Frontend: Updated API Client

```typescript
// frontend/src/api/endpoints/goals.ts

import { apiClient } from '../client';
import { API_ROUTES } from '../constants/routes';
import type {
  GoalListResponse,
  GoalResponse,
  ApiResponse,
  UUID
} from '../types';

export const goalsApi = {
  /**
   * Get goals with optional embedded reviews (performance optimized)
   *
   * @param includeReviews - Include supervisor reviews (default: false)
   * @param includeRejectionHistory - Include full rejection history (default: false)
   * @returns Goals with optional embedded reviews
   *
   * Performance:
   * - Without includeReviews: Same as before
   * - With includeReviews=true: 10x faster (no N+1 queries)
   */
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
    try {
      const queryParams = new URLSearchParams();

      // Existing params
      if (params?.periodId) queryParams.append('periodId', params.periodId);
      if (params?.userId) queryParams.append('userId', params.userId);
      if (params?.goalCategory) queryParams.append('goalCategory', params.goalCategory);
      if (params?.status) {
        const statuses = Array.isArray(params.status) ? params.status : [params.status];
        statuses.forEach(s => queryParams.append('status', s));
      }
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      // NEW: Performance optimization params
      if (params?.includeReviews) {
        queryParams.append('includeReviews', 'true');
      }
      if (params?.includeRejectionHistory) {
        queryParams.append('includeRejectionHistory', 'true');
      }

      const url = `${API_ROUTES.GOALS.BASE}?${queryParams.toString()}`;
      const response = await apiClient.get<GoalListResponse>(url);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch goals',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // ... other methods unchanged ...
};
```

### 4.7 Frontend: Simplified useGoalListData Hook

```typescript
// frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts

export function useGoalListData(): UseGoalListDataReturn {
  const [goals, setGoals] = useState<GoalWithReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ... other state ...

  /**
   * Load goals data with embedded reviews (OPTIMIZED - no N+1 queries!)
   */
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
        const currentPeriodId = periodResult.data.current.id;

        // PERFORMANCE KEY: Single request with embedded reviews!
        const goalsResult = await getGoalsAction({
          periodId: currentPeriodId,
          limit: 100,
          includeReviews: true,  // NEW: Embed reviews (no additional requests!)
          includeRejectionHistory: true  // NEW: Embed rejection history
        });

        if (!goalsResult.success || !goalsResult.data?.items) {
          setError(goalsResult.error || '目標の読み込みに失敗しました');
          return;
        }

        const goals = goalsResult.data.items;

        // Filter out rejected goals (replaced by draft copies)
        const activeGoals = goals.filter(goal => goal.status !== 'rejected');

        // REMOVED: No need to fetch reviews separately!
        // REMOVED: No need to map reviews to goals!
        // REMOVED: No need to fetch rejection history recursively!

        // Goals already have embedded reviews and rejection history!
        const goalsWithReviews: GoalWithReview[] = activeGoals.map(goal => ({
          ...goal,
          supervisorReview: goal.supervisorReview || null,
          rejectionHistory: goal.rejectionHistory || []
        }));

        setGoals(goalsWithReviews);
      } else {
        setCurrentPeriod(null);
        setError('評価期間が設定されていません');
      }
    } catch (err) {
      console.error('Error loading goal data:', err);
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ... rest of hook unchanged ...
}
```

---

## 5. Database Query Optimization

### 5.1 SQL Query Plan Analysis

#### BEFORE (N+1 Queries):
```sql
-- Query 1: Fetch goals (fast)
SELECT * FROM goals
WHERE period_id = '...' AND user_id IN (...)
ORDER BY created_at DESC
LIMIT 100;
-- Execution time: ~50ms

-- Queries 2-11: Fetch reviews for each goal (N queries)
SELECT * FROM supervisor_reviews WHERE goal_id = 'goal1';  -- 20ms
SELECT * FROM supervisor_reviews WHERE goal_id = 'goal2';  -- 20ms
SELECT * FROM supervisor_reviews WHERE goal_id = 'goal3';  -- 20ms
...
-- Total: N × 20ms = 200ms for 10 goals

-- Queries 12-21: Fetch previous goal reviews (M queries)
SELECT * FROM supervisor_reviews WHERE goal_id = 'prevGoal1';  -- 20ms
...
-- Total: M × 20ms = 200ms for 10 prev goals

-- Queries 22-61: Recursive history (M × depth queries)
SELECT * FROM goals WHERE id = 'prevGoal1';  -- 10ms
SELECT * FROM supervisor_reviews WHERE goal_id = 'prevGoal1';  -- 20ms
SELECT * FROM goals WHERE id = 'prevPrevGoal1';  -- 10ms
...
-- Total: (M × depth) × 30ms = 900ms for depth=3

-- TOTAL: 50 + 200 + 200 + 900 = 1350ms (1.35 seconds for SQL only!)
-- Add HTTP overhead: 1350ms + (40 × 50ms) = 3.35 seconds
```

#### AFTER (Batch Queries):
```sql
-- Query 1: Fetch goals (unchanged)
SELECT * FROM goals
WHERE period_id = '...' AND user_id IN (...)
ORDER BY created_at DESC
LIMIT 100;
-- Execution time: ~50ms

-- Query 2: Batch fetch reviews (NEW - replaces N+1 queries!)
SELECT sr.*
FROM supervisor_reviews sr
INNER JOIN goals g ON sr.goal_id = g.id
INNER JOIN users u ON g.user_id = u.id
WHERE sr.goal_id IN ('goal1', 'goal2', ..., 'goal10')
  AND u.org_id = '...'
ORDER BY sr.goal_id, sr.reviewed_at DESC;
-- Execution time: ~50ms (same as single query!)

-- Query 3: Recursive rejection history (NEW - replaces M×depth queries!)
WITH RECURSIVE goal_chain AS (
  SELECT id, previous_goal_id, 0 as depth
  FROM goals WHERE id IN ('prevGoal1', 'prevGoal2', ...)
  UNION ALL
  SELECT g.id, g.previous_goal_id, depth + 1
  FROM goals g
  JOIN goal_chain gc ON g.id = gc.previous_goal_id
  WHERE depth < 10
)
SELECT sr.*
FROM supervisor_reviews sr
JOIN goal_chain gc ON sr.goal_id = gc.id
JOIN users u ON sr.subordinate_id = u.id
WHERE sr.action = 'rejected' AND u.org_id = '...'
ORDER BY gc.depth DESC;
-- Execution time: ~100ms (handles any depth!)

-- TOTAL: 50 + 50 + 100 = 200ms (SQL only)
-- Add HTTP overhead: 200ms + (1 × 50ms) = 250ms

-- IMPROVEMENT: 3350ms → 250ms = 13.4x faster! 🚀
```

### 5.2 Index Recommendations

```sql
-- Ensure these indexes exist for optimal performance:

-- Index 1: Goals by period and user (already exists)
CREATE INDEX idx_goals_period_user
ON goals(period_id, user_id, created_at DESC);

-- Index 2: Reviews by goal (already exists)
CREATE INDEX idx_supervisor_reviews_goal
ON supervisor_reviews(goal_id, reviewed_at DESC);

-- Index 3: Goals previous chain (NEW - for recursive CTE)
CREATE INDEX idx_goals_previous_goal
ON goals(previous_goal_id)
WHERE previous_goal_id IS NOT NULL;

-- Index 4: Reviews by action (NEW - for rejection history)
CREATE INDEX idx_supervisor_reviews_action
ON supervisor_reviews(action, goal_id)
WHERE action = 'rejected';
```

---

## 6. Performance Metrics

### 6.1 Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Page Load Time** | 3-5 sec | 0.3-0.5 sec | **10x faster** |
| **HTTP Requests** | 32-62 | 2-3 | **95% reduction** |
| **SQL Queries** | 32-62 | 2-3 | **95% reduction** |
| **Network Data** | 500KB+ | < 100KB | **80% reduction** |
| **Backend CPU** | High | Low | **70% reduction** |
| **Database Load** | High | Low | **90% reduction** |

### 6.2 Scalability Analysis

#### Linear Scaling (Goals):
```
BEFORE:
- 10 goals = 32 requests = 3.2 sec
- 20 goals = 62 requests = 6.2 sec
- 50 goals = 152 requests = 15.2 sec (unusable!)

AFTER:
- 10 goals = 2 requests = 0.3 sec
- 20 goals = 2 requests = 0.4 sec
- 50 goals = 2 requests = 0.6 sec (still fast!)
```

#### Exponential Scaling (Rejection Depth):
```
BEFORE (depth = 3):
- 10 goals × 3 rejections = 60 additional requests = +6 sec

AFTER (depth = 3):
- Recursive CTE handles any depth = +0.1 sec
```

---

## 7. Error Handling and Edge Cases

### 7.1 Edge Cases

1. **Empty goal list**:
   - Before: 1 request (goals) = fast
   - After: 1 request (goals) = same speed
   - ✅ No degradation

2. **Goals without reviews**:
   - supervisorReview = null (expected)
   - rejectionHistory = [] (empty array)
   - ✅ Handled gracefully

3. **Circular previousGoalId references**:
   - Recursive CTE has max_depth=10 limit
   - Prevents infinite loops
   - ✅ Safe

4. **Very deep rejection chains (> 10)**:
   - Only fetches first 10 levels
   - Log warning for investigation
   - ✅ Degrades gracefully

5. **Large number of goals (> 100)**:
   - Use pagination (existing mechanism)
   - Batch query scales well
   - ✅ Supported

### 7.2 Error Handling

```python
# Backend service error handling
try:
    reviews = await self.supervisor_review_repo.get_by_goals_batch(...)
except Exception as e:
    logger.error(f"Failed to fetch reviews batch: {e}")
    # Fallback: Return goals without reviews (degraded mode)
    reviews_map = {}  # Empty map = no reviews embedded

try:
    history = await self.supervisor_review_repo.get_rejection_history_chain(...)
except Exception as e:
    logger.warning(f"Failed to fetch rejection history for goal {goal_id}: {e}")
    # Fallback: Return empty history
    history = []
```

```typescript
// Frontend error handling
const goalsResult = await getGoalsAction({
  periodId,
  includeReviews: true,
  includeRejectionHistory: true
});

if (!goalsResult.success) {
  // Try fallback: fetch without embedded reviews (backward compatible)
  const fallbackResult = await getGoalsAction({ periodId });

  if (fallbackResult.success) {
    // Degrade gracefully: show goals without reviews
    setGoals(fallbackResult.data.items);
    setError('一部のデータの読み込みに失敗しました');
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```python
# backend/tests/test_supervisor_review_repository.py

async def test_get_by_goals_batch_returns_reviews_for_all_goals():
    """Test batch query returns reviews for all provided goal IDs"""
    goal_ids = [goal1.id, goal2.id, goal3.id]
    reviews = await repo.get_by_goals_batch(goal_ids, org_id)

    assert len(reviews) >= 3  # At least one review per goal
    review_goal_ids = {r.goal_id for r in reviews}
    assert goal1.id in review_goal_ids
    assert goal2.id in review_goal_ids
    assert goal3.id in review_goal_ids

async def test_get_rejection_history_chain_follows_previous_goal_ids():
    """Test recursive CTE follows previousGoalId chain"""
    # Setup: goal3 -> goal2 -> goal1 (rejection chain)
    history = await repo.get_rejection_history_chain(goal3.id, org_id)

    assert len(history) == 3
    assert history[0].goal_id == goal1.id  # Oldest
    assert history[1].goal_id == goal2.id
    assert history[2].goal_id == goal3.id  # Newest

async def test_batch_query_respects_org_scope():
    """Test batch query only returns reviews from same organization"""
    other_org_goal_id = create_goal_in_other_org()
    goal_ids = [own_goal.id, other_org_goal_id]

    reviews = await repo.get_by_goals_batch(goal_ids, org_id)

    review_goal_ids = {r.goal_id for r in reviews}
    assert own_goal.id in review_goal_ids
    assert other_org_goal_id not in review_goal_ids  # Security check
```

### 8.2 Integration Tests

```python
# backend/tests/test_goals_api.py

async def test_get_goals_with_include_reviews_returns_embedded_data(client):
    """Test API with includeReviews=true embeds reviews"""
    response = await client.get(f"/goals?periodId={period.id}&includeReviews=true")

    assert response.status_code == 200
    data = response.json()

    # Check embedded reviews
    assert "items" in data
    for goal in data["items"]:
        if goal["status"] in ["submitted", "approved", "rejected"]:
            assert "supervisorReview" in goal
            assert goal["supervisorReview"] is not None

async def test_get_goals_without_include_reviews_maintains_backward_compatibility(client):
    """Test API without includeReviews maintains original behavior"""
    response = await client.get(f"/goals?periodId={period.id}")

    assert response.status_code == 200
    data = response.json()

    # Check NO embedded reviews (backward compatible)
    for goal in data["items"]:
        assert "supervisorReview" not in goal or goal["supervisorReview"] is None

async def test_api_performance_with_embedded_reviews(client):
    """Test API response time with includeReviews=true"""
    start = time.time()
    response = await client.get(f"/goals?periodId={period.id}&includeReviews=true")
    duration = time.time() - start

    assert response.status_code == 200
    assert duration < 0.5  # Must respond in < 500ms
```

### 8.3 Performance Tests

```python
# backend/tests/test_performance.py

async def test_batch_query_performance():
    """Test batch query is faster than N+1 queries"""
    goal_ids = [create_goal() for _ in range(50)]

    # Measure N+1 approach (baseline)
    start = time.time()
    for goal_id in goal_ids:
        await repo.get_by_goal(goal_id, org_id)
    n_plus_one_time = time.time() - start

    # Measure batch approach
    start = time.time()
    await repo.get_by_goals_batch(goal_ids, org_id)
    batch_time = time.time() - start

    # Batch should be at least 5x faster
    assert batch_time < n_plus_one_time / 5

async def test_recursive_cte_performance():
    """Test recursive CTE handles deep chains efficiently"""
    # Create deep rejection chain (depth = 10)
    goal_chain = create_rejection_chain(depth=10)

    start = time.time()
    history = await repo.get_rejection_history_chain(goal_chain[-1].id, org_id)
    duration = time.time() - start

    assert len(history) == 10
    assert duration < 0.2  # Must complete in < 200ms
```

---

## 9. Monitoring and Observability

### 9.1 Metrics to Track

```python
# Add to backend logging/metrics

# Request metrics
metrics.histogram("goals_api_duration", duration, tags=["include_reviews"])
metrics.histogram("goals_api_sql_queries", query_count, tags=["include_reviews"])
metrics.counter("goals_api_requests", tags=["include_reviews", "status_code"])

# Performance metrics
metrics.histogram("batch_review_fetch_duration", duration)
metrics.histogram("batch_review_fetch_count", review_count)
metrics.histogram("recursive_cte_duration", duration)
metrics.histogram("recursive_cte_depth", max_depth)

# Error metrics
metrics.counter("goals_api_errors", tags=["error_type"])
metrics.counter("batch_fetch_failures", tags=["reason"])
```

### 9.2 Logging

```python
# Add structured logging

logger.info(
    "Goals API request",
    extra={
        "period_id": period_id,
        "include_reviews": include_reviews,
        "include_rejection_history": include_rejection_history,
        "goal_count": len(goals),
        "sql_queries": query_count,
        "duration_ms": duration * 1000
    }
)

logger.info(
    "Batch review fetch",
    extra={
        "goal_count": len(goal_ids),
        "review_count": len(reviews),
        "duration_ms": duration * 1000
    }
)
```

---

## 10. Rollout and Migration Plan

### Phase 1: Backend Implementation (Day 1)
1. ✅ Add optional query parameters to API endpoint
2. ✅ Implement `get_by_goals_batch()` repository method
3. ✅ Implement `get_rejection_history_chain()` repository method
4. ✅ Update `GoalService._enrich_goal_data()` to embed reviews
5. ✅ Add unit tests and integration tests
6. ✅ Deploy backend (backward compatible - no frontend changes needed)

### Phase 2: Frontend Migration (Day 2)
1. ✅ Update `getGoalsAction()` to accept `includeReviews` parameter
2. ✅ Update `goalsApi.getGoals()` to pass query parameters
3. ✅ Simplify `useGoalListData` hook (remove N+1 logic)
4. ✅ Test goal-list page thoroughly
5. ✅ Deploy frontend with feature flag (gradual rollout)

### Phase 3: Cleanup and Monitoring (Day 3)
1. ✅ Remove old review fetching code
2. ✅ Remove `fetchRejectionHistory()` function
3. ✅ Update documentation
4. ✅ Monitor performance metrics
5. ✅ Verify success criteria (< 1s load time)

### Rollback Plan
- Backend is backward compatible (no breaking changes)
- Frontend can be rolled back without backend changes
- Old code continues to work during migration
- Feature flag allows gradual rollout and quick rollback

---

## 11. Success Criteria Verification

| Criterion | Target | Verification Method |
|-----------|--------|---------------------|
| Page load time | < 1 second | Browser DevTools Network tab |
| HTTP requests | ≤ 3 | Browser DevTools Network tab count |
| SQL queries | ≤ 2 | Backend logging + EXPLAIN ANALYZE |
| Response size | < 100KB | Browser DevTools Network tab size |
| Time to interactive | < 1.5 seconds | Lighthouse performance audit |
| No breaking changes | 100% | Existing tests pass unchanged |
| Rejection history correct | 100% | Manual QA + integration tests |

---

## 12. Future Enhancements (Out of Scope)

1. **Pagination for large goal lists** (> 100 goals)
2. **Redis caching layer** for frequently accessed goals
3. **GraphQL API** for more flexible data fetching
4. **Real-time updates** via WebSockets
5. **Infinite scroll** or virtualization for UI
6. **Database query optimization** (indexes, materialized views)

---

## Appendix A: API Request/Response Examples

### Request: Without embedded reviews (backward compatible)
```
GET /api/org/test/goals?periodId=123&limit=10
```

### Response: Without embedded reviews
```json
{
  "items": [
    {
      "id": "goal1",
      "userId": "user1",
      "periodId": "123",
      "goalCategory": "業績目標",
      "status": "submitted",
      "title": "Improve sales",
      // ... other fields ...
      // NO supervisorReview field
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10
}
```

### Request: With embedded reviews (optimized)
```
GET /api/org/test/goals?periodId=123&limit=10&includeReviews=true&includeRejectionHistory=true
```

### Response: With embedded reviews
```json
{
  "items": [
    {
      "id": "goal1",
      "userId": "user1",
      "periodId": "123",
      "goalCategory": "業績目標",
      "status": "draft",
      "title": "Improve sales",
      "previousGoalId": "goal0",
      // ... other fields ...

      // EMBEDDED: Most recent review (NEW!)
      "supervisorReview": {
        "id": "review1",
        "goalId": "goal0",
        "supervisorId": "supervisor1",
        "action": "rejected",
        "comment": "Please be more specific",
        "reviewedAt": "2024-10-10T10:00:00Z"
      },

      // EMBEDDED: Full rejection history (NEW!)
      "rejectionHistory": [
        {
          "id": "review_old",
          "goalId": "goal_old",
          "action": "rejected",
          "comment": "First rejection",
          "reviewedAt": "2024-10-01T10:00:00Z"
        },
        {
          "id": "review1",
          "goalId": "goal0",
          "action": "rejected",
          "comment": "Second rejection",
          "reviewedAt": "2024-10-10T10:00:00Z"
        }
      ]
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10
}
```

---

**End of Design Document**
