# Goals Performance Refactor + Frontend Folder Restructure (Architecture Change Plan)

Status: **Implemented (partial)** — execution is the source of truth; any remaining “plan” notes below are kept only as historical context.  
Scope: goals-related pages and shared goal UI/data (employee goal-list + supervisor goal-review), plus API layer folder structure alignment.

## Implementation smmary (as implemented)

- Fixed a backend multi-tenant scoping bug where an explicit empty accessible user list (`[]`) could accidentally skip user filtering and return org-wide goals.
  - `backend/app/database/repositories/goal_repo.py`: fail-closed on `user_ids=[]` and always apply the filter when `user_ids is not None`.
  - `backend/app/services/goal_service.py`: short-circuit empty accessible users; treat `GOAL_MANAGE_SELF` as self-access; include subordinate access for approvers.
- Employee `/goal-list` now loads via a server loader pipeline:
  - `GoalListDataLoader` → `getEmployeeGoalListPageDataAction` → `getGoalsAction`
- Supervisor `/goal-review` now loads via a server loader pipeline (removes per-subordinate N calls):
  - `GoalReviewDataLoader` → `getSupervisorGoalReviewPageDataAction` → `getPendingSupervisorReviewsAction` + batch fetch (`users/by-ids` + `goals/by-ids`)
- Frontend “employee self” flows now pass `userId` defensively when fetching goals (goal list loader, goal-input blocking checks, submit step, rejected draft count):
  - `frontend/src/api/server-actions/goals/page-loaders.ts`
  - `frontend/src/hooks/usePeriodSelection.ts`
  - `frontend/src/feature/goal-input/display/ConfirmationStep.tsx`
  - `frontend/src/context/GoalListContext.tsx`
- `GoalListProvider` no longer always triggers a client refresh on mount when a server-provided initial rejected count is available (layout preloads it).
- Added regression tests to enforce “empty list never widens scope”:
  - `backend/tests/repositories/test_goal_repo_scoping.py`
  - `backend/tests/services/test_goal_service_scoping.py`

### 2025-12-19 follow-up notes (perf + correctness)

- Batch endpoints added + wired (avoid org-wide scans on goal-review):
  - `POST /goals/by-ids` → `backend/app/api/v1/goals.py` + `backend/app/services/goal_service.py`
  - `POST /v2/users/by-ids` → `backend/app/api/v2/users.py` + `backend/app/services/user_service_v2.py`
  - Goal-review loader now uses these endpoints and builds `reviewsByGoalId` (review object, not just `reviewId`):
    - `frontend/src/api/server-actions/goals/page-loaders.ts`
    - `frontend/src/api/types/page-loaders.ts`
- Removed competency “ideal actions” N+1:
  - Backend enriches goals with `idealActionTexts` (resolved from competency descriptions).
  - Frontend renders directly from `goal.idealActionTexts` (no `useIdealActionsResolver` / no per-goal fetch).
    - `backend/app/services/goal_service.py`
    - `backend/app/schemas/goal.py`
    - `frontend/src/feature/evaluation/employee/goal-list/components/GoalCard.tsx`
    - `frontend/src/feature/evaluation/superviser/goal-review/components/GoalApprovalCard/index.tsx`
- Removed supervisor-review draft load N+1:
  - `useAutoSave` now hydrates initial comment/status from already-loaded pending review data (no `getSupervisorReviewById` per card).
    - `frontend/src/feature/evaluation/superviser/goal-review/hooks/useAutoSave.ts`
- Sidebar/request flood reduction:
  - Disabled Next.js `Link` prefetch in the sidebar to prevent many unrelated RSC fetches while navigating.
    - `frontend/src/components/display/sidebar.tsx`
- Badge counts made “count-only”:
  - Pending approvals: `limit: 1` + use `total` from `/supervisor-reviews/pending`.
    - `frontend/src/context/GoalReviewContext.tsx`
  - Rejected/resubmission drafts: `hasPreviousGoalId=true`, `limit: 1` + use `total`.
    - `frontend/src/context/GoalListContext.tsx`
- Fixed “pendingCount shows 1 but list empty” edge case:
  - `/goals/by-ids` and `/v2/users/by-ids` now allow access when the supervisor has a draft `supervisor_review` assigned for the requested goal/subordinate (even if subordinate relationship/status changed).
    - `backend/app/services/goal_service.py`
    - `backend/app/services/user_service_v2.py`
    - `backend/app/database/repositories/supervisor_review_repository.py`

## Historical plan notes (may be outdated)

