# [Fase 1] Issue #2: Fix Org Slug Caching in UnifiedHttpClient

**Priority:** 🔴 Critical
**Effort:** 2 hours
**Impact:** -80% org slug recomputation
**Branch:** `perf/fase-1-org-slug-cache`

---

## 🎯 Problem

The `getOrgSlug()` method in `UnifiedHttpClient` always calls `fetchOrgSlug()`, completely ignoring the existing cache properties (`orgSlug` and `orgSlugPromise`).

This causes:
- JWT parsing on **every HTTP request**
- Unnecessary overhead of ~5-10ms per request
- Cache properties exist but are never used

**File:** `frontend/src/api/client/http-unified-client.ts:115-120`

**Current behavior:** Always recomputes org slug (15-20x per page)
**Target behavior:** Compute once, reuse cached value (1-2x per page)

---

## ✅ Solution

Implement actual caching logic using the existing `orgSlugPromise` property.

---

## 📝 Implementation Steps

### Step 1: Fix getOrgSlug method

**File:** `frontend/src/api/client/http-unified-client.ts`

**Before (Lines 115-120):**
```typescript
private async getOrgSlug(): Promise<string | null> {
  // Always fetch fresh org slug to prevent stale organization context
  // This is especially important when users switch between organizations
  // The performance impact is minimal since JWT parsing is fast
  return this.fetchOrgSlug(); // ❌ ALWAYS CALLS fetchOrgSlug
}
```

**After:**
```typescript
private async getOrgSlug(): Promise<string | null> {
  // Reuse cached promise if available (within same request context)
  if (this.orgSlugPromise) {
    return this.orgSlugPromise;
  }

  // Start new fetch and cache the promise
  this.orgSlugPromise = this.fetchOrgSlug();
  const result = await this.orgSlugPromise;

  // Cache the result as well for synchronous access
  this.orgSlug = result;

  return result;
}
```

### Step 2: Verify clearOrgSlugCache still works

**No changes needed** - this method already exists and works correctly:

```typescript
public clearOrgSlugCache(): void {
  this.orgSlug = null;
  this.orgSlugPromise = null;
}
```

Verify it's called when org changes (Line 149):
```typescript
if (orgSlugFromToken !== this.orgSlug) {
  console.log(`[UnifiedHttpClient] Organization context changed - clearing cache`);
  this.clearOrgSlugCache(); // ✅ Already implemented
}
```

---

## 🧪 Testing Checklist

- [ ] **Build:** Run `npm run build` - no errors
- [ ] **Single Page Test:** Navigate to /goal-input
  - Multiple HTTP calls → only 1 org slug fetch
- [ ] **Org Switching:** Switch organizations
  - Verify `clearOrgSlugCache()` is called
  - Next request fetches new org slug
- [ ] **Multi-User:** Test with 2 users (different orgs)
  - Each sees their own org slug (no cache bleed)
- [ ] **Server vs Client:** Test both server actions and client fetch
  - Both should benefit from caching

### Manual Test Steps
```bash
# 1. Start dev server
npm run dev

# 2. Open browser DevTools → Console
# 3. Navigate to /goal-input
# 4. Check console logs:
#    - Should see "fetching org slug" ONCE (not 10-20 times)

# 5. Switch organization (if multi-org setup)
# 6. Check console:
#    - Should see "Organization context changed - clearing cache"
#    - Should see "fetching org slug" once for new org
```

---

## 📊 Success Metrics

### Before
- Org slug fetches: **20x per page**
- HTTP client overhead: **~10ms per request**

### After
- Org slug fetches: **1-2x per page** (-90% ✅)
- HTTP client overhead: **~1-2ms per request** (-80% ✅)

### Validation
Add temporary logging:
```typescript
private async getOrgSlug(): Promise<string | null> {
  const start = Date.now();
  const cached = !!this.orgSlugPromise;

  // ... implementation

  const duration = Date.now() - start;
  console.log(`[Perf] Org slug: ${cached ? 'CACHED' : 'FRESH'} (${duration}ms)`);

  return result;
}
```

---

## ⚠️ Potential Issues

### Issue: Stale org slug after org switching
**Symptom:** User switches org but sees old org data
**Solution:** Already handled by `clearOrgSlugCache()` on line 149
**Validation:** Test org switching manually

### Issue: Cache persists between different users
**Symptom:** User A sees User B's org
**Solution:** Each browser creates new `UnifiedHttpClient` instance with fresh cache
**Validation:** Test with 2 browsers/incognito windows

### Issue: Promise never resolves
**Symptom:** App hangs on org slug fetch
**Solution:** `fetchOrgSlug()` already has proper error handling
**Validation:** Test with invalid/expired JWT token

---

## 📦 Files Changed

- `frontend/src/api/client/http-unified-client.ts` (modified)
  - Method: `getOrgSlug()` (lines 115-120)

---

## 💬 Commit Message

```
perf(http-client): fix org slug caching implementation

Implement actual caching logic in getOrgSlug() to reuse fetched
org slug instead of always calling fetchOrgSlug().

Performance Impact:
- Org slug fetches: 20x → 2x per page (-90%)
- HTTP client overhead: 10ms → 1-2ms per request (-80%)

Changes:
- Check if orgSlugPromise exists before fetching
- Cache promise and result for reuse
- Maintain clearOrgSlugCache() for org switching

Testing:
- Verified single org slug fetch per page
- Tested org switching (cache clears correctly)
- Tested multi-user scenarios (no cache bleed)

Fixes: Fase 1, Issue #2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ Definition of Done

- [ ] Code implemented as specified
- [ ] TypeScript compiles without errors
- [ ] Org slug fetched only once per page
- [ ] Org switching still works correctly
- [ ] Manual testing completed
- [ ] Performance improvement measured
- [ ] Committed with template message
- [ ] PR created and linked to this issue
- [ ] Code reviewed and approved

---

**Status:** 🔴 Not Started
**Assignee:** TBD
**Related:** [frontend-performance-gap-analysis.md](../../frontend-performance-gap-analysis.md#2--crítico-org-slug-recomputado-a-cada-request)
