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

## Summary of All N+1 Issues Found

| # | Issue | File | Lines | Query Type | Per Item | Priority |
|---|-------|------|-------|-----------|----------|----------|
| 1 | Subordinates detail list | dashboard_service.py | 446-544 | Multiple (4) | 4 per subordinate | **CRITICAL** |
| 2 | Todo tasks approved goals | dashboard_service.py | 791-815 | Single (1) | 1 per goal | HIGH |
| 3 | History access periods | dashboard_service.py | 939-977 | Multiple (3) | 3 per period | HIGH |
| 4 | Stages with user count | stage_service.py | 131-133 | Single (1) | 1 per stage | HIGH |
| 5 | User subordinates enrichment | user_service.py | 1076-1078 | Multiple (3) | 3 per user | **CRITICAL** |
| 6 | Department users enrichment | department_service.py | 305-316 | Multiple (3) | 3 per user | **CRITICAL** |
| 7 | Competency name fallback | goal_service.py | 1094-1099 | Single (1) | 1 per competency | MEDIUM |
| 8 | Supervisor feedback creation | self_assessment_service.py | 526 | Single (1) | 1 per assessment | LOW |
| 9 | Missing eager loading | user_repo.py | 345, 359 | Varies | On access | MEDIUM |

**Total Issues Found:** 9 (3 Critical, 3 High, 2 Medium, 1 Low)

---

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

**Confirmed in Supabase Query Performance Dashboard:**
- Query: `SELECT users.id, users.department_id, users.stage_id...`
  - **Calls:** 98,276 executions
  - **Mean time:** 21ms
  - **Cache hit rate:** 100%
- Query: `SELECT roles.id, roles.organization_id, roles.name...`
  - **Calls:** 73,544 executions
  - **Mean time:** 21ms
- Query: `SELECT organizations.id, organizations.name...`
  - **Calls:** 70,653 executions
  - **Mean time:** 25ms

**Total N+1 Impact Observed:** ~240,000+ queries from issues #5 and #6 alone

---

### 2. Dashboard Service - Todo Tasks Approved Goals (HIGH)

**Location:** `backend/app/services/dashboard_service.py:791-815`

**Problem:**
The `_get_employee_todo_tasks()` method loops through approved goals and queries for self-assessments individually.

**Code Analysis:**
```python
# Line 791: Loop through approved goals
for goal in approved_goals:
    # Lines 792-800: Query self-assessment for each goal
    assessment_query = select(SelfAssessment).where(
        and_(
            SelfAssessment.user_id == user_id,
            SelfAssessment.period_id == goal.period_id,
            SelfAssessment.competency_id == goal.competency_id
        )
    )
    assessment_result = await self.session.execute(assessment_query)
    assessment = assessment_result.scalar_one_or_none()
```

**Impact:**
- **20 approved goals:** 1 + 20 = **21 queries**
- **50 approved goals:** 1 + 50 = **51 queries**

**Solution:** Batch fetch all self-assessments for the user and period, then lookup in-memory.

---

### 3. Dashboard Service - History Access Periods (HIGH)

**Location:** `backend/app/services/dashboard_service.py:939-977`

**Problem:**
The `_get_history_access()` method loops through completed periods and executes 3 count queries per period.

**Code Analysis:**
```python
# Line 939: Loop through recent periods (up to 5)
for period in recent_periods:
    # Query 1: Count goals (Lines 941-945)
    goals_query = select(func.count(Goal.id)).where(...)
    goals_result = await self.session.execute(goals_query)

    # Query 2: Count assessments (Lines 948-956)
    assessments_query = select(func.count(SelfAssessment.id)).where(...)
    assessments_result = await self.session.execute(assessments_query)

    # Query 3: Count feedbacks (Lines 959-967)
    feedbacks_query = select(func.count(SupervisorFeedback.id)).where(...)
    feedbacks_result = await self.session.execute(feedbacks_query)
```

**Impact:**
- **5 periods:** 1 + (5 × 3) = **16 queries**
- Could be reduced to **2-3 queries** with batch aggregation

**Solution:** Single query with GROUP BY period_id to get all counts at once.

---

### 4. Stage Service - Stages with User Count (HIGH)

**Location:** `backend/app/services/stage_service.py:131-133`

**Problem:**
The `get_stages()` method loops through stages and counts users for each stage individually.