Last updated: **2025-12-18**

Note: the sections below were written as a forward-looking plan and may not reflect current code; the “Implementation summary (as implemented)” section above is authoritative.

### Phase 1 — Stop the worst redundant calls (frontend-only)

Completed:
- `GoalResponse` includes `competencyNames?: Record<string, string> | null` and UI uses it (removes per-card competency fetch).
- Selected-period “double fetch” removed (period selection no longer triggers a second full reload).
- Rejected-goals badge no longer triggers repeated “refetch loops” from the goal-list page.
- Added shared helper for competency display name mapping to avoid drift: `resolveCompetencyNamesForDisplay(...)`.
- Supervisor goal-review period switching corrected: `getPendingSupervisorReviewsAction` now receives `periodId`.

Notes:
- Backend already returns `competencyNames` consistently via `GoalService.get_goals()` enrichment (batched competency name map + response schema alias).

### Phase 2 — Introduce Goals domain folder + page loaders

Completed:
- Added `frontend/src/api/server-actions/goals/**` (queries/mutations/page-loaders) and kept `frontend/src/api/server-actions/goals.ts` as a thin re-export for backward compatibility.
- Implemented employee goal-list page loader: `getEmployeeGoalListPageDataAction` (composes `getCurrentUserContextAction` + `getGoalsAction` once; returns serializable data).
- Split employee goal-list into Route/DataLoader/Client:
  - `GoalListRoute.tsx` (server shell with Suspense)
  - `GoalListDataLoader.tsx` (server component calling loader)
  - `GoalListClient.tsx` (client UI shell; URL-driven period selection via `?periodId=...`)


## 0) Objectives

1. **Fix slow/inefficient goal screens** by eliminating client-side server-action waterfalls and N+1 fetches.
2. Enforce the repo rule: **“One page = one loader”** (`frontend/README.md`, `.kiro/specs/.refactor-perf/02_frontend-data-fetch-and-ui.md`).
3. Align folder structure to the documented architecture:
   - Goals “BFF” lives in `frontend/src/api/server-actions/goals/**`
   - Route entrypoints stay thin in `frontend/src/app/**`
4. Keep output **serializable** from loaders (plain objects/arrays), and keep org/auth handling **safe for multi-tenant**.

## 1) Evidence: Why goal-list is slow today (mapped to code)

### 1.1 Backend calls observed (your docker logs)

The request stream includes repeated calls to:
- `GET /api/org/<org>/evaluation-periods/` (multiple times)
- `GET /api/v2/org/<org>/users/` and `GET /api/v2/org/<org>/users/page...`
- `GET /api/v1/auth/user/<clerkId>` (multiple times)
- `GET /api/org/<org>/goals?...` (multiple times, both with and without `userId=...`)
- `GET /api/org/<org>/competencies/<id>` (repeated for the same id)

### 1.2 “Which frontend code triggers which backend call”

| Backend call | Why it happens | Primary frontend source |
|---|---|---|
| `GET /api/v2/org/.../users/page?...include=department,stage,roles` | **Next `Link` prefetch** triggers server components for routes in the sidebar (notably `/user-profiles`) | `frontend/src/components/display/sidebar.tsx` + Next prefetch + `frontend/src/feature/user-profiles/display/UserProfilesDataLoader.tsx` (calls `getUserDirectoryBasePageDataAction`) |
| `GET /api/org/.../evaluation-periods/` | Same data is fetched in **multiple places** | `frontend/src/app/(evaluation)/layout.tsx` → `getCurrentUserContextAction()` and also `frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts` and also `frontend/src/context/GoalListContext.tsx` |
| `GET /api/v2/org/.../users/` | Goal list fetches the **entire org user list** just to map `goal.userId → user` | `frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts` → `getUsersAction()` |
| `GET /api/v1/auth/user/<clerkId>` | Used to map Clerk user → internal user id, repeatedly | `frontend/src/context/GoalListContext.tsx` → `checkUserExistsAction(clerkUserId)` |
| `GET /api/org/.../goals?...includeReviews=true&includeRejectionHistory=true` | Goal list main data fetch | `frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts` → `getGoalsAction(...)` |
| `GET /api/org/.../goals?...userId=<internalId>` | “Rejected goals count” badge refresh fetches goals again | `frontend/src/context/GoalListContext.tsx` → `getGoalsAction({ periodId, userId })` |
| `GET /api/org/.../competencies/<id>` (repeated) | **Per-card competency fetch** (and duplicated between hooks) | `frontend/src/feature/evaluation/employee/goal-list/components/GoalCard.tsx` → `useCompetencyNames()` + `useIdealActionsResolver()` |

