# [Fase 1] Issue #3: Remove Global Dynamic Rendering

**Priority:** 🔴 Critical
**Effort:** 5 hours
**Impact:** -50-80% TTFB for all pages
**Branch:** `perf/fase-1-selective-dynamic`

---

## 🎯 Problem

The global `export const dynamic = 'force-dynamic';` in `app/layout.tsx` forces **ALL pages** to render dynamically, disabling:
- Static Site Generation (SSG)
- Incremental Static Regeneration (ISR)
- CDN caching
- All Next.js static optimizations

**Current:** All pages TTFB ~500ms
**Target:**
- Static pages: ~100ms (-80%)
- Dynamic pages: ~250ms (-50%)

---

## ✅ Solution

1. Remove global `dynamic = 'force-dynamic'` from layout
2. Add `export const dynamic = 'force-dynamic';` selectively to 18 pages that need it
3. Keep 3 pages static (no dynamic export)

**Reference:** See [dynamic-rendering-requirements.md](../../dynamic-rendering-requirements.md) for detailed specs

---

## 📝 Implementation Steps

### Step 1: Remove Global Dynamic

**File:** `frontend/src/app/layout.tsx`

**Remove Line 17:**
```typescript
// ❌ DELETE THIS LINE
export const dynamic = 'force-dynamic';
```

### Step 2: Add Dynamic to 18 Pages

Add this line **at the top of each file** (after imports):
```typescript
export const dynamic = 'force-dynamic';
```

#### Employee & Supervisor Pages (10 files)

1. `frontend/src/app/page.tsx`
2. `frontend/src/app/(evaluation)/goal-input/page.tsx`
3. `frontend/src/app/(evaluation)/(employee)/goal-list/page.tsx`
4. `frontend/src/app/(evaluation)/(employee)/goal-edit/[goalId]/page.tsx`
5. `frontend/src/app/(evaluation)/(employee)/evaluation-input/page.tsx`
6. `frontend/src/app/(evaluation)/(supervisor)/goal-review/page.tsx`
7. `frontend/src/app/(evaluation)/(supervisor)/evaluation-feedback/page.tsx`
8. `frontend/src/app/org/page.tsx`
9. `frontend/src/app/(auth)/setup/page.tsx`
10. `frontend/src/app/(auth)/setup/confirmation/page.tsx`

#### Admin Pages (8 files)

11. `frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx`
12. `frontend/src/app/(evaluation)/(admin)/admin-goal-list/[userId]/page.tsx`
13. `frontend/src/app/(evaluation)/user-profiles/page.tsx`
14. `frontend/src/app/(evaluation)/(admin)/org-management/page.tsx`
15. `frontend/src/app/(evaluation)/(admin)/stage-management/page.tsx`
16. `frontend/src/app/(evaluation)/(admin)/competency-management/page.tsx`
17. `frontend/src/app/(evaluation)/(admin)/evaluation-period-management/page.tsx`
18. `frontend/src/app/(evaluation)/(admin)/report/page.tsx`

### Step 3: Verify Static Pages (NO dynamic export)

Ensure these 3 pages **DO NOT** have `export const dynamic`:

1. `frontend/src/app/access-denied/page.tsx` ✅ No dynamic
2. `frontend/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` ✅ No dynamic
3. `frontend/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` ✅ No dynamic

---

## 🧪 Testing Checklist

### Build Test
- [ ] Run `npm run build`
- [ ] No TypeScript errors
- [ ] Build completes successfully
- [ ] Check `.next/server/app/` for static pages

### Static Pages Test
```bash
# After build, check for .html files (indicates static rendering)
ls -la .next/server/app/access-denied/
ls -la .next/server/app/\(auth\)/sign-in/

# Should see .html files for static pages
```

### Runtime Test
- [ ] Navigate to `/access-denied`
  - Check TTFB in DevTools Network tab (should be < 150ms)
- [ ] Navigate to `/sign-in`
  - Check TTFB (should be < 150ms)
- [ ] Navigate to `/` (dashboard)
  - Check TTFB (should be < 350ms, but > 150ms - still dynamic)

