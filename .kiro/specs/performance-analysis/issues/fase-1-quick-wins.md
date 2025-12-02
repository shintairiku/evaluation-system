# Fase 1: Quick Wins - Performance Optimization

**Priority:** 🔴 Critical
**Effort:** 8 hours (1 day)
**Impact:** -30-40% overall latency
**Branch:** `perf/fase-1-quick-wins`

---

## 🎯 Overview

Fase 1 delivers **maximum performance improvement with minimum risk** by implementing 3 critical optimizations that are quick to implement and have immediate impact.

---

## 📊 Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| JWT parsing calls | 20x/page | 2x/page | **-90%** |
| Org slug fetches | 20x/page | 2x/page | **-90%** |
| TTFB (static pages) | 500ms | 100ms | **-80%** |
| TTFB (dynamic pages) | 500ms | 250ms | **-50%** |
| Server action latency | 300ms | 200ms | **-33%** |

**Overall latency reduction:** -30-40%

---

## ✅ Tasks (3)

### Task 1: Add React.cache() to JWT Parser
**Effort:** 1 hour | **Impact:** -90% JWT parsing calls

**Problem:** JWT parsing happens 15-20x per request (repeated `auth()` and `getToken()` calls)

**Solution:** Wrap `getCurrentOrgSlug()` and `getCurrentOrgContext()` with `React.cache()`

**Files:**
- `frontend/src/api/utils/jwt-parser.ts`

**Changes:**
```typescript
import { cache } from 'react';

// Before
export async function getCurrentOrgSlug(): Promise<string | null> { ... }

// After
export const getCurrentOrgSlug = cache(async (): Promise<string | null> => { ... });
```

**Testing:**
- [ ] Build completes
- [ ] JWT parsing reduced to 1-2x per request
- [ ] Org switching still works

---

### Task 2: Fix Org Slug Caching
**Effort:** 2 hours | **Impact:** -80% org slug recomputation

**Problem:** `getOrgSlug()` always calls `fetchOrgSlug()`, ignoring existing cache

**Solution:** Implement actual caching using `orgSlugPromise`

**Files:**
- `frontend/src/api/client/http-unified-client.ts`

**Changes:**
```typescript
// Before (always fetches)
private async getOrgSlug(): Promise<string | null> {
  return this.fetchOrgSlug();
}

// After (uses cache)
private async getOrgSlug(): Promise<string | null> {
  if (this.orgSlugPromise) {
    return this.orgSlugPromise;
  }
  this.orgSlugPromise = this.fetchOrgSlug();
  const result = await this.orgSlugPromise;
  this.orgSlug = result;
  return result;
}
```

**Testing:**
- [ ] Org slug fetched only once per page
- [ ] Org switching clears cache correctly
- [ ] No cache bleed between users

---

### Task 3: Remove Global Dynamic Rendering
**Effort:** 5 hours | **Impact:** -50-80% TTFB

**Problem:** Global `dynamic = 'force-dynamic'` disables all static optimizations

**Solution:**
1. Remove from `app/layout.tsx`
2. Add to 18 pages that need dynamic rendering
3. Keep 3 pages static

**Files:**
- `frontend/src/app/layout.tsx` (remove line 17)
- 18 page files (add `export const dynamic = 'force-dynamic';`)

**Pages requiring dynamic (18):**

**Employee & Supervisor (10):**
- `app/page.tsx`
- `app/(evaluation)/goal-input/page.tsx`
- `app/(evaluation)/(employee)/goal-list/page.tsx`
- `app/(evaluation)/(employee)/goal-edit/[goalId]/page.tsx`
- `app/(evaluation)/(employee)/evaluation-input/page.tsx`
- `app/(evaluation)/(supervisor)/goal-review/page.tsx`
- `app/(evaluation)/(supervisor)/evaluation-feedback/page.tsx`
- `app/org/page.tsx`
- `app/(auth)/setup/page.tsx`
- `app/(auth)/setup/confirmation/page.tsx`

**Admin (8):**
- `app/(evaluation)/(admin)/admin-goal-list/page.tsx`
- `app/(evaluation)/(admin)/admin-goal-list/[userId]/page.tsx`
- `app/(evaluation)/user-profiles/page.tsx`
- `app/(evaluation)/(admin)/org-management/page.tsx`
- `app/(evaluation)/(admin)/stage-management/page.tsx`
- `app/(evaluation)/(admin)/competency-management/page.tsx`
- `app/(evaluation)/(admin)/evaluation-period-management/page.tsx`
- `app/(evaluation)/(admin)/report/page.tsx`

**Static pages (3) - NO dynamic export:**
- `app/access-denied/page.tsx`
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

**Testing:**
- [ ] Build completes successfully
- [ ] Static pages TTFB < 150ms
- [ ] Dynamic pages still work
- [ ] Auth flow works (sign in/out)
- [ ] Org switching works

---

## 🧪 Complete Testing Checklist

### Build & Type Check
- [ ] `npm run build` completes without errors
- [ ] No TypeScript errors
- [ ] No ESLint warnings

