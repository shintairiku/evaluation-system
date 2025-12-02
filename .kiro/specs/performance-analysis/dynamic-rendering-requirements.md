# Dynamic Rendering Requirements
## Page-Level `dynamic = 'force-dynamic'` Classification

**Created:** 2025-12-02
**Status:** Implementation Guide
**Related:** `frontend-performance-gap-analysis.md`

---

## 🎯 Overview

This document specifies which pages require `dynamic = 'force-dynamic'` and which can use static or automatic rendering. The goal is to remove the global dynamic rendering configuration from `app/layout.tsx` and apply it selectively only where necessary.

**Current State:** Global `dynamic = 'force-dynamic'` in `app/layout.tsx:17` forces ALL pages to render dynamically.

**Target State:** Selective dynamic rendering only for pages that require it.

---

## 📊 Page Classification Summary

| Category | Count | Rendering Strategy | Reason |
|----------|-------|-------------------|---------|
| 🔴 **Must be Dynamic** | 15 | `dynamic = 'force-dynamic'` | User-specific data, auth, real-time |
| 🟢 **Can be Static** | 4 | Static/Automatic | No auth, no user data |
| 🟡 **Special Cases** | 2 | Conditional/Mixed | Auth routing, org selection |

---

## 🔴 Pages That MUST Use `dynamic = 'force-dynamic'`

### Category: Authentication & User Context

#### 1. **Root Page** `/`
**File:** `frontend/src/app/page.tsx`
**Reason:**
- Uses `await auth()` to check user authentication
- Calls `checkUserExistsAction()` server action
- Shows different content based on user status (signed in vs signed out)
- Redirects based on user state

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';

async function SignedInContent() {
  const { userId } = await auth();
  const userResult = await checkUserExistsAction(userId);
  // ... user-specific logic
}
```

---

#### 2. **Organization Selection** `/org`
**File:** `frontend/src/app/org/page.tsx`
**Reason:**
- Uses `useAuth()` hook for current org context
- User-specific organization list
- Dynamic routing based on org selection

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 3. **Profile Setup** `/setup`
**File:** `frontend/src/app/(auth)/setup/page.tsx`
**Reason:**
- User onboarding flow
- Requires auth context
- Fetches user-specific data

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 4. **Setup Confirmation** `/setup/confirmation`
**File:** `frontend/src/app/(auth)/setup/confirmation/page.tsx`
**Reason:**
- Confirms user profile creation
- User-specific confirmation data

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

### Category: Employee Pages (User-Specific Data)

#### 5. **Goal Input** `/goal-input`
**File:** `frontend/src/app/(evaluation)/goal-input/page.tsx`
**Reason:**
- User-specific goals
- Period-specific data
- Real-time auto-save
- Requires auth and org context

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 6. **Goal List** `/goal-list`
**File:** `frontend/src/app/(evaluation)/(employee)/goal-list/page.tsx`
**Reason:**
- User-specific goal list
- Dynamic filtering and pagination
- Status updates

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 7. **Goal Edit** `/goal-edit/[goalId]`
**File:** `frontend/src/app/(evaluation)/(employee)/goal-edit/[goalId]/page.tsx`
**Reason:**
- Dynamic route parameter
- User-specific goal data
- Real-time editing

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 8. **Evaluation Input** `/evaluation-input`
**File:** `frontend/src/app/(evaluation)/(employee)/evaluation-input/page.tsx`
**Reason:**
- User self-assessment data
- Period-specific evaluation
- Real-time saving

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

### Category: Supervisor Pages

#### 9. **Goal Review** `/goal-review`
**File:** `frontend/src/app/(evaluation)/(supervisor)/goal-review/page.tsx`
**Reason:**
- Supervisor-specific subordinate goals
- Real-time approval/rejection
- User-specific permissions

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 10. **Evaluation Feedback** `/evaluation-feedback`
**File:** `frontend/src/app/(evaluation)/(supervisor)/evaluation-feedback/page.tsx`
**Reason:**
- Supervisor reviews
- Subordinate-specific data
- Real-time feedback

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

### Category: Admin Pages

#### 11. **Admin Goal List** `/admin-goal-list`
**File:** `frontend/src/app/(evaluation)/(admin)/admin-goal-list/page.tsx`
**Reason:**
- Organization-wide goal overview
- Admin-specific permissions
- Dynamic filtering

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 12. **Admin Goal List (User-Specific)** `/admin-goal-list/[userId]`
**File:** `frontend/src/app/(evaluation)/(admin)/admin-goal-list/[userId]/page.tsx`
**Reason:**
- Dynamic route parameter
- User-specific goal audit
- Admin permissions check

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 13. **User Profiles Management** `/user-profiles`
**File:** `frontend/src/app/(evaluation)/user-profiles/page.tsx`
**Reason:**
- Organization user list
- Admin/HR permissions
- User management operations

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 14. **Organization Management** `/org-management`
**File:** `frontend/src/app/(evaluation)/(admin)/org-management/page.tsx`
**Reason:**
- Organization structure
- Admin-only access
- Real-time hierarchy updates

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 15. **Stage Management** `/stage-management`
**File:** `frontend/src/app/(evaluation)/(admin)/stage-management/page.tsx`
**Reason:**
- Organization stages configuration
- Admin-only access
- Real-time CRUD operations

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 16. **Competency Management** `/competency-management`
**File:** `frontend/src/app/(evaluation)/(admin)/competency-management/page.tsx`
**Reason:**
- Organization competencies
- Admin-only access
- Real-time CRUD operations

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 17. **Evaluation Period Management** `/evaluation-period-management`
**File:** `frontend/src/app/(evaluation)/(admin)/evaluation-period-management/page.tsx`
**Reason:**
- Organization evaluation periods
- Admin-only access
- Real-time CRUD operations

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

#### 18. **Report** `/report`
**File:** `frontend/src/app/(evaluation)/(admin)/report/page.tsx`
**Reason:**
- Organization-wide reports
- Admin permissions
- Dynamic data aggregation

```typescript
// ✅ REQUIRED: Must be dynamic
export const dynamic = 'force-dynamic';
```

---

## 🟢 Pages That CAN Be Static (No `dynamic` Needed)

### Category: Public/Static Pages

#### 1. **Access Denied** `/access-denied`
**File:** `frontend/src/app/access-denied/page.tsx`
**Reason:**
- Static error page
- No auth required
- No user-specific data
- Same content for everyone

```typescript
// ❌ NOT NEEDED: Can be static
// export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'アクセス拒否 | 人事評価システム',
  description: 'このページにアクセスする権限がありません'
};

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
      {/* Static content */}
    </div>
  );
}
```

**Performance Benefit:**
- Can be pre-rendered at build time
- Instant loading (TTFB < 100ms)
- Cached by CDN

---

#### 2. **Sign In** `/sign-in`
**File:** `frontend/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
**Reason:**
- Clerk handles auth client-side
- Page itself is static
- No server-side auth check needed