### Auth Flow Test
- [ ] Sign out
- [ ] Navigate to `/sign-in` (fast load ✅)
- [ ] Sign in with Google
- [ ] Redirect to `/` or `/setup`
- [ ] Verify user-specific data loads correctly

### Org Switching Test
- [ ] Sign in
- [ ] Navigate to `/org` (dynamic page)
- [ ] Switch organization
- [ ] Verify org context updates correctly

---

## 📊 Success Metrics

### Before
- **All pages:** TTFB ~500ms

### After
- **Static pages** (3 pages): TTFB ~50-100ms (-80-90% ✅)
- **Dynamic pages** (18 pages): TTFB ~200-300ms (-40-60% ✅)

### Validation
Check Network tab in DevTools:
1. Navigate to `/access-denied`
2. Check "Timing" tab
3. TTFB should be < 150ms

Compare before/after screenshots.

---

## ⚠️ Potential Issues

### Issue: Build fails with Clerk auth errors
**Symptom:** Build error: "Clerk keys not found"
**Solution:** This was the original reason for global dynamic - but we're now adding dynamic selectively
**Validation:** Run `npm run build` and verify success

### Issue: Static pages show stale data
**Symptom:** `/access-denied` shows old content
**Solution:** These pages have no dynamic data - content is always the same
**Validation:** Check page source, verify static HTML

### Issue: User-specific pages are static
**Symptom:** User A sees User B's data
**Solution:** All 18 user-specific pages have `dynamic = 'force-dynamic'`
**Validation:** Test with 2 users

### Issue: Auth flow breaks
**Symptom:** Sign in redirect fails
**Solution:** Clerk components work with both static and dynamic pages
**Validation:** Complete full auth flow (sign out → sign in → redirect)

---

## 📦 Files Changed

### Modified
- `frontend/src/app/layout.tsx` (remove line 17)

### Added dynamic export (18 files)
- All employee/supervisor/admin/auth pages listed in Step 2

### No changes (3 files)
- Static pages: access-denied, sign-in, sign-up

---

## 💬 Commit Message

```
perf(rendering): remove global dynamic, add selective dynamic

Remove global `dynamic = 'force-dynamic'` from root layout and add
selectively to 18 pages that require user-specific data.

Performance Impact:
- Static pages: 500ms → 100ms TTFB (-80%)
- Dynamic pages: 500ms → 250ms TTFB (-50%)
- CDN caching enabled for static pages

Changes:
- Removed global dynamic from app/layout.tsx
- Added dynamic to 18 user-specific pages
- Kept 3 pages static (access-denied, sign-in, sign-up)

Pages with dynamic (18):
- Employee: 5 pages (/, goal-input, goal-list, goal-edit, evaluation-input)
- Supervisor: 2 pages (goal-review, evaluation-feedback)
- Admin: 8 pages (admin-goal-list, user-profiles, etc.)
- Auth: 3 pages (org, setup, setup/confirmation)

Static pages (3):
- /access-denied
- /sign-in
- /sign-up

Testing:
- Build completes successfully
- Static pages have TTFB < 150ms
- Dynamic pages still work correctly
- Auth flow works (tested sign in/out)
- Org switching works

Fixes: Fase 1, Issue #3

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ Definition of Done

- [ ] Global dynamic removed from layout.tsx
- [ ] Dynamic added to all 18 required pages
- [ ] 3 static pages verified (no dynamic export)
- [ ] Build completes without errors
- [ ] Static pages TTFB < 150ms
- [ ] Dynamic pages still work correctly
- [ ] Auth flow tested and working
- [ ] Org switching tested and working
- [ ] Manual testing completed
- [ ] Performance measured and documented
- [ ] Committed with template message
- [ ] PR created and linked to this issue
- [ ] Code reviewed and approved

---

**Status:** 🔴 Not Started
**Assignee:** TBD
**Related:**
- [frontend-performance-gap-analysis.md](../../frontend-performance-gap-analysis.md#1--crítico-global-dynamic--force-dynamic)
- [dynamic-rendering-requirements.md](../../dynamic-rendering-requirements.md)