### 1.3 Specific inefficiencies/root causes

#### A) Duplicate fetch caused by `selectedPeriodId` initialization
- Employee goal list:
  - `GoalListPage` sets `selectedPeriodId` after `currentPeriod` loads.
  - `useGoalListData` depends on `params.selectedPeriodId`, so the “set selected period” causes a **second full reload** (periods + users + goals).
  - Files:  
    - `frontend/src/feature/evaluation/employee/goal-list/display/index.tsx`  
    - `frontend/src/feature/evaluation/employee/goal-list/hooks/useGoalListData.ts`
- Supervisor goal review has the same pattern:
  - Files:
    - `frontend/src/feature/evaluation/superviser/goal-review/display/index.tsx`
    - `frontend/src/feature/evaluation/superviser/goal-review/hooks/useGoalReviewData.ts`

#### B) Context-driven “refresh” causes extra fetch loops
- `GoalListProvider` fetches rejected count on mount.
- `GoalListPage` also calls `refreshRejectedGoalsCount()` whenever `filteredGoals` changes.
  - This is a **side-effect** that triggers extra network calls even when the page already has the goal list data.
  - File: `frontend/src/context/GoalListContext.tsx`

#### C) Competency N+1 + duplicated fetch
- `GoalCard` calls:
  - `useCompetencyNames(competencyIds)` → fetches `getCompetencyAction(id)` per id
  - `useIdealActionsResolver(selectedIdealActions)` → fetches `getCompetencyAction(id)` again per competency key
- Result: for one competency goal, the same competency can be fetched **2x**, and across many cards it becomes N+1.
  - Files:
    - `frontend/src/hooks/evaluation/useCompetencyNames.ts`
    - `frontend/src/hooks/evaluation/useIdealActionsResolver.ts`
    - `frontend/src/api/server-actions/competencies.ts`

#### D) We are re-fetching data the backend already provides
The backend `Goal` response schema already includes `competencyNames` (UUID → name mapping).  
Source: `backend/app/schemas/goal.py` (`competency_names: ... alias="competencyNames"`) and enrichment in `backend/app/services/goal_service.py`.

Frontend currently ignores this field (TS type `GoalResponse` doesn’t include it) and re-fetches competencies to resolve names.

#### E) Supervisor goal review uses an N+1 pattern across subordinates
`useGoalReviewData`:
- loads pending supervisor reviews
- then fetches goals **once per subordinate** via `getGoalsAction({ periodId, userId: subordinateId, status: 'submitted' })`
  - File: `frontend/src/feature/evaluation/superviser/goal-review/hooks/useGoalReviewData.ts`

Backend already has the primitives needed to fix this:
- `SupervisorReviewRepository.get_pending_reviews(...)`
- `GoalRepository.get_goals_by_ids_batch(...)`

## 2) Target architecture (what we’re moving to)

### 2.1 Rule: “One page = one loader” (server action)

For each core goal screen:

1. **Server route component** in `frontend/src/feature/**/display/*Route.tsx` calls one loader server action.
2. Route passes loader output to a **client UI shell** component for interactivity only (filters, tabs, local UI state).
3. No “client waterfalls” of server-action calls for initial render.

### 2.2 Folder restructure (Goals domain BFF)

We will mirror the existing `users/**` pattern for goals.

Proposed **new** structure:

```text
frontend/src/api/server-actions/
  goals.ts                        # becomes a thin re-export (back-compat)
  goals/
    index.ts                      # barrel: export * from queries/mutations/page-loaders
    queries.ts                    # read actions (getGoalsAction, getGoalByIdAction, etc.)
    mutations.ts                  # create/update/submit/approve/reject actions
    page-loaders.ts               # page-level BFF loaders (goal-list, goal-review, goal-input as needed)
```

Follow-up (if we adopt backend “evaluation pages” endpoints):

```text
frontend/src/api/endpoints/
  evaluation-pages.ts             # wraps /api/v1/evaluation/* endpoints (goal-list-page, goal-review-page, etc.)
frontend/src/api/server-actions/evaluation-pages/
  queries.ts                      # server actions for those page endpoints
```

### 2.3 Feature restructure (server route + client shell)

Employee goal list:

```text
frontend/src/feature/evaluation/employee/goal-list/
  display/
    GoalListRoute.tsx             # server component (calls loader)
    GoalListClient.tsx            # client component (UI + state only)
  components/
  hooks/                          # hook becomes “adapter over props” or deleted
```

