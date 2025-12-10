# Phase 2: Auto-Save Batching — Performance

**Priority:** 🟡 Medium  
**Impact target:** ~-60-70% HTTP calls for auto-save, smoother UX.  
**Goal:** Send one batched payload per auto-save cycle instead of per-goal requests.

---

## 🎯 What to Deliver
- Backend batch save API and service that writes multiple goals in one transaction and reports per-item success/failure.
- Frontend auto-save that builds a single payload (performance + competency goals), debounces, and surfaces item-level errors.
- Keep org/auth safeguards: validate org_slug/period, respect org slug cache, and clear cache on org switch.

---

## 🛠️ Work Required
- **Backend:**  
  - Schemas: `GoalBatchItem`, `GoalBatchSaveRequest`, `GoalBatchSaveResponse` in `backend/app/schemas/goal.py`.  
  - Service: `batch_save_goals(db, period_id, goals, current_user)` in `goal_service.py` using a transaction; return `saved` and `failed` arrays.  
  - API: `POST /org/{org_slug}/goals/batch-save` in `backend/app/api/v1/goals.py`; validate org access and period ownership; register route.
- **Frontend:**  
  - Types + client call for batch endpoint.  
  - Server action wrapping the batch call with error mapping.  
  - `useGoalAutoSave`: gather changes, debounce, send one batch; map server IDs for new items, retry only failures, and keep per-item toast/state.  
  - Ensure org slug cache reuse (UnifiedHttpClient) and cache clear on org switch.

---

## ✅ Definition of Done
- Auto-save issues a single batch request per cycle; new IDs are reconciled; partial failures are reported item by item.  
- No regression to per-goal requests in the hook.  
- `npm run lint && npm run build` (frontend) and backend tests for the batch route pass.  
- Manual check: edit ~10 goals → 1 request observed; failures isolated and retriable.

---

## 🧪 Tests to Run
- Backend: unit/integration for `batch_save_goals` and `POST /goals/batch-save` (org/period validation, mixed success/failure).  
- Frontend: hook/server action unit tests; manual flow with multiple goal edits; confirm toasts/state handle partial errors.  
- Perf smoke: measure request count and latency before/after (target: 10→1 requests for 10 goals).

---

## ⚠️ Risks & Mitigations
- Stale org cache after switching → call `clearOrgSlugCache()` on org change.  
- Partial failures → response must include item-level errors; UI retries failed items only.  
- Schema drift between FE/BE → share types/shapes, keep response stable (`saved`/`failed`).  
- Transaction rollback behavior → ensure failures don’t block successful items; log failures.

---

## 📦 Key Files
- Backend: `backend/app/schemas/goal.py`, `backend/app/services/goal_service.py`, `backend/app/api/v1/goals.py`.  
- Frontend: batch API client + server action, `frontend/src/hooks/useGoalAutoSave.ts`, UnifiedHttpClient org slug cache.
