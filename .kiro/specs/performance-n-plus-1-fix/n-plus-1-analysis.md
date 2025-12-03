# N+1 Query Problem Analysis

## Overview

This document provides a comprehensive analysis of N+1 query problems identified in the HR Evaluation System, along with proposed solutions to improve database query performance.

## What is the N+1 Problem?

The N+1 problem occurs when:
1. An initial query fetches N records (1 query)
2. For each of the N records, an additional query is executed to fetch related data (N queries)
3. Total: 1 + N queries instead of 1 or 2 optimized queries

### Example
```python
# BAD - N+1 Problem
subordinates = get_subordinates()  # 1 query
for subordinate in subordinates:   # N iterations
    department = get_department(subordinate.department_id)  # N queries
    goals = get_goals(subordinate.id)  # N queries
    # Total: 1 + 2N queries
```

```python
# GOOD - Optimized with eager loading
subordinates = get_subordinates_with_relations()  # 1-3 queries with JOINs
for subordinate in subordinates:
    department = subordinate.department  # Already loaded
    goals = subordinate.goals  # Already loaded
    # Total: 1-3 queries regardless of N
```

## Critical Issues Found

### 1. Dashboard Service - Subordinates List (CRITICAL)

**Location:** `backend/app/services/dashboard_service.py:446-499`

**Problem:**
The `_get_subordinates_list()` method iterates through subordinates and executes separate queries for each subordinate's related data.

**Code Analysis:**
```python
for subordinate in subordinates:  # Line 446
    # Query 1: Department lookup (Line 450)
    if subordinate.department_id:
        department = await self.department_repo.get_by_id(subordinate.department_id, org_id)

    # Query 2: Goals lookup (Line 460-467)
    if current_period:
        goals_query = select(Goal).where(...)
        goals_result = await self.session.execute(goals_query)

    # Query 3: Self-assessment lookup (Line 472-480)
    if current_period:
        assessment_query = select(SelfAssessment).where(...)
        assessment_result = await self.session.execute(assessment_query)

    # Query 4: Feedback lookup (Line 486-498)
    if current_period and self_assessment_completed:
        feedback_query = select(SupervisorFeedback).where(...)
        feedback_result = await self.session.execute(feedback_query)
```

**Impact:**
- **10 subordinates:** 1 + (10 × 4) = **41 queries**
- **50 subordinates:** 1 + (50 × 4) = **201 queries**
- **100 subordinates:** 1 + (100 × 4) = **401 queries**

**Observed Performance:**
- Slow request log: `GET /api/v1/auth/user/... - Process time: 3.8124s`

---

### 2. User Repository - Missing Eager Loading

**Location:** `backend/app/database/repositories/user_repo.py`

**Problem:**
Several methods fetch users without eager loading related data, causing N+1 when the service layer accesses relationships.

#### 2.1 `get_subordinates()` (Line 359-375)

**Current Implementation:**
```python
async def get_subordinates(self, supervisor_id: UUID, org_id: str) -> list[User]:
    result = await self.session.execute(
        select(User)
        .join(UserSupervisor, User.id == UserSupervisor.user_id)
        .filter(...)
    )
    return result.scalars().all()
```

**Issue:** No eager loading of `department`, `stage`, `roles`, or related evaluation data.

**Impact:** When service accesses `subordinate.department.name`, triggers additional query per subordinate.

#### 2.2 `search_users()` (Line 437-493)

**Current Implementation:**
```python
async def search_users(...) -> list[User]:
    query = select(User).options(
        joinedload(User.department),
        joinedload(User.stage),
        joinedload(User.roles)
    )
    # Good! Uses joinedload
```

**Status:** ✅ Already optimized with eager loading

#### 2.3 `get_users_by_status()` (Line 252-268)

**Current Implementation:**
```python
async def get_users_by_status(self, status: UserStatus, org_id: str) -> list[User]:
    query = select(User).options(
        joinedload(User.department),
        joinedload(User.stage),
        joinedload(User.supervisor_relations).joinedload(UserSupervisor.supervisor)
    )
```

**Status:** ✅ Already optimized with eager loading

---

### 3. Dashboard Service - Team Progress Queries

**Location:** `backend/app/services/dashboard_service.py:260-348`

**Problem:**
Multiple separate queries to count related data for subordinates.

