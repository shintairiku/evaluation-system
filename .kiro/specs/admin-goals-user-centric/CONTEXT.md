# Context: Relationship to Existing Admin Goal List

## 📋 Overview

This specification (admin-goals-user-centric) is a **refactoring and enhancement** of the existing Admin Goal List feature, not a brand new feature from scratch.

**GitHub Issue**: [#337](https://github.com/shintairiku/evaluation-system/issues/337)
**Previous Spec**: `.kiro/specs/Admin_goal_list_page/` (6,297 lines)
**Current Status**: Admin Goal List already implemented on branch `feat/admin-goal-list-page`

---

## 🔄 Evolution Timeline

### Phase 1: Initial Implementation ✅ (DONE)
**Branch**: `feat/admin-goal-list-page`
**Spec**: `.kiro/specs/Admin_goal_list_page/`
**Status**: Implemented and merged to develop

**What was built:**
- ✅ `/admin/goal-list` route (goal-centric view)
- ✅ `AdminGoalListTable` component (one row per goal)
- ✅ `useAdminGoalListData` hook (sequential fetching)
- ✅ Backend endpoint: `GET /api/org/{org_slug}/admin/goals`
- ✅ Filters: status, category, department, user
- ✅ Batch optimization: `includeReviews=true` by default
- ✅ 19 files modified, ~1,450 lines of production code

**Issues discovered after implementation:**
- ⚠️ Sequential pagination is slow (5-10s for 600+ goals)
- ⚠️ Goal-centric view (one row per goal) makes compliance tracking difficult
- ⚠️ Multiple rows per user is confusing for auditing

---

### Phase 2: Refactoring for Code Quality ✅ (DONE)
**Branch**: Same branch
**Spec**: `.kiro/specs/Admin_goal_list_page/refactoring.md`
**Status**: Completed

**What was improved:**
- ✅ Reduced code duplication (~600 lines consolidated)
- ✅ Improved maintainability (-18% total code)
- ✅ Better documentation (JSDoc)
- ✅ Removed deprecated code (58 lines)
- ✅ 0 functional changes (pixel-perfect identical)

---

### Phase 3: User-Centric View + Performance ⬅️ **THIS SPEC**
**Branch**: `feature/admin-goals-user-centric-view` (to be created)
**Spec**: `.kiro/specs/admin-goals-user-centric/` (this directory)
**Status**: 📋 Planning (specification complete)

**What will be built:**
- 🎯 **Option A** (Recommended): Replace `/admin/goal-list` with user-centric view
  - Direct evolution of existing page
  - No route confusion
  - Maintains URL consistency

- 🎯 **Option B**: Create new route `/admin/users-goals`
  - Keep old route as fallback
  - Gradual migration
  - More work to maintain two routes

**Improvements:**
- ✅ User-centric view (one row per user, not per goal)
- ✅ Concurrent data fetching (5x faster: 5-10s → 0.8-2s)
- ✅ Better compliance auditing
- ✅ Aggregated goal counts and status per user
- ✅ Click user row → see all user's goals

**What stays the same:**
- ✅ Backend endpoint: `/admin/goals` (no changes needed)
- ✅ Permission system: `GOAL_READ_ALL`
- ✅ Data structure: Same GoalResponse from API
- ✅ Existing components can be reused

---

## 🔗 Relationship Between Specs

```
Admin_goal_list_page/          admin-goals-user-centric/
├── ISSUE.md                   ├── ISSUE.md ⭐ (extends original)
├── requirements.md            ├── requirements.md ⭐ (adds performance)
├── design.md                  ├── design.md ⭐ (concurrent fetching)
├── tasks.md                   ├── tasks.md ⭐ (refactoring tasks)
└── refactoring.md             └── CONTEXT.md ⭐ (this file)
    (code quality)                 (user-centric + perf)
```

### Key Differences

| Aspect | Admin_goal_list_page | admin-goals-user-centric |
|--------|---------------------|--------------------------|
| **Purpose** | Initial implementation | Performance & UX refactoring |
| **View** | Goal-centric (1 row = 1 goal) | User-centric (1 row = 1 user) |
| **Fetching** | Sequential (slow) | Concurrent (fast) |
| **Load Time** | 5-10s (600 goals) | <2s (target) |
| **Use Case** | View all goals | Audit compliance |
| **Status** | ✅ Implemented | 📋 Planning |

---

## 🎯 Why This Refactoring is Needed

### Problem 1: Performance (Slow Sequential Fetching)

**Current Code** (`useAdminGoalListData.ts` lines 231-266):
```typescript
// SEQUENTIAL (SLOW)
const firstPageResult = await getAdminGoalsAction({ page: 1 });

for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
  const pageResult = await getAdminGoalsAction({ page: nextPage }); // Waits!
}
```

**Timeline for 600 goals (6 pages):**
```
Page 1: 500ms → Page 2: 500ms → Page 3: 500ms → ...
Total: ~4,200ms (4.2 seconds)
```

**Proposed Solution:**
```typescript
// CONCURRENT (FAST)
const promises = Array.from({ length: totalPages }, (_, i) =>
  getAdminGoalsAction({ page: i + 1 })
);
const results = await Promise.allSettled(promises); // All parallel!
```

**Timeline for 600 goals (6 pages):**
```
All pages: 500ms max (concurrent)
Total: ~800ms (0.8 seconds) → 5.25x faster!
```

---

### Problem 2: Usability (Goal-Centric View)

**Current View** (one row per goal):
```
| User      | Goal                      | Status   |
|-----------|---------------------------|----------|
| 山田太郎   | 理念理解の目標              | 承認済み  |
| 山田太郎   | 積極性の目標                | 承認済み  |
| 山田太郎   | 伝達力の目標                | 下書き    |
| 佐藤花子   | 理念理解の目標              | 提出済み  |
| 佐藤花子   | 積極性の目標                | 下書き    |
...
```

**Issues:**
- ❌ 6 goals per user = 6 rows (confusing)
- ❌ Hard to see which users have incomplete goals
- ❌ Cannot quickly identify compliance issues
- ❌ Poor for auditing purposes

**Proposed View** (one row per user):
```
| User      | Goals     | Status Summary          | Last Activity |
|-----------|-----------|-------------------------|---------------|
| 山田太郎   | 6/6       | 承認済み: 5, 下書き: 1    | 2024-03-15   |
| 佐藤花子   | 8/8       | 提出済み: 6, 下書き: 2    | 2024-03-14   |
| 鈴木一郎   | 0/6       | 目標未設定               | -            |
```

**Benefits:**
- ✅ Easy to scan (one row per user)
- ✅ Instant compliance checking (who has 0 goals?)
- ✅ Aggregated status (at a glance)
- ✅ Click row → see all user's goals

---

## 🚀 Implementation Strategy

### Option A: Replace Existing Route (Recommended)

**Pros:**
- ✅ Clean migration, no confusion
- ✅ Single source of truth
- ✅ Maintains URL consistency
- ✅ Users automatically get better UX

**Cons:**
- ⚠️ Requires thorough testing
- ⚠️ Need rollback plan

**Approach:**
1. Implement user-centric view in same route `/admin/goal-list`
2. Update `useAdminGoalListData` with concurrent fetching
3. Replace `AdminGoalListTable` with `AdminUsersGoalsTable`
4. Add link to user detail view
5. Deploy behind feature flag initially
6. Gradual rollout (10% → 50% → 100%)

---

### Option B: New Route (Alternative)

**Pros:**
- ✅ Safe rollback (keep old route)
- ✅ A/B testing easy
- ✅ Gradual migration

**Cons:**
- ❌ Two routes to maintain
- ❌ URL confusion (/admin/goal-list vs /admin/users-goals)
- ❌ Need to redirect eventually

**Approach:**
1. Create new route `/admin/users-goals`
2. Keep `/admin/goal-list` as-is
3. Update navigation to point to new route
4. Add banner on old route: "Try new view"
5. Deprecate old route after 2 weeks
6. Redirect old → new

---

## 📊 Success Metrics

### Performance
- ✅ **Load time**: p95 ≤ 2s (vs current 5-10s) → **75% improvement**
- ✅ **Request pattern**: Concurrent (5-10 parallel vs sequential)
- ✅ **Memory**: < 100MB (acceptable)

### Usability
- ✅ **Compliance checking**: < 30s to identify all users without goals
- ✅ **User preference**: 80%+ prefer new view (survey)
- ✅ **Time to audit**: 50% reduction

### Technical
- ✅ **Code quality**: Maintain or improve
- ✅ **Test coverage**: ≥ existing coverage
- ✅ **Error rate**: No increase

---

## 🔄 Migration Checklist

### Pre-Migration
- [ ] Review this context document
- [ ] Review GitHub Issue #337
- [ ] Review existing implementation in `feat/admin-goal-list-page`
- [ ] Understand current code structure
- [ ] Decide: Option A (replace) or Option B (new route)

### During Implementation
- [ ] Follow tasks.md step-by-step
- [ ] Reuse existing components where possible
- [ ] Keep `/admin/goals` endpoint as-is (no backend changes)
- [ ] Maintain backward compatibility
- [ ] Add feature flag for gradual rollout

### Post-Implementation
- [ ] Performance testing (verify < 2s load)
- [ ] Functional testing (all features work)
- [ ] User feedback collection
- [ ] Update documentation
- [ ] Consider optional backend endpoint (Phase 4)

---

## 📚 References

**Original Implementation:**
- Spec: `.kiro/specs/Admin_goal_list_page/`
- Branch: `feat/admin-goal-list-page`
- Files: `frontend/src/feature/evaluation/admin/admin-goal-list/`

**This Refactoring:**
- Spec: `.kiro/specs/admin-goals-user-centric/`
- GitHub Issue: [#337](https://github.com/shintairiku/evaluation-system/issues/337)
- Proposed Branch: `feature/admin-goals-user-centric-view`

**Related Docs:**
- Backend endpoint: `backend/app/api/v1/admin.py`
- Current hook: `frontend/src/feature/evaluation/admin/admin-goal-list/hooks/useAdminGoalListData.ts`
- RBAC permissions: `backend/app/security/permissions.py` (GOAL_READ_ALL)

---

## ✅ Approval Checklist

Before starting implementation, confirm:

- [ ] This spec **extends** (not replaces) existing Admin Goal List
- [ ] GitHub Issue #337 is the source of truth for requirements
- [ ] Backend endpoint `/admin/goals` needs **no changes**
- [ ] This is a **frontend refactoring** (mainly)
- [ ] Performance target is realistic (p95 ≤ 2s)
- [ ] User-centric view solves real usability issues
- [ ] Implementation plan is clear and achievable
- [ ] Migration strategy decided (Option A or B)
- [ ] Testing plan is comprehensive
- [ ] Rollback plan exists

---

**Last Updated**: 2024-11-04
**Status**: 📋 Ready for Implementation
**Recommendation**: **APPROVE** - This refactoring addresses real issues and is well-planned.