### Performance Testing
- [ ] Measure JWT parsing calls (should be ~2x vs 20x before)
- [ ] Measure org slug fetches (should be ~2x vs 20x before)
- [ ] Measure TTFB for `/access-denied` (should be < 150ms)
- [ ] Measure TTFB for `/sign-in` (should be < 150ms)
- [ ] Measure TTFB for `/goal-input` (should be < 350ms)

### Functional Testing
- [ ] Complete auth flow: sign out → sign in → redirect
- [ ] Navigate through all main pages
- [ ] Test org switching (if multi-org setup)
- [ ] Test with 2 different users (different browsers)
- [ ] Create/edit goals (auto-save should work)

### Static Pages Test
```bash
# Verify static pages are pre-rendered
npm run build
ls -la .next/server/app/access-denied/
# Should see .html file
```

---

## 📊 Success Metrics

### Measurements Required

1. **JWT Parsing Calls**
```typescript
// Add temporary logging
console.log('[Perf] JWT parsing called');
// Count: Should be ~2 per page (vs 20 before)
```

2. **Org Slug Fetches**
```typescript
// Add temporary logging
console.log('[Perf] Org slug fetch');
// Count: Should be ~2 per page (vs 20 before)
```

3. **TTFB Measurements**
- Open DevTools → Network tab
- Navigate to page
- Check "Timing" section for TTFB

**Targets:**
- Static pages: < 150ms
- Dynamic pages: < 350ms

---

## 🚀 Implementation Order

### Recommended Sequence:

**Step 1 (1h):** Task 1 - JWT Parser Cache
- Easiest, safest, immediate impact
- Test before moving to next

**Step 2 (2h):** Task 2 - Org Slug Cache
- Similar to Task 1, builds on same concept
- Test before moving to next

**Step 3 (5h):** Task 3 - Dynamic Rendering
- Largest task, touch many files
- Test thoroughly before merging

**Total:** ~8 hours (1 full day of work)

---

## ⚠️ Risk Assessment

### Risk Level: 🟢 LOW

**Why low risk:**
- Caching improvements are isolated
- Dynamic rendering already works (just moving it)
- All changes are additive (no breaking changes)
- Easy to rollback if needed

**Potential Issues:**

1. **Cache stale after org switching**
   - **Mitigation:** Already handled by `clearOrgSlugCache()`
   - **Validation:** Test org switching manually

2. **Build fails after removing global dynamic**
   - **Mitigation:** Dynamic added selectively to pages that need it
   - **Validation:** Run `npm run build` after each change

3. **Static pages show auth errors**
   - **Mitigation:** Static pages (access-denied, sign-in/up) don't need auth
   - **Validation:** Test these pages work without auth

---

## 📦 Files Summary

### Modified (3 files)
- `frontend/src/api/utils/jwt-parser.ts`
- `frontend/src/api/client/http-unified-client.ts`
- `frontend/src/app/layout.tsx`

### Dynamic added (18 files)
- All employee/supervisor/admin pages

### Verified static (3 files)
- access-denied, sign-in, sign-up

---

## 💬 Commit Message

```
perf(fase-1): implement quick wins optimizations

Implement 3 critical performance optimizations:
1. Add React.cache() to JWT parser
2. Fix org slug caching in HTTP client
3. Remove global dynamic, add selective dynamic rendering

Performance Impact:
- JWT parsing: 20x → 2x per page (-90%)
- Org slug fetches: 20x → 2x per page (-90%)
- TTFB (static): 500ms → 100ms (-80%)
- TTFB (dynamic): 500ms → 250ms (-50%)
- Overall latency: -30-40%

Changes:
Task 1:
- Wrap getCurrentOrgSlug() with React.cache()
- Wrap getCurrentOrgContext() with React.cache()

Task 2:
- Implement actual caching in getOrgSlug()
- Reuse orgSlugPromise instead of always fetching

Task 3:
- Remove global dynamic from layout.tsx
- Add dynamic to 18 user-specific pages
- Keep 3 pages static (access-denied, sign-in, sign-up)

Testing:
- All builds complete successfully
- JWT parsing reduced to 2x per page
- Org slug cached properly
- Static pages TTFB < 150ms
- Auth flow works correctly
- Org switching works correctly

Closes: Fase 1 - Quick Wins

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ Definition of Done

- [ ] All 3 tasks completed
- [ ] All tests pass
- [ ] Performance metrics meet targets:
  - [ ] JWT parsing: 2x per page
  - [ ] Org slug: 2x per page
  - [ ] Static TTFB: < 150ms
  - [ ] Dynamic TTFB: < 350ms
- [ ] No functionality regressions
- [ ] Build completes without errors
- [ ] Manual testing completed
- [ ] Performance improvements documented
- [ ] Code reviewed and approved
- [ ] Merged to develop branch

---

## 📈 Next Steps

After completing Fase 1:
1. Measure and document actual improvements
2. Compare with expected metrics
3. Proceed to **Fase 2: Batching** (Issue #2)

---

**Status:** 🔴 Not Started
**Assignee:** TBD
**Related:**
- [frontend-performance-gap-analysis.md](../frontend-performance-gap-analysis.md)
- [dynamic-rendering-requirements.md](../dynamic-rendering-requirements.md)