**Current Implementation:**
```python
async def _get_team_progress(self, supervisor_id: UUID, org_id: str) -> TeamProgressData:
    # Query 1: Get subordinates
    subordinates = await self.user_repo.get_subordinates(supervisor_id, org_id)
    subordinate_ids = [sub.id for sub in subordinates]

    # Query 2: Count goals set
    goals_set_query = select(func.count(...)).where(Goal.user_id.in_(subordinate_ids))

    # Query 3: Count goals approved
    goals_approved_query = select(func.count(...)).where(Goal.user_id.in_(subordinate_ids))

    # Query 4: Count self-assessments
    assessments_completed_query = select(func.count(...)).where(...)

    # Query 5: Count feedbacks
    feedbacks_query = select(func.count(...)).where(...)
```

**Impact:**
- Fixed number of queries (5-6) regardless of subordinate count
- **Not a classic N+1**, but could be optimized with a single aggregate query

**Priority:** Medium (not N+1, but can be improved)

---

## Performance Impact Summary

| Location | Current Queries | Optimized Queries | Improvement |
|----------|----------------|-------------------|-------------|
| Subordinates List (10 users) | 41 | 4-5 | **90% reduction** |
| Subordinates List (50 users) | 201 | 4-5 | **97% reduction** |
| Subordinates List (100 users) | 401 | 4-5 | **99% reduction** |
| Team Progress | 5-6 | 2-3 | 40-50% reduction |

---

## Proposed Solutions

### Solution 1: Fix Dashboard Service Subordinates List (CRITICAL)

**Strategy:** Use batch queries instead of individual queries in loop

```python
async def _get_subordinates_list(self, supervisor_id: UUID, org_id: str) -> SubordinatesListData:
    # Step 1: Get subordinates with eager loading
    subordinates_query = (
        select(User)
        .options(joinedload(User.department))  # Eager load department
        .join(UserSupervisor, User.id == UserSupervisor.user_id)
        .filter(
            UserSupervisor.supervisor_id == supervisor_id,
            User.status == UserStatus.ACTIVE,
            User.clerk_organization_id == org_id,
        )
    )
    result = await self.session.execute(subordinates_query)
    subordinates = result.scalars().unique().all()

    if not subordinates:
        return SubordinatesListData(...)

    subordinate_ids = [sub.id for sub in subordinates]

    # Step 2: Batch fetch all goals for all subordinates (1 query)
    goals_query = select(Goal).where(
        and_(
            Goal.user_id.in_(subordinate_ids),
            Goal.period_id == current_period.id
        )
    )
    goals_result = await self.session.execute(goals_query)
    all_goals = goals_result.scalars().all()

    # Group goals by user_id
    goals_by_user = {}
    for goal in all_goals:
        if goal.user_id not in goals_by_user:
            goals_by_user[goal.user_id] = []
        goals_by_user[goal.user_id].append(goal)

    # Step 3: Batch fetch all self-assessments (1 query)
    assessments_query = select(SelfAssessment).where(
        and_(
            SelfAssessment.user_id.in_(subordinate_ids),
            SelfAssessment.period_id == current_period.id,
            SelfAssessment.status == "submitted"
        )
    )
    assessments_result = await self.session.execute(assessments_query)
    all_assessments = assessments_result.scalars().all()

    # Create lookup dict
    assessments_by_user = {a.user_id: a for a in all_assessments}

    # Step 4: Batch fetch all feedbacks (1 query)
    feedbacks_query = select(SupervisorFeedback).where(
        and_(
            SupervisorFeedback.employee_id.in_(subordinate_ids),
            SupervisorFeedback.period_id == current_period.id,
            SupervisorFeedback.supervisor_id == supervisor_id
        )
    )
    feedbacks_result = await self.session.execute(feedbacks_query)
    all_feedbacks = feedbacks_result.scalars().all()

    # Create lookup dict
    feedbacks_by_user = {f.employee_id: f for f in all_feedbacks}

    # Step 5: Build subordinate info using pre-fetched data
    subordinate_infos: List[SubordinateInfo] = []
    for subordinate in subordinates:
        department_name = subordinate.department.name if subordinate.department else None

        # Get goals from pre-fetched data
        user_goals = goals_by_user.get(subordinate.id, [])
        goals_count = len(user_goals)
        goals_approved_count = sum(1 for g in user_goals if g.status == "approved")
        has_pending_goals = any(g.status == "submitted" for g in user_goals)

        # Get assessment from pre-fetched data
        assessment = assessments_by_user.get(subordinate.id)
        self_assessment_completed = assessment is not None

        # Get feedback from pre-fetched data
        feedback = feedbacks_by_user.get(subordinate.id)
        feedback_provided = feedback.status == "submitted" if feedback else False
        has_pending_feedback = self_assessment_completed and not feedback

        # ... rest of logic ...
```