Supervisor goal review:

```text
frontend/src/feature/evaluation/superviser/goal-review/
  display/
    GoalReviewRoute.tsx           # server component (calls loader)
    GoalReviewClient.tsx          # client component (tabs, keyboard nav, UI state)
```

## 3) BFF contracts (what each loader returns)

### 3.1 Employee Goal List loader

Server action: `getEmployeeGoalListPageDataAction`  
Location: `frontend/src/api/server-actions/goals/page-loaders.ts`

Inputs:
- `periodId?: UUID` (from route `searchParams`), default to current period

Outputs (serializable):
- `currentUserContext` (already computed in `getCurrentUserContextAction`)
- `selectedPeriod`
- `goals` for period (use existing `GET /goals?includeReviews&includeRejectionHistory`)
- `rejectedGoalsCount` (derived from `goals`, not a separate fetch)
- `user` data needed for header card (use `currentUserContext.user`; avoid `getUsersAction()` for employee route)

Key changes enabled by this loader:
- Remove duplicate evaluation-period fetch in `useGoalListData` and `GoalListContext`
- Remove `/users/` fetch from employee goal-list (use `currentUserContext.user`)
- Remove “set selectedPeriod → refetch everything” pattern by doing period selection via URL (server render) or by guarding duplicate fetch in hook

### 3.2 Supervisor Goal Review loader

Server action: `getSupervisorGoalReviewPageDataAction`  
Location: `frontend/src/api/server-actions/goals/page-loaders.ts` (or `supervisor-reviews/page-loaders.ts` if you prefer ownership there)

Outputs:
- `currentUserContext`
- `selectedPeriod`
- `grouped`: `{ employee, goals, goalToReviewMap }[]`
- `totalPendingCount`

Backend requirement (recommended to avoid N+1):
- Add `GET /api/v1/evaluation/goal-review-page?periodId=...` that returns the grouped payload in one call:
  - `pendingReviews = supervisor_review_repo.get_pending_reviews(supervisor_id, org_id, period_id)`
  - `goals = goal_repo.get_goals_by_ids_batch([review.goal_id...])`
  - enrich goals (reuse `GoalService._enrich_goal_data` so `competencyNames` comes back)
  - join/load employee info in one query (or batch) to avoid `getUsersAction()`

If backend endpoint is not ready yet (interim):
- Loader can still call `getPendingSupervisorReviewsAction({ periodId })`
- Then fetch goals by **goal IDs** via a new backend batch endpoint (preferred) or a controlled-concurrency loop (last resort)

## 4) Immediate low-risk wins (before full loader migration)

These are “small deltas” we can land first after you approve:

1. **Use `competencyNames` from the goal payload** (stop refetching competency names)
   - Update TS type `GoalResponse` to include `competencyNames?: Record<string, string> | null`
   - Update `GoalCard` to display names from `goal.competencyNames` instead of `useCompetencyNames`
2. **Remove the double-fetch period initialization**
   - Avoid calling `loadGoalData()` twice when `selectedPeriodId` is set to `currentPeriod.id`
3. **Stop “refreshRejectedGoalsCount” from refetching periods/goals**
   - Derive rejected count from already-loaded goals (page loader) or add a tiny count endpoint
   - Avoid `checkUserExistsAction` by using `internal_user_id` from the JWT (already present in `jwt-parser.ts`)

## 5) Next.js prefetch note (why `/users/page` shows up on goal-list)

Sidebar links prefetch by default; `/user-profiles` renders a server component loader which calls `/users/page`.

Options:
- Set `prefetch={false}` only for the heaviest links in `frontend/src/components/display/sidebar.tsx`, or
- Ensure those prefetched routes rely on cached loaders (`unstable_cache`) so prefetch is cheap.

## 6) Execution plan (approval checkpoints)

This plan has two tracks:
- **Track A (frontend-only, immediate win):** Remove redundant calls + client waterfalls by moving goal-list data loading to a **server action page loader** (BFF in the frontend). This uses existing endpoints (`/goals`, `/evaluation-periods`, `/users`) but calls them **once**, **in parallel**, **on the server**, then hydrates the client UI with props.
- **Track A’ (conditional):** There is an existing backend page endpoint `GET /api/v1/evaluation/goal-list-page`, but **its response shape is a summary read model** and does **not** include many fields currently rendered by `GoalCard` (e.g. `specificGoalText`, `achievementCriteriaText`, embedded reviews, rejection history). We can only use it as-is if we (a) change the UI to a summary view or (b) extend the backend endpoint.
- **Track B (backend + frontend, best outcome):** Supervisor goal-review needs a **new aggregated backend endpoint** (or a batch endpoint) to eliminate the current N+1 patterns.

