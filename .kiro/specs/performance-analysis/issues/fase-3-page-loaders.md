# Fase 3: Page-Level Data Loaders - Performance Optimization

**Priority:** 🟢 Medium-Low
**Effort:** 20-28 hours (3-5 days)
**Impact:** -50-60% page load time
**Branch:** `perf/fase-3-page-loaders`

---

## 🎯 Overview

Fase 3 eliminates redundant server actions by implementing **page-level data loaders** that fetch all required data in a single request.

---

## 📊 Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Requests per page | 4-6 requests | 1 request | **-70-80%** |
| Page load time | 2s | 800ms | **-60%** |
| Server roundtrips | Multiple | Single | **Better** |
| Waterfall effect | Yes | No | **Eliminated** |

**Overall:** -50-60% page load latency

---

## 🎯 Problem

Current pages make **multiple independent server actions**:

```typescript
// ❌ Current: 4-6 separate requests
const user = await getCurrentUserAction();
const goals = await getGoalsAction(periodId);
const period = await getPeriodAction(periodId);
const competencies = await getCompetenciesAction();
const departments = await getDepartmentsAction();
```

This causes:
- Multiple roundtrips to server
- Waterfall effect (sequential loading)
- Total latency = sum of all latencies
- Unnecessary overhead per request

---

## ✅ Solution

Create **page-level loaders** that return all data in one request:

```typescript
// ✅ Target: Single request
const pageData = await loadGoalInputPageAction(periodId);
const { user, goals, period, competencies, stageBudgets } = pageData.data;
```

---

## 📝 Implementation

This issue contains **5 sub-tasks** (implement incrementally):

### Priority Pages
1. **Goal Input Page** (highest usage) - 6 hours
2. **Goal List Page** (high usage) - 4 hours
3. **Goal Review Page** (supervisor) - 4 hours

### Optional Pages
4. **Admin Goal List Page** - 4 hours
5. **Evaluation Input Page** - 4 hours

**Recommendation:** Start with #1-#3, measure impact, then decide on #4-#5

---

## Sub-Task 1: Goal Input Page Loader

**Effort:** 6 hours (3h backend + 3h frontend)
**Impact:** -60% requests for goal input page

### Backend Implementation

**Step 1.1: Create Page Schema**

**File:** `backend/app/schemas/page.py` (new file)

```python
from pydantic import BaseModel
from typing import List
from uuid import UUID

class GoalsByCategory(BaseModel):
    performance: List[GoalResponse]
    competency: List[GoalResponse]

class StageWeightBudget(BaseModel):
    quantitative: float
    qualitative: float
    competency: float
    stage_name: str

class GoalInputPageData(BaseModel):
    """All data needed for Goal Input page"""
    user: UserWithStage
    period: EvaluationPeriodResponse
    goals: GoalsByCategory
    competencies: List[CompetencyResponse]
    stage_budgets: StageWeightBudget
```

**Step 1.2: Create Page Service**

**File:** `backend/app/services/page_service.py` (new file)

```python
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

async def get_goal_input_page_data(
    db: AsyncSession,
    current_user: AuthUser,
    period_id: UUID
) -> GoalInputPageData:
    """
    Fetch all data needed for Goal Input page in optimized queries.
    """
    # Fetch all data concurrently
    user_data = await user_service.get_user_with_stage(db, current_user.id)
    period_data = await period_service.get_period(db, period_id)
    goals_data = await goal_service.get_user_goals_by_category(
        db,
        current_user.id,
        period_id
    )
    competencies_data = await competency_service.get_active_competencies(db)

    # Calculate stage budgets
    stage_budgets = StageWeightBudget(
        quantitative=user_data.stage.quantitative_weight,
        qualitative=user_data.stage.qualitative_weight,
        competency=user_data.stage.competency_weight,
        stage_name=user_data.stage.name
    )

    return GoalInputPageData(
        user=user_data,
        period=period_data,
        goals=goals_data,
        competencies=competencies_data,
        stage_budgets=stage_budgets
    )
```

**Step 1.3: Create API Endpoint**

**File:** `backend/app/api/v1/pages.py` (new file)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

router = APIRouter(prefix="/pages", tags=["pages"])