**Result:**
- **Before:** 1 + (N × 4) queries
- **After:** 4-5 queries total (regardless of N)

---

### Solution 2: Fix User Repository get_subordinates()

**Add eager loading option:**

```python
async def get_subordinates(
    self,
    supervisor_id: UUID,
    org_id: str,
    with_relations: bool = False
) -> list[User]:
    try:
        query = select(User).join(
            UserSupervisor, User.id == UserSupervisor.user_id
        ).filter(
            UserSupervisor.supervisor_id == supervisor_id,
            User.status == UserStatus.ACTIVE,
            User.clerk_organization_id == org_id,
        )

        # Add eager loading if requested
        if with_relations:
            query = query.options(
                joinedload(User.department),
                joinedload(User.stage),
                joinedload(User.roles)
            )

        result = await self.session.execute(query)
        return result.scalars().unique().all() if with_relations else result.scalars().all()

    except SQLAlchemyError as e:
        logger.error(f"Error fetching subordinates: {e}")
        raise
```

---

### Solution 3: Optimize Team Progress (Optional)

**Combine multiple count queries into one:**

```python
async def _get_team_progress(self, supervisor_id: UUID, org_id: str) -> TeamProgressData:
    subordinates = await self.user_repo.get_subordinates(supervisor_id, org_id)

    if not subordinates:
        return TeamProgressData(...)

    subordinate_ids = [sub.id for sub in subordinates]

    # Single query with multiple aggregates
    stats_query = select(
        func.count(func.distinct(Goal.user_id)).label('goals_set'),
        func.sum(case((Goal.status == 'approved', 1), else_=0)).label('goals_approved'),
        func.count(func.distinct(SelfAssessment.user_id)).label('assessments_completed'),
        func.count(func.distinct(SupervisorFeedback.employee_id)).label('feedbacks_provided')
    ).select_from(User).outerjoin(
        Goal, and_(Goal.user_id == User.id, Goal.period_id == current_period.id)
    ).outerjoin(
        SelfAssessment, and_(
            SelfAssessment.user_id == User.id,
            SelfAssessment.period_id == current_period.id,
            SelfAssessment.status == 'submitted'
        )
    ).outerjoin(
        SupervisorFeedback, and_(
            SupervisorFeedback.employee_id == User.id,
            SupervisorFeedback.period_id == current_period.id,
            SupervisorFeedback.status == 'submitted'
        )
    ).where(User.id.in_(subordinate_ids))

    result = await self.session.execute(stats_query)
    stats = result.one()

    # Use stats directly
    return TeamProgressData(
        goals_set_count=stats.goals_set or 0,
        goals_approved_count=stats.goals_approved or 0,
        # ...
    )
```

---

## Implementation Priority

1. **CRITICAL - Subordinates List:** Fix immediately (90%+ query reduction)
2. **HIGH - User Repository:** Add eager loading options
3. **MEDIUM - Team Progress:** Optimize when time permits

---

## Testing Strategy

### Before Implementation
1. Enable SQL query logging: Set `LOG_LEVEL=DEBUG` in `.env.local`
2. Access supervisor dashboard
3. Count number of SELECT queries in logs
4. Measure response time

### After Implementation
1. Re-test with same conditions
2. Verify query count reduction
3. Measure response time improvement
4. Check Supabase query performance dashboard

### Expected Results
- Query count: **90% reduction** for subordinates list
- Response time: **50-70% faster** for supervisor dashboard
- Database load: Significantly reduced

---

## Supabase Query Performance Monitoring

Check query performance at:
https://supabase.com/dashboard/project/yxekevoucqfiskisokju/observability/query-performance

**Focus on:**
- Queries with high execution count
- Queries with slow average duration
- Queries appearing in tight loops

---

## Next Steps

1. ✅ Document N+1 issues
2. ⬜ Implement Solution 1 (Subordinates List)
3. ⬜ Implement Solution 2 (User Repository)
4. ⬜ Test and verify improvements
5. ⬜ Monitor Supabase metrics
6. ⬜ Consider Solution 3 if needed

---

## References

- SQLAlchemy Eager Loading: https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html
- N+1 Problem Explained: https://stackoverflow.com/questions/97197/what-is-the-n1-selects-problem
- Supabase Performance: https://supabase.com/docs/guides/platform/performance
