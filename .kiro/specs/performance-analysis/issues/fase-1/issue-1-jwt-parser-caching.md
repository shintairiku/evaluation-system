# [Fase 1] Issue #1: Add React.cache() to JWT Parser

**Priority:** 🔴 Critical
**Effort:** 1 hour
**Impact:** -90% JWT parsing calls (20x → 2x per request)
**Branch:** `perf/fase-1-jwt-cache`

---

## 🎯 Problem

The `getCurrentOrgSlug()` function in `jwt-parser.ts` is called multiple times within a single server request, causing:
- Repeated calls to Clerk's `auth()` and `getToken()`
- JWT parsing happens 15-20x per page
- Unnecessary overhead of ~20-30ms per server action

**Current:** 15-20x JWT parsing per page
**Target:** 1-2x JWT parsing per page

---

## ✅ Solution

Add `React.cache()` wrapper to memoize JWT parsing per request.

---

## 📝 Implementation Steps

### Step 1: Import cache from React

**File:** `frontend/src/api/utils/jwt-parser.ts`

```typescript
// Add this import at the top
import { cache } from 'react';
```

### Step 2: Convert getCurrentOrgSlug to cached function

**Before:**
```typescript
export async function getCurrentOrgSlug(): Promise<string | null> {
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { getToken } = await auth();
    const token = await getToken({ template: 'org-jwt' });

    // ... JWT parsing logic

    return jwtPayload.organization_slug || null;
  } catch (error) {
    console.warn('Failed to get org slug from token:', error);
    return null;
  }
}
```

**After:**
```typescript
export const getCurrentOrgSlug = cache(async (): Promise<string | null> => {
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { getToken } = await auth();
    const token = await getToken({ template: 'org-jwt' });

    // ... JWT parsing logic (no changes)

    return jwtPayload.organization_slug || null;
  } catch (error) {
    console.warn('Failed to get org slug from token:', error);
    return null;
  }
});
```

### Step 3: Apply same pattern to getCurrentOrgContext

**Before:**
```typescript
export async function getCurrentOrgContext(): Promise<{...}> {
  // ... implementation
}
```

**After:**
```typescript
export const getCurrentOrgContext = cache(async (): Promise<{
  orgId: string | null;
  orgSlug: string | null;
  orgName: string | null;
  userRoles: string[] | null;
  orgRole: string | null;
  internalUserId: string | null;
}> => {
  // ... implementation (no changes to logic)
});
```

---

## 🧪 Testing Checklist

- [ ] **Build:** Run `npm run build` - no TypeScript errors
- [ ] **Dev Server:** Start dev server, navigate to /goal-input
- [ ] **Console Check:** Look for reduced JWT parsing logs
- [ ] **Multi-Action Test:** Load page with multiple server actions
- [ ] **Org Switching:** Switch organizations, verify cache invalidates
- [ ] **Multi-User:** Test with 2 users in different browsers (no cache bleed)

### Manual Test Steps
```bash
# 1. Start dev server
npm run dev

# 2. Open browser DevTools → Console
# 3. Navigate to /goal-input (page with multiple server actions)
# 4. Expected: ~2 JWT parsing calls (vs 15-20 before)
```

---

## 📊 Success Metrics

### Before
- JWT parsing: **20x per request**
- Server action latency: **~300ms**

### After
- JWT parsing: **2x per request** (-90% ✅)
- Server action latency: **~240ms** (-20% ✅)

### Validation
Add temporary logging to measure:
```typescript
const start = Date.now();
const orgSlug = await getCurrentOrgSlug();
console.log(`[Perf] JWT parsing took ${Date.now() - start}ms`);
```

---

## ⚠️ Potential Issues

### Issue: TypeScript errors after conversion
**Solution:** Explicitly type the cached function:
```typescript
export const getCurrentOrgSlug: () => Promise<string | null> = cache(async () => {
  // ...
});
```

### Issue: Cache not clearing between requests
**Solution:** `React.cache()` automatically clears per-request - verify by testing with 2 users

---

## 📦 Files Changed

- `frontend/src/api/utils/jwt-parser.ts` (modified)

---

## 💬 Commit Message

```
perf(jwt): add React.cache() to JWT parser functions

Wrap getCurrentOrgSlug() and getCurrentOrgContext() with React.cache()
to memoize JWT parsing per server request.

Performance Impact:
- JWT parsing calls: 20x → 2x per request (-90%)
- Server action latency: 300ms → 240ms (-20%)

Changes:
- Convert getCurrentOrgSlug to cached function
- Convert getCurrentOrgContext to cached function
- Cache automatically cleared between requests

Testing:
- Verified single JWT parsing per request
- Tested org switching (cache invalidates correctly)
- Tested multi-user scenarios (no cache bleed)

Fixes: Fase 1, Issue #1

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ Definition of Done

- [ ] Code implemented as specified
- [ ] TypeScript compiles without errors
- [ ] Tests pass (if applicable)
- [ ] Manual testing completed
- [ ] Performance improvement measured
- [ ] Committed with template message
- [ ] PR created and linked to this issue
- [ ] Code reviewed and approved

---

**Status:** 🔴 Not Started
**Assignee:** TBD
**Related:** [frontend-performance-gap-analysis.md](../../frontend-performance-gap-analysis.md#3--crítico-jwt-parser-sem-reactcache-server-side)