@router.get("/org/{org_slug}/pages/goal-input")
async def get_goal_input_page(
    org_slug: str,
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get all data needed for Goal Input page.

    Returns:
        - User info with stage
        - Evaluation period
        - User's goals (categorized)
        - Available competencies
        - Stage weight budgets
    """
    # Validate org access
    org = await get_organization_by_slug(db, org_slug)
    if not org or org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return await page_service.get_goal_input_page_data(
        db,
        current_user,
        period_id
    )
```

Don't forget to register the router in `main.py`:
```python
from app.api.v1 import pages
app.include_router(pages.router, prefix="/api/v1")
```

### Frontend Implementation

**Step 1.4: Create Types**

**File:** `frontend/src/api/types/page-loaders.ts` (new file)

```typescript
import { UserResponse, StageResponse, EvaluationPeriod, GoalResponse, CompetencyResponse } from './index';

export interface GoalsByCategory {
  performance: GoalResponse[];
  competency: GoalResponse[];
}

export interface StageWeightBudget {
  quantitative: number;
  qualitative: number;
  competency: number;
  stageName: string;
}

export interface GoalInputPageData {
  user: UserResponse & { stage: StageResponse };
  period: EvaluationPeriod;
  goals: GoalsByCategory;
  competencies: CompetencyResponse[];
  stageBudgets: StageWeightBudget;
}
```

**Step 1.5: Create API Endpoint Function**

**File:** `frontend/src/api/endpoints/page-loaders.ts` (new file)

```typescript
import { getHttpClient } from '../client/http-unified-client';
import type { ApiResponse } from '../types';
import type { GoalInputPageData } from '../types/page-loaders';

export const pageLoadersApi = {
  getGoalInputPageData: async (periodId: string): Promise<ApiResponse<GoalInputPageData>> => {
    const client = getHttpClient();
    return await client.get<GoalInputPageData>(
      `/api/v1/pages/goal-input?period_id=${periodId}`
    );
  },
};
```

**Step 1.6: Create Server Action**

**File:** `frontend/src/api/server-actions/page-loaders.ts` (new file)

```typescript
'use server';

import { cache } from 'react';
import { pageLoadersApi } from '../endpoints/page-loaders';
import type { ApiResponse } from '../types';
import type { GoalInputPageData } from '../types/page-loaders';

export const loadGoalInputPageAction = cache(
  async (periodId: string): Promise<ApiResponse<GoalInputPageData>> => {
    try {
      const response = await pageLoadersApi.getGoalInputPageData(periodId);
      return response;
    } catch (error) {
      console.error('Failed to load goal input page data:', error);
      return {
        success: false,
        error: 'Failed to load goal input page data'
      };
    }
  }
);
```

**Step 1.7: Refactor Page to Use Loader**

**File:** `frontend/src/feature/goal-input/display/index.tsx`

**Before (multiple server actions):**
```typescript
// ❌ Multiple calls
const { currentUser } = useUserRoles();
const goals = await getGoalsAction(periodId);
const period = await getPeriodAction(periodId);
const competencies = await getCompetenciesAction();
```

**After (single page loader):**
```typescript
// ✅ Single call
const pageData = await loadGoalInputPageAction(periodId);

if (!pageData.success || !pageData.data) {
  return <div>Error loading page data</div>;
}

const { user, goals, period, competencies, stageBudgets } = pageData.data;
```

---

## Sub-Task 2: Goal List Page Loader

**Effort:** 4 hours
**Files:** Similar structure to Sub-Task 1

**Data to fetch:**
- User info
- Goals for period (with filters)
- Evaluation periods list
- Goal statistics (draft, submitted, approved, rejected)

---

## Sub-Task 3: Goal Review Page Loader

**Effort:** 4 hours
**Files:** Similar structure to Sub-Task 1

**Data to fetch:**
- Supervisor info
- Subordinates list
- Goals to review (filtered by user)
- Review statistics (pending, approved, rejected)

---

## Sub-Task 4: Admin Goal List Page Loader (Optional)

**Effort:** 4 hours

**Data to fetch:**
- Organization-wide goals
- Filter options (users, departments, statuses)
- Goal statistics by department

---

## Sub-Task 5: Evaluation Input Page Loader (Optional)

**Effort:** 4 hours

**Data to fetch:**
- User's goals with competencies
- Self-assessment status
- Evaluation period info

---

## 🧪 Testing Checklist

### Per Page Loader

- [ ] **Build:** No TypeScript errors
- [ ] **Backend:** Endpoint returns all required data
- [ ] **Frontend:** Single request in Network tab
- [ ] **Data:** All data displays correctly on page
- [ ] **Performance:** Page load time improved
- [ ] **Error Handling:** Graceful failure if loader fails

### Integration Testing

- [ ] Navigate to page → single request sent
- [ ] All sections of page populate correctly
- [ ] No missing data
- [ ] No redundant requests
- [ ] Loading states work correctly

### Performance Testing

For each page, measure:

**Before:**
```
Goal Input Page:
- Request 1: getCurrentUser (100ms)
- Request 2: getGoals (150ms)
- Request 3: getPeriod (80ms)
- Request 4: getCompetencies (120ms)
Total: 450ms (sequential)
```

**After:**
```
Goal Input Page:
- Request 1: loadGoalInputPage (180ms)
Total: 180ms (-60% ✅)
```

---

## 📊 Success Metrics

### Overall Impact

| Page | Before | After | Improvement |
|------|--------|-------|-------------|
| Goal Input | 4-6 req, ~2s | 1 req, ~800ms | -60% |
| Goal List | 4-5 req, ~1.5s | 1 req, ~600ms | -60% |
| Goal Review | 5-6 req, ~1.8s | 1 req, ~700ms | -61% |

### Validation Steps

1. Open DevTools Network tab
2. Navigate to page
3. Count requests
4. Measure total time until page fully loaded
5. Compare with baseline

---

## ⚠️ Risk Assessment

### Risk Level: 🟡 MEDIUM

**Why medium risk:**
- Changes multiple pages
- Requires backend changes (new endpoints)
- Complex data aggregation
- Potential for data inconsistencies

**Mitigation:**

1. **Implement incrementally**
   - Start with 1 page (Goal Input)
   - Test thoroughly before moving to next
   - Each page is independent

2. **Maintain backward compatibility**
   - Keep old server actions temporarily
   - Can rollback per-page if needed

3. **Thorough testing**
   - Test all page sections
   - Verify data consistency
   - Test error scenarios

4. **Performance monitoring**
   - Measure before/after for each page
   - Ensure no regressions

---

## 🎯 Implementation Strategy

### Recommended Order:

**Week 1:**
1. Goal Input Page (Days 1-2)
   - Most complex, highest usage
   - If successful, proves the pattern works
2. Goal List Page (Days 3-4)
   - Similar pattern, easier implementation

**Week 2:**
3. Goal Review Page (Days 1-2)
   - Supervisor-specific
4. Measure impact, decide on optional pages (Days 3-5)

**Alternative (Aggressive):**
Implement all 5 pages in parallel if team has 3+ developers.

---

## 📦 Files Summary

### Backend (per page loader)
- `backend/app/schemas/page.py` (new/update)
- `backend/app/services/page_service.py` (new/update)
- `backend/app/api/v1/pages.py` (new/update)

### Frontend (per page loader)
- `frontend/src/api/types/page-loaders.ts` (new/update)
- `frontend/src/api/endpoints/page-loaders.ts` (new/update)
- `frontend/src/api/server-actions/page-loaders.ts` (new/update)
- `frontend/src/app/(evaluation)/[page]/page.tsx` (refactor)

---

## 💬 Commit Message

```
perf(fase-3): implement page-level data loaders

Implement page loaders to fetch all required data in a single
request, eliminating redundant server actions and waterfall effects.

Performance Impact:
- Requests per page: 4-6 → 1 (-70-80%)
- Page load time: 2s → 800ms (-60%)
- Waterfall effect: Eliminated

Pages Implemented:
- Goal Input page loader (4-6 req → 1 req)
- Goal List page loader (4-5 req → 1 req)
- Goal Review page loader (5-6 req → 1 req)

Backend Changes:
- Created page schemas (GoalInputPageData, etc.)
- Created page_service.py with optimized queries
- Added /api/v1/pages/* endpoints
- Implemented concurrent data fetching

Frontend Changes:
- Created page-loaders types
- Created page-loaders API functions
- Created page-loaders server actions
- Refactored pages to use single loader

Testing:
- Verified single request per page
- Measured performance improvements
- Tested all page sections load correctly
- No data inconsistencies found

Closes: Fase 3 - Page-Level Data Loaders

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ Definition of Done

- [ ] At least 3 page loaders implemented (Goal Input, Goal List, Goal Review)
- [ ] All tests pass
- [ ] Performance metrics meet targets:
  - [ ] Goal Input: 1 request, ~800ms
  - [ ] Goal List: 1 request, ~600ms
  - [ ] Goal Review: 1 request, ~700ms
- [ ] All page sections display correctly
- [ ] No functionality regressions
- [ ] Build completes without errors
- [ ] Manual testing completed for all pages
- [ ] Performance improvements documented
- [ ] Code reviewed and approved
- [ ] Merged to develop branch

---

## 📈 Project Complete!

After completing Fase 3:

### Final Impact Summary
- **Fase 1:** -30-40% latency (JWT cache, org slug cache, selective dynamic)
- **Fase 2:** -90% auto-save requests (batch save)
- **Fase 3:** -60% page load time (page loaders)

### Total Improvements
- Static pages TTFB: 500ms → 100ms (-80%)
- Dynamic pages TTFB: 500ms → 200ms (-60%)
- JWT parsing: 20x → 2x per page (-90%)
- Auto-save: 10 req → 1 req (-90%)
- Page load: 2s → 800ms (-60%)

### Next Steps
1. Monitor performance in production
2. Document lessons learned
3. Consider additional optimizations if needed
4. Train team on new patterns

---

**Status:** 🔴 Not Started
**Assignee:** TBD
**Depends on:** Fase 1 & 2 completion recommended (not required)
**Related:** [frontend-performance-gap-analysis.md](../frontend-performance-gap-analysis.md#5--parcial-server-actions-redundantes)