```typescript
// ❌ NOT NEEDED: Can be static
// export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
```

**Performance Benefit:**
- Pre-rendered login page
- Fast initial load
- Clerk handles dynamic auth flow client-side

---

#### 3. **Sign Up** `/sign-up`
**File:** `frontend/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
**Reason:**
- Similar to sign-in
- Clerk handles registration client-side
- Page content is static

```typescript
// ❌ NOT NEEDED: Can be static
// export const dynamic = 'force-dynamic';
```

**Performance Benefit:**
- Pre-rendered registration page
- Fast initial load

---

## 🟡 Special Cases (Requires Careful Analysis)

### 1. **Root Layout** `/` (Layout, not Page)
**File:** `frontend/src/app/layout.tsx`
**Current State:** Has global `export const dynamic = 'force-dynamic';`
**Required Action:** ❌ **REMOVE THIS**

```typescript
// ❌ REMOVE THIS GLOBAL SETTING
// export const dynamic = 'force-dynamic';

// Layout should use automatic rendering
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={jaJP}>
      <html lang="ja" suppressHydrationWarning>
        <body className="font-sans antialiased">
          <LoadingProvider>
            <GoalReviewProvider>
              {children}
              <Toaster richColors position="top-right" />
            </GoalReviewProvider>
          </LoadingProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Reason:**
- Layouts should not force dynamic rendering
- Each page should decide its own rendering strategy
- Clerk providers work fine with static rendering
- Children pages handle their own auth requirements

---

## 📋 Implementation Checklist

### Phase 1: Preparation
- [ ] Review all pages listed in this document
- [ ] Confirm auth requirements for each page
- [ ] Test build with dynamic configs

### Phase 2: Remove Global Dynamic
- [ ] Remove `export const dynamic = 'force-dynamic';` from `app/layout.tsx:17`
- [ ] Run `npm run build` to verify no errors
- [ ] Check that Clerk auth still works

### Phase 3: Add Selective Dynamic (Pages Requiring It)
- [ ] Add to `/` (root page)
- [ ] Add to `/org` (org selection)
- [ ] Add to `/setup` (profile setup)
- [ ] Add to `/setup/confirmation`
- [ ] Add to `/goal-input`
- [ ] Add to `/goal-list`
- [ ] Add to `/goal-edit/[goalId]`
- [ ] Add to `/evaluation-input`
- [ ] Add to `/goal-review`
- [ ] Add to `/evaluation-feedback`
- [ ] Add to `/admin-goal-list`
- [ ] Add to `/admin-goal-list/[userId]`
- [ ] Add to `/user-profiles`
- [ ] Add to `/org-management`
- [ ] Add to `/stage-management`
- [ ] Add to `/competency-management`
- [ ] Add to `/evaluation-period-management`
- [ ] Add to `/report`

### Phase 4: Verify Static Pages (Should NOT Have Dynamic)
- [ ] Verify `/access-denied` has NO dynamic export
- [ ] Verify `/sign-in` has NO dynamic export
- [ ] Verify `/sign-up` has NO dynamic export

