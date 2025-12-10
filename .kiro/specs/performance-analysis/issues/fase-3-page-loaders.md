# Phase 3: Page-Level Loaders — Performance

**Priority:** 🟢 Medium-Low  
**Impact target:** ~-50-60% page load time by collapsing multiple server actions into one loader response.

---

## 🎯 What to Deliver
- One loader per high-traffic page that returns all data in a single call (concurrent queries under the hood, cached per request).
- Remove duplicated server actions/fetch chains in pages; keep consistent skeleton/empty/error states.
- Pages in scope: Goal Input, Goal List, Goal Review (priority); optionally Admin Goal List, Evaluation Input.

---

## 🛠️ Work Required
- **Backend:**  
  - Page schemas (e.g., `GoalInputPageData`) and `page_service` helpers that fetch all required data concurrently and respect org/auth checks.  
  - New routes under `backend/app/api/v1/pages.py` (e.g., `/org/{org_slug}/pages/goal-input`) registered in `main.py`.  
  - Validate org ownership and period IDs; return stable shapes for FE consumption.
- **Frontend:**  
  - Server actions calling the page loader endpoints; wrap with `React.cache` where appropriate for per-request memoization.  
  - Pages consume the loader result instead of multiple actions; remove redundant fetches; keep loading/skeleton/empty states consistent.  
  - Error handling: single error surface with actionable retry; no partial waterfalls.

---

## ✅ Definition of Done
- Priority pages (Goal Input/List/Review) use a single loader call; redundant server actions removed.  
- Static typing in place for loader responses; pages render with unified loading/error UX.  
- `npm run lint && npm run build` passes; manual checks show fewer requests (target 4–6 → 1 per page).

---

## 🧪 Tests to Run
- Backend: unit/integration for each loader route (auth/org validation, data completeness).  
- Frontend: page/server-action tests to ensure single call used and UI states (loading/empty/error) are correct.  
- Perf smoke: compare request count and load time before/after on the three priority pages.

---

## ⚠️ Risks & Mitigations
- Missing fields in loader response → enforce typed schemas and contract tests.  
- Stale per-request cache → limit caching to request scope with `React.cache`; avoid cross-user reuse.  
- Large payloads → prune unused fields; consider pagination where necessary.

---

## 📦 Key Files
- Backend: `backend/app/schemas/page.py` (or similar), `backend/app/services/page_service.py`, `backend/app/api/v1/pages.py`, router registration in `app/main.py`.  
- Frontend: loader server actions, affected pages under `frontend/src/app/**/page.tsx`, shared loading/empty/error components.