### Phase 1 — Stop the worst redundant calls (frontend-only)
Approval needed before code changes.
- Update `GoalResponse` type to include `competencyNames`
- Refactor `GoalCard` to remove `useCompetencyNames`
- Fix selectedPeriod double fetch in goal-list + goal-review
- Refactor rejected-goals badge logic to avoid repeated refetch loops

### Phase 2 — Introduce Goals domain folder + page loaders
Approval needed before code changes.
- Create `frontend/src/api/server-actions/goals/**` and move existing exports (keep `goals.ts` as a re-export)
- Add `getEmployeeGoalListPageDataAction` loader (Track A: compose existing endpoints; Track A’: switch to `/api/v1/evaluation/goal-list-page` only after backend/UI alignment)
- Create `GoalListRoute.tsx` (server) + `GoalListClient.tsx` (client)
- Deprecate or simplify `useGoalListData`

### Phase 3 — Supervisor goal review: remove N+1 (backend + frontend)
Approval needed before code changes.
- Backend: add `/api/v1/evaluation/goal-review-page`
- Frontend: add `getSupervisorGoalReviewPageDataAction` and `GoalReviewRoute.tsx`
- Remove per-subordinate goals fetching loop

### Phase 4 — Optional: prefetch tuning + caching hardening
- Targeted `prefetch={false}` for heavy links, or strengthen loader caching
- Request-scoped org context caching (per `.kiro/specs/.refactor-perf/03_auth-and-org-context.md`)

## 6.1) Concrete backend changes required (Track B)

If we want supervisor goal-review to be “one page = one loader” **without** per-subordinate goal fetches, we need backend support. Recommended minimal backend addition:

### Option B1 (recommended): `GET /api/v1/evaluation/goal-review-page`

Returns a page-shaped payload tailored to the supervisor goal review screen:
- period selection info
- grouped goals by subordinate (employee)
- `goalId → supervisorReviewId` mapping

Implementation sketch:
- API route: add to `backend/app/api/v1/evaluation_pages.py`
- Service aggregation: add `GoalService.get_goal_review_page(...)` (or a dedicated evaluation page service)
- Repository use:
  - `SupervisorReviewRepository.get_pending_reviews(supervisor_id, org_id, period_id=...)` (already exists)
  - `GoalRepository.get_goals_by_ids_batch(goal_ids, org_id)` (already exists)
  - Batch-load employee data for `subordinate_id` list (new repo method or a single query)
  - Reuse `GoalService._enrich_goal_data(...)` so goals include `competencyNames`

### Option B2 (fallback): “goals by ids” batch endpoint

If we don’t want a full “goal-review-page” endpoint yet, we can still remove the per-subordinate loop by adding a backend endpoint that accepts `goalIds[]` and returns the corresponding goals in one call.

## 6.2) Optional backend changes to make employee goal-list truly single-call

If we want employee goal-list to be **one backend call** while keeping the current `GoalCard` UI:

### Option A2 (recommended): Extend `GET /api/v1/evaluation/goal-list-page`

Add either:
- a query flag like `includeDetails=true` that returns a `goals: Goal[]` list (full `Goal` schema with `includeReviews/includeRejectionHistory` behavior), or
- a new endpoint `GET /api/v1/evaluation/employee-goal-list-page` that returns:
  - `currentUser` (and/or `userMap` if multi-user view is required)
  - `periods`
  - full `goals` (same shape as `/goals?includeReviews&includeRejectionHistory`)

This avoids frontend needing to call `/evaluation-periods` + `/goals` + `/users` separately, and lets the backend optimize joins/batching.

## 7) What I need from you before implementation

I can proceed with **Track A** (frontend page loader composing existing endpoints) without further product decisions. The items below are only needed for broader changes:

1. Confirm desired behavior for **employee goal-list**:
   - Should it ever show multiple employees (selector), or is it strictly “my goals only”?
2. Confirm whether we can rely on JWT `internal_user_id` (token template includes it) so we can delete `checkUserExistsAction` calls.
3. Pick the preferred supervisor goal review fix:
   - Backend endpoint `/evaluation/goal-review-page` (best), or
   - Interim batch-goals endpoint `/goals/by-ids` (also good), or
   - Keep N calls but concurrency-limited (least ideal).