### Phase 5: Testing
- [ ] Test all dynamic pages load correctly
- [ ] Test all static pages load correctly
- [ ] Test authentication flows
- [ ] Test org switching
- [ ] Run `npm run build` and verify success
- [ ] Check `.next/server/app/` for static pages
- [ ] Measure TTFB for static vs dynamic pages

### Phase 6: Performance Validation
- [ ] Measure TTFB for `/access-denied` (should be < 100ms)
- [ ] Measure TTFB for `/sign-in` (should be < 100ms)
- [ ] Measure TTFB for dynamic pages (should be < 300ms)
- [ ] Verify no regressions in functionality

---

## 🧪 Testing Guide

### Testing Static Pages
```bash
# Build the application
npm run build

# Check static pages generated
ls -la .next/server/app/access-denied/
ls -la .next/server/app/(auth)/sign-in/

# Should see .html files (pre-rendered)
```

### Testing Dynamic Pages
```bash
# Build the application
npm run build

# Check dynamic pages
ls -la .next/server/app/page.tsx
ls -la .next/server/app/(evaluation)/goal-input/

# Should NOT see .html files (rendered on-demand)
```

### Runtime Testing
1. **Static Pages:**
   - Open `/access-denied` in browser
   - Check Network tab: TTFB should be < 100ms
   - View page source: Should see full HTML

2. **Dynamic Pages:**
   - Open `/goal-input` in browser
   - Check Network tab: TTFB should be < 300ms
   - Verify user-specific data loads correctly

3. **Auth Flow:**
   - Sign out
   - Navigate to `/sign-in` (should be fast - static)
   - Sign in
   - Navigate to `/` (should show user-specific dashboard)
   - Verify no errors

---

## 📊 Expected Performance Impact

### Before (Global Dynamic)
```
All Pages:
  TTFB: ~500ms
  Cache: Disabled
  Build: Fast (no static generation)
```

### After (Selective Dynamic)

#### Static Pages (3 pages)
```
/access-denied:
  TTFB: ~50-100ms (-80% to -90%)
  Cache: CDN cached
  Build: Pre-rendered

/sign-in:
  TTFB: ~50-100ms (-80% to -90%)
  Cache: CDN cached
  Build: Pre-rendered

/sign-up:
  TTFB: ~50-100ms (-80% to -90%)
  Cache: CDN cached
  Build: Pre-rendered
```

#### Dynamic Pages (18 pages)
```
All evaluation pages:
  TTFB: ~200-300ms (-40% to -60%)
  Cache: Server-side rendering cache
  Build: On-demand rendering

Reasoning:
- Remove global dynamic overhead
- Only render dynamically when needed
- Benefit from Next.js automatic optimizations
```

---

## ⚠️ Important Notes

### 1. Why NOT Remove Dynamic from All Pages?
Some pages MUST be dynamic because:
- They use `await auth()` in server components
- They fetch user-specific data
- They require real-time data
- They have dynamic route parameters with user data

### 2. Why CAN Some Pages Be Static?
Some pages CAN be static because:
- No user-specific content
- No auth checks needed
- Same content for all users
- Client-side components handle dynamic behavior (like Clerk auth UI)

### 3. Hybrid Approach
Next.js 15 allows:
- Static pages: Pre-rendered at build time
- Dynamic pages: Rendered on-demand
- Automatic: Next.js decides (when no explicit config)

Our approach:
- **Explicit static**: Pages we know can be static
- **Explicit dynamic**: Pages we know must be dynamic
- **Automatic**: Let Next.js decide for edge cases

---

## 🔗 References

- [Next.js 15 - Dynamic Rendering](https://nextjs.org/docs/app/building-your-application/rendering/server-components#dynamic-rendering)
- [Next.js 15 - Static Rendering](https://nextjs.org/docs/app/building-your-application/rendering/server-components#static-rendering)
- [Clerk with Next.js SSR](https://clerk.com/docs/references/nextjs/overview)
- Related: `frontend-performance-gap-analysis.md`

---

## ✅ Summary

**Pages Requiring `dynamic = 'force-dynamic'`:** 18 pages
- All employee evaluation pages (5 pages)
- All supervisor pages (2 pages)
- All admin pages (8 pages)
- Auth/user context pages (3 pages)

**Pages That Can Be Static:** 3 pages
- `/access-denied`
- `/sign-in`
- `/sign-up`

**Action Required:**
1. Remove global `dynamic = 'force-dynamic'` from `app/layout.tsx`
2. Add `export const dynamic = 'force-dynamic';` to 18 pages listed above
3. Ensure 3 static pages have NO dynamic export
4. Test and validate

**Expected Benefit:**
- Static pages: -80% to -90% TTFB improvement
- Dynamic pages: -40% to -60% TTFB improvement (from removing global overhead)
- Better build performance
- CDN caching for static pages

---

**Document Status:** ✅ Ready for Implementation
**Last Updated:** 2025-12-02
