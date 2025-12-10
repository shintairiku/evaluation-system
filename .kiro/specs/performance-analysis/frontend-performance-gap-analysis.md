# Frontend Performance Gap Analysis
## Alignment: `develop` vs. `.refactor-perf/02_frontend-data-fetch-and-ui.md`

**Date:** 2025-12-02  
**Author:** Performance Analysis  
**Status:** ~20% implemented, ~30% partial, ~50% missing. Global dynamic rendering and unused caches keep TTFB high and multiply requests.

---

## 🎯 Quick View
- Expected gains: -30-40% TTFB on static pages; -60-70% HTTP calls with batching; -50-60% latency on main flows after all phases.
- Top gaps: global `dynamic = 'force-dynamic'`; org slug cache unused; JWT parser without `React.cache`; auto-save is per-item; loaders inconsistent.
- Priority: ship Phase 1 to restore SSG/ISR and per-request caching.

---

## 📌 Main Gaps and Actions
1) **Global `dynamic = 'force-dynamic'` (app/layout.tsx)**  
   - Disables SSG/ISR for the whole app.  
   - **Action:** remove from layout; add only to pages that truly need live auth/org data (dashboards, goal/evaluation flows, admin).  
   - **Impact:** lower TTFB for public/static pages.

2) **Org slug recomputed on every call (http-unified-client.ts)**  
   - `orgSlug` / `orgSlugPromise` exist but code always calls `fetchOrgSlug()`.  
   - **Action:** reuse `orgSlugPromise` per request, set `orgSlug` after it resolves, and invoke `clearOrgSlugCache()` on org switch.  
   - **Impact:** removes repeated JWT parsing (~15-20x per page today).

3) **JWT parser without `React.cache` (jwt-parser.ts)**  
   - `getCurrentOrgSlug()` does `auth()` + `getToken()` + parsing on every server action.  
   - **Action:** export cached versions with `cache(...)` so each request parses once.  
   - **Impact:** less IO and parsing in chained server actions.

4) **Auto-save writes one item per request (useGoalAutoSave.ts)**  
   - 10+ requests per edit session.  
   - **Action:** add batch endpoint/server action (backend + frontend) and send a debounced payload; return per-item success/error.  
   - **Impact:** -60-70% HTTP calls and auth/parsing overhead.

5) **Loaders/server actions duplicated**  
   - Dashboard is consolidated; other pages still fetch ad hoc.  
   - **Action:** move employee/supervisor/admin pages to loaders/server actions with per-request cache and consistent fallback states.

---

## 🚦 Phased Plan
- **Phase 1 — Quick Wins:** remove global `dynamic`; apply selectively; fix org slug caching on the client; wrap JWT parser with `React.cache`; ensure `clearOrgSlugCache()` runs on org switch.  
- **Phase 2 — Batching:** add batch save route (backend), server action (frontend), and adjust auto-save hook to send one payload with partial-failure handling.  
- **Phase 3 — Page Loaders:** standardize loaders/server actions with per-request caching, remove duplicate fetches, and unify skeleton/empty states across goal/evaluation/admin pages.

---

## 📊 Metrics and Validation
- Build/quality: `cd frontend && npm run lint && npm run build` (confirm public pages are pre-rendered).  
- Key metrics: TTFB on public pages, request count per goal interaction, latency of chained server actions, cache errors after org switch.  
- Monitoring: Lighthouse for TTFB/requests; cache hit/miss logs in server actions; traces comparing batched vs. individual auto-save.

---

## ⚠️ Risks and Mitigations
- Stale org cache: always call `clearOrgSlugCache()` on org change.  
- Partial batch failures: response should include item-level results; UI retries failed items.  
- Build failures after removing `dynamic`: run local build; add minimal e2e for auth flows that stay dynamic.

---

## 📚 Key References
- `frontend/src/app/layout.tsx` — remove global `dynamic`.  
- `frontend/src/api/client/http-unified-client.ts` — org slug caching.  
- `frontend/src/api/utils/jwt-parser.ts` — add `React.cache`.  
- `frontend/src/hooks/useGoalAutoSave.ts` and goal routes/actions — batching.  
- `.kiro/specs/.refactor-perf/02_frontend-data-fetch-and-ui.md` — source spec.