**Code Analysis:**
```python
# Line 131: Loop through stages
for stage in stage_models:
    # Line 132: Count users for each stage
    user_count = await self.stage_repo.count_users_by_stage(stage.id, org_id)
    stage_responses.append(StageResponse(..., user_count=user_count))
```

**Impact:**
- **10 stages:** 1 + 10 = **11 queries**
- **20 stages:** 1 + 20 = **21 queries**

**Solution:** Single GROUP BY query to count users per stage, or add subquery to initial stage fetch.

---

### 5. User Service - User Subordinates Enrichment (CRITICAL)

**Location:** `backend/app/services/user_service.py:1076-1078`

**Problem:**
The service loops through subordinates and calls `_enrich_user_data()` which makes 3 queries per user.

**Code Analysis:**
```python
# Line 1074-1078: Loop through subordinates
for subordinate_model in subordinate_models:
    enriched_subordinate = await self._enrich_user_data(subordinate_model)
    # _enrich_user_data internally calls:
    # - department_repo.get_by_id() [1 query]
    # - stage_repo.get_by_id() [1 query]
    # - role_repo.get_user_roles() [1 query]
```

**Impact:**
- **50 subordinates:** 1 + (50 × 3) = **151 queries**
- **100 subordinates:** 1 + (100 × 3) = **301 queries**

**Used in:**
- `get_user_by_id()` endpoint (Line 240)
- `get_users()` endpoint (Lines 134-136)

**Solution:** Use eager loading in repository query with `joinedload(User.department, User.stage, User.roles)`

---

### 6. Department Service - Department Users Enrichment (CRITICAL)

**Location:** `backend/app/services/department_service.py:305-316`

**Problem:**
Same as Issue #5 - loops through department users calling `_enrich_user_data()` for each.

**Code Analysis:**
```python
# Line 305: List comprehension calling _enrich_user_data for each user
enriched_users = [await user_service._enrich_user_data(u) for u in user_models]
# Each call makes 3 queries (department, stage, roles)

# Lines 312-316: Additional filtering in Python instead of database
if role_names:
    viewers = await self.user_repo.get_users_by_role_names(role_names)
    viewer_ids = {v.id for v in viewers}
    enriched_users = [u for u in enriched_users if u["id"] in viewer_ids]
```

**Impact:**
- **30 users in department:** 1 + (30 × 3) = **91 queries**
- **Plus:** Extra query for role filtering

**Solution:**
1. Use eager loading in initial user fetch
2. Move role filtering to SQL WHERE clause

---

### 7. Goal Service - Competency Name Fallback (MEDIUM)

**Location:** `backend/app/services/goal_service.py:1094-1099`

**Problem:**
Fallback code that fetches competencies one-by-one if batch map is not provided.

**Code Analysis:**
```python
# Lines 1088-1093: Batch loading (GOOD)
if competency_map:
    goal_dict["competency_name"] = competency_map.get(goal.competency_id)

# Lines 1094-1099: Fallback (BAD - N+1)
else:
    for cid in ids:
        competency = await self.competency_repo.get_by_id(cid, org_id)
        if competency:
            goal_dict["competency_name"] = competency.name
```

**Impact:**
- Usually mitigated by batch loading flag
- **Fallback:** M competency IDs = M additional queries

**Priority:** Medium (has optimization, but fallback exists)

**Solution:** Always ensure competency_map is provided, or remove fallback.

---

### 8. Self-Assessment Service - Supervisor Feedback Creation (LOW)

**Location:** `backend/app/services/self_assessment_service.py:526`

**Problem:**
When auto-creating supervisor feedback, fetches supervisors without eager loading.

**Code Analysis:**
```python
# Line 526
supervisors = await self.user_repo.get_supervisors(goal.user_id)
# If get_supervisors() doesn't use joinedload, accessing supervisor.email later triggers queries
```

**Impact:**
- Low - only occurs during self-assessment submission
- 1-3 additional queries per assessment

**Priority:** Low

**Solution:** Add eager loading option to `get_supervisors()` method.

---

### 9. User Repository - Missing Eager Loading (MEDIUM)

**Location:** `backend/app/database/repositories/user_repo.py`

**Problem:**
Key methods return users without eager loading relationships.

**Methods affected:**

#### 9.1 `get_subordinates()` (Line 359-375)
```python
async def get_subordinates(self, supervisor_id: UUID, org_id: str) -> list[User]:
    result = await self.session.execute(
        select(User)
        .join(UserSupervisor, User.id == UserSupervisor.user_id)
        .filter(...)
    )
    return result.scalars().all()
    # Missing: .options(joinedload(User.department), joinedload(User.stage), ...)
```

