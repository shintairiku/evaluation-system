# Dynamic Rendering Requirements
## Selective `dynamic = 'force-dynamic'` Guidance

**Created:** 2025-12-02  
**Purpose:** Remove the global `dynamic = 'force-dynamic'` from `app/layout.tsx` and apply it only to pages that need live auth/org data. Everything else should rely on automatic/static rendering to restore SSG/ISR.

---

## 🎯 Overview
- Current: `frontend/src/app/layout.tsx` forces all pages to be dynamic.  
- Target: page-level `dynamic = 'force-dynamic'` only where user/org-specific data is required; public/auth shell pages become static/automatic.

---

## 🔴 Pages that MUST stay dynamic
Add `export const dynamic = 'force-dynamic';` to these routes because they depend on authenticated/org-aware data or real-time updates:
- `/` root page
- `/org`
- `/setup`, `/setup/confirmation`
- `/goal-input`
- `/goal-list`
- `/goal-edit/[goalId]`
- `/evaluation-input`
- `/goal-review`
- `/evaluation-feedback`
- `/admin-goal-list`, `/admin-goal-list/[userId]`
- `/user-profiles`
- `/org-management`
- `/stage-management`
- `/competency-management`
- `/evaluation-period-management`
- `/report`

---

## 🟢 Pages that CAN be static
No page-level `dynamic` needed; let Next.js pre-render:
- `/access-denied`
- `/sign-in`
- `/sign-up`

---

## 🟡 Special Case: Root Layout
- File: `frontend/src/app/layout.tsx`  
- Required: **remove** `export const dynamic = 'force-dynamic';` so the layout uses automatic rendering; pages decide their own strategy.

---

## 📋 Implementation Checklist
1) Remove global `dynamic` from `app/layout.tsx`.  
2) Add page-level `dynamic = 'force-dynamic'` to the 18 dynamic routes listed above.  
3) Leave the three public/auth shell pages without `dynamic`.  
4) Run `cd frontend && npm run build` to confirm static generation works and auth pages still render.  
5) Inspect `.next/server/app` to verify HTML for static pages and absence of unwanted `dynamic` markers.

---

## 📊 Expected Impact
- Public/auth shell pages ship as pre-rendered HTML → faster TTFB and fewer server hits.  
- Auth/org-heavy pages remain dynamic with no behavior change.  
- Removes unnecessary server load caused by the global dynamic setting.

---

## 📚 References
- `frontend/src/app/layout.tsx` — remove the global flag.  
- `frontend/src/app/**/page.tsx` — apply selective dynamic.  
- `.kiro/specs/.refactor-perf/02_frontend-data-fetch-and-ui.md` — source spec.
