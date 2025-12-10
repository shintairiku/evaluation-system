# Phase 1: Quick Wins — Performance

**Scope:** Tasks #390–#392  
**Goal:** Remove the biggest frontend perf blockers before batching and loader work.

---

## 🎯 Overview
- Main objective achieved: Task #390 added `React.cache` around the JWT parser to avoid re-running `auth()` + `getToken()` per server action.  
- Still pending: Task #391 (org slug caching in `UnifiedHttpClient`) and Task #392 (remove global `dynamic = 'force-dynamic'`).

---

## 📊 Results so far
- Server actions now parse the org JWT once per request when using the cached parser.  
- Expect lower latency in chained server actions; broader gains will come after caching the org slug and restoring SSG/ISR.

---

## ✅ Task Summary
- **#390 React.cache for JWT parser:** Implemented.  
- **#391 Fix org slug caching:** Not implemented; `getOrgSlug` still recomputes.  
- **#392 Remove global dynamic:** Not implemented; layout still forces dynamic rendering.

---

## 🧪 Testing Checklist (rerun after #391/#392)
- `cd frontend && npm run lint && npm run build` (confirm static pages render after removing global dynamic).  
- Perf smoke: measure TTFB on public pages and latency of server actions that read org context.  
- Auth sanity: sign-in/up, org switch, and goal flows still function with caching enabled.

---

## ⚠️ Risks
- #390: very low risk; caching is per request.  
- #391: risk of stale org after switching if cache not cleared; ensure `clearOrgSlugCache()` runs on org change.  
- #392: build could surface missing dynamic markers; fix page-level `dynamic` where needed.

---

## 📦 Files of interest
- `frontend/src/api/utils/jwt-parser.ts` — `React.cache` added (Task #390).  
- `frontend/src/api/client/http-unified-client.ts` — pending org slug cache fix.  
- `frontend/src/app/layout.tsx` — pending removal of global `dynamic`.

---

## 📈 Next Steps
1) Complete #391 by memoizing org slug per client/request and clearing on org switch.  
2) Complete #392 by removing `dynamic` from layout and adding it only to the required pages.  
3) Re-run build + perf checks; update metrics once #391/#392 land.