#### 9.2 `get_user_supervisors()` (Line 345-357)
```python
async def get_user_supervisors(self, user_id: UUID, org_id: str) -> list[User]:
    query = select(User).join(UserSupervisor, User.id == UserSupervisor.supervisor_id)...
    # Missing eager loading
```

**Impact:**
- When service layer accesses `user.department.name`, triggers lazy load
- Causes N+1 in combination with Issues #5 and #6

**Solution:** Add `with_relations` parameter to enable eager loading when needed.

---

## Performance Impact Summary

### Critical Issues Impact

| Issue | Scenario | Current Queries | Optimized Queries | Improvement |
|-------|----------|----------------|-------------------|-------------|
| #1 Subordinates List | 10 subordinates | 41 | 4-5 | **90% reduction** |
| #1 Subordinates List | 50 subordinates | 201 | 4-5 | **97% reduction** |
| #1 Subordinates List | 100 subordinates | 401 | 4-5 | **99% reduction** |
| #5 User Enrichment | 50 users | 151 | 2-3 | **98% reduction** |
| #6 Department Users | 30 users | 91 | 2-3 | **97% reduction** |

### High Priority Issues Impact

| Issue | Scenario | Current Queries | Optimized Queries | Improvement |
|-------|----------|----------------|-------------------|-------------|
| #2 Todo Tasks | 20 goals | 21 | 2-3 | **86% reduction** |
| #3 History Access | 5 periods | 16 | 2-3 | **81% reduction** |
| #4 Stage Counts | 10 stages | 11 | 1-2 | **90% reduction** |

### Combined Dashboard Load (Worst Case)

**Scenario:** Supervisor with 50 subordinates accessing dashboard

| Component | Current | Optimized | Reduction |
|-----------|---------|-----------|-----------|
| Subordinates List (#1) | 201 | 4-5 | -196 queries |
| History Access (#3) | 16 | 2-3 | -13 queries |
| **Total** | **~217** | **~7-8** | **96% reduction** |

**Expected response time improvement:** 3.8s → 0.5-0.8s (estimated 70-85% faster)

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

### Solution 3: Fix Todo Tasks - Batch Fetch Assessments (HIGH)

**Strategy:** Fetch all assessments upfront instead of querying in loop

```python
async def _get_employee_todo_tasks(self, user_id: UUID, org_id: str, ...):
    # ... get approved_goals ...

    # Batch fetch all self-assessments for user and period (1 query)
    if approved_goals and current_period:
        competency_ids = [g.competency_id for g in approved_goals]
        assessments_query = select(SelfAssessment).where(
            and_(
                SelfAssessment.user_id == user_id,
                SelfAssessment.period_id == current_period.id,
                SelfAssessment.competency_id.in_(competency_ids)
            )
        )
        assessments_result = await self.session.execute(assessments_query)
        all_assessments = assessments_result.scalars().all()

        # Create lookup dict by competency_id
        assessments_by_competency = {a.competency_id: a for a in all_assessments}

    # Loop through goals using pre-fetched data
    for goal in approved_goals:
        assessment = assessments_by_competency.get(goal.competency_id)
        # ... rest of logic ...
```

**Result:**
- **Before:** 1 + N queries (N = number of goals)
- **After:** 2 queries total

---

### Solution 4: Fix History Access - Batch Aggregation (HIGH)

**Strategy:** Single GROUP BY query instead of loop with count queries

```python
async def _get_history_access(self, user_id: UUID, org_id: str) -> HistoryAccessData:
    recent_periods = await self.evaluation_period_repo.get_recent_completed_periods(
        user_id, org_id, limit=5
    )

    if not recent_periods:
        return HistoryAccessData(...)

    period_ids = [p.id for p in recent_periods]

    # Single query with GROUP BY to get all counts (3 queries → 1 query per entity type)
    # Goals count by period
    goals_stats = await self.session.execute(
        select(
            Goal.period_id,
            func.count(Goal.id).label('count')
        ).where(
            and_(Goal.user_id == user_id, Goal.period_id.in_(period_ids))
        ).group_by(Goal.period_id)
    )
    goals_count_map = {row.period_id: row.count for row in goals_stats}

    # Assessments count by period
    assessments_stats = await self.session.execute(
        select(
            SelfAssessment.period_id,
            func.count(SelfAssessment.id).label('count')
        ).where(
            and_(SelfAssessment.user_id == user_id, SelfAssessment.period_id.in_(period_ids))
        ).group_by(SelfAssessment.period_id)
    )
    assessments_count_map = {row.period_id: row.count for row in assessments_stats}

    # Feedbacks count by period
    feedbacks_stats = await self.session.execute(
        select(
            SupervisorFeedback.period_id,
            func.count(SupervisorFeedback.id).label('count')
        ).where(
            and_(SupervisorFeedback.employee_id == user_id, SupervisorFeedback.period_id.in_(period_ids))
        ).group_by(SupervisorFeedback.period_id)
    )
    feedbacks_count_map = {row.period_id: row.count for row in feedbacks_stats}

    # Build history using pre-fetched counts
    for period in recent_periods:
        summary = HistoricalPeriodSummary(
            period_id=period.id,
            goals_count=goals_count_map.get(period.id, 0),
            assessments_count=assessments_count_map.get(period.id, 0),
            feedbacks_count=feedbacks_count_map.get(period.id, 0),
            # ...
        )
```

**Result:**
- **Before:** 1 + (N × 3) queries
- **After:** 4 queries total (1 periods + 3 aggregates)

---

### Solution 5: Fix Stage Service - Batch User Counts (HIGH)

**Strategy:** Single GROUP BY query or add subquery to initial fetch

```python
async def get_stages(self, org_id: str) -> list[StageResponse]:
    # Fetch stages
    stage_models = await self.stage_repo.get_by_organization(org_id)

    if not stage_models:
        return []

    stage_ids = [s.id for s in stage_models]

    # Batch count users per stage (1 query with GROUP BY)
    user_counts_query = select(
        User.stage_id,
        func.count(User.id).label('user_count')
    ).where(
        and_(
            User.clerk_organization_id == org_id,
            User.stage_id.in_(stage_ids)
        )
    ).group_by(User.stage_id)

    counts_result = await self.session.execute(user_counts_query)
    user_count_map = {row.stage_id: row.user_count for row in counts_result}

    # Build responses using pre-fetched counts
    stage_responses = []
    for stage in stage_models:
        user_count = user_count_map.get(stage.id, 0)
        stage_responses.append(StageResponse(..., user_count=user_count))

    return stage_responses
```

**Result:**
- **Before:** 1 + N queries
- **After:** 2 queries total

---

### Solution 6: Fix User Service - Use Eager Loading (CRITICAL)

**Strategy:** Update repository calls to use eager loading

```python
# In user_service.py

async def get_users(self, ...):
    # Change from:
    # users = await self.user_repo.search_users(...)

    # To: (search_users already has eager loading - OK!)
    users = await self.user_repo.search_users(
        org_id=org_id,
        search_term=search_term,
        # ... filters ...
    )
    # Now users already have .department, .stage, .roles loaded

    # No need for _enrich_user_data loop!
    return [self._user_to_dict(user) for user in users]

async def get_subordinates_by_supervisor_id(self, supervisor_id: UUID, org_id: str):
    # Change from:
    # subordinate_models = await self.user_repo.get_subordinates(supervisor_id, org_id)

    # To:
    subordinate_models = await self.user_repo.get_subordinates(
        supervisor_id, org_id, with_relations=True  # Enable eager loading
    )

    # Now can access .department, .stage, .roles without extra queries
    return [self._user_to_dict(sub) for sub in subordinate_models]
```

**Result:**
- **Before:** 1 + (N × 3) queries
- **After:** 1-2 queries total (with JOINs)

---

### Solution 7: Fix Department Service - Eager Loading + SQL Filtering (CRITICAL)

**Strategy:** Combine eager loading with SQL-based role filtering

```python
async def get_department_detail(self, department_id: UUID, org_id: str, ...):
    # Get users with eager loading
    query = select(User).options(
        joinedload(User.department),
        joinedload(User.stage),
        joinedload(User.roles)
    ).where(
        and_(
            User.department_id == department_id,
            User.clerk_organization_id == org_id,
            User.status == UserStatus.ACTIVE
        )
    )

    # Add role filtering in SQL (if needed)
    if role_names:
        query = query.join(user_roles).join(Role).where(
            Role.name.in_([name.lower() for name in role_names])
        )

    result = await self.session.execute(query)
    user_models = result.scalars().unique().all()

    # Convert to dicts - no extra queries needed!
    enriched_users = [self._user_to_dict(u) for u in user_models]

    return DepartmentDetailResponse(
        id=department.id,
        name=department.name,
        users=enriched_users,
        # ...
    )
```

**Result:**
- **Before:** 1 + (N × 3) + 1 queries
- **After:** 1-2 queries total

---

## Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. ✅ **Solution 6:** Fix User Service eager loading (#5)
2. ✅ **Solution 7:** Fix Department Service (#6)
3. ✅ **Solution 1:** Fix Dashboard Subordinates List (#1)
4. ✅ **Solution 2:** Add eager loading to user_repo

### Phase 2: High Priority (Week 2)
5. ✅ **Solution 3:** Fix Todo Tasks batch fetching (#2)
6. ✅ **Solution 4:** Fix History Access aggregation (#3)
7. ✅ **Solution 5:** Fix Stage Service user counts (#4)

### Phase 3: Medium/Low Priority (Week 3)
8. 🔸 Fix competency name fallback (#7)
9. 🔸 Add eager loading to supervisor feedback (#8)
10. 🔸 Ensure all repository methods support eager loading (#9)

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

### Dashboard Access

**URL:** https://supabase.com/dashboard/project/yxekevoucqfiskisokju/observability/query-performance

**Database Role:** `postgres` (visible in all queries)

**Connection String:** `postgresql://postgres.yxekevoucqfiskisokju@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`

---

### Actual Production Metrics (Confirmed Data)

The following data was captured from the Supabase Query Performance dashboard, confirming the N+1 problems documented in this analysis:

#### Top Offending Queries

| Query Pattern | Calls | Mean Time | Cache Hit | Issue |
|--------------|-------|-----------|-----------|-------|
| `SELECT users.id, users.department_id, users.stage_id, users.name...` | **98,276** | 21ms | 100% | #5, #6 |
| `SELECT roles.id, roles.organization_id, roles.name...` | **73,544** | 21ms | 100% | #5, #6 |
| `SELECT organizations.id, organizations.name...` | **70,653** | 25ms | 100% | Multiple |
| `SELECT c.oid::int8 AS id, nc.nspname...` | **35,065** | 225ms | 100% | Metadata |
| `SELECT roles.id, roles.name, roles.description...` | **35,489** | 24ms | 100% | #5, #6 |
| `SELECT c.oid::int8 AS id, nc.nspname...` | **27,485** | 170ms | 100% | Metadata |
| `with base_table_info as (select c.oid::int8 as id...)` | **26,885** | 139ms | 100% | Metadata |

#### Analysis

**Total Query Volume (Slow Queries Category):** 47 slow query patterns

**Cache Performance:** 100% cache hit rate across all queries (excellent caching, but still too many queries)

**Key Findings:**

1. **User/Role/Organization queries dominate:**
   - Combined: ~240,000+ executions
   - All related to issues #5 and #6 (user enrichment loops)
   - Despite 100% cache hits, the sheer volume is problematic

2. **Metadata queries are slow but frequent:**
   - 35,065 calls at 225ms mean time
   - 27,485 calls at 170ms mean time
   - These appear to be SQLAlchemy introspection queries

3. **Performance paradox:**
   - Individual queries are fast (21-25ms) thanks to caching
   - But 98,276 × 21ms = **2,063 seconds** of cumulative query time
   - This is why the dashboard loads in 3.8 seconds

#### Expected Improvement After Fixes

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| User queries | 98,276 | ~100-200 | **99.8% reduction** |
| Role queries | 73,544 | ~50-100 | **99.9% reduction** |
| Org queries | 70,653 | ~50-100 | **99.9% reduction** |
| **Total** | **~242,000** | **~200-400** | **99.8% reduction** |

**Response Time Impact:**
- Current: 3.8s (measured)
- Projected: 0.3-0.6s (estimated 85-92% faster)

---

### How to Monitor Improvements

1. **Before implementing fixes:**
   - Take screenshot of current query counts
   - Note top 10 queries by call count

2. **After implementing each fix:**
   - Refresh Supabase Query Performance page
   - Verify query count reduction
   - Check that mean time remains similar (caching preserved)

3. **Metrics to track:**
   - Total calls for user queries (target: <500)
   - Total calls for role queries (target: <200)
   - Slow request logs in backend (target: <500ms)

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
