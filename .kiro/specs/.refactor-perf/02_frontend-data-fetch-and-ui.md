# Frontend Data Fetch & UI – Performance Refactor

## 1. Current State (High-Level)

- Next.js 15 / React 19 with Clerk middleware and server actions as the primary data interface.
- Unified HTTP client (`src/api/client/http-unified-client.ts`) with retries, timeouts, and org-scoped URLs.
- Many pages use multiple server actions from client components instead of a single page-level loader.
- Auto-save for goals (`useGoalAutoSave`, `useGoalTracking`, `useAutoSave`) issues per-goal writes.

## 2. Main Problems / Bottlenecks (To Detail)

- Global `dynamic = 'force-dynamic'` disables static optimizations even for mostly static pages.
- Org slug is recomputed for almost every HTTP call instead of being memoized per request/session.
- Redundant server actions for current user / roles / stage info.
- Some “list” UIs trigger several independent server actions instead of one bundled request.

## 3. Goals

- Move toward “one page = one main server action” that returns all required data.
- Reduce unnecessary server actions (especially repeated user/context fetches).
- Make auto-save and high-churn interactions batch-friendly and latency-tolerant.
- Re-enable static/partial-static rendering where safe.
- Align client/server action patterns with the performance budgets and SLOs enforced by the infra/observability layer, so UI changes do not push key flows over their latency thresholds.

## 4. Proposed Direction (Outline)

- Introduce page-level loaders (server actions) per core screen:
  - Employee goal list, goal input, evaluation input.
  - Supervisor dashboard and evaluation feedback.
  - Admin goal list / org-wide evaluation views.
- Fix `UnifiedHttpClient` org slug caching: actually use `orgSlug` / `orgSlugPromise` to memoize per client and per request instead of recomputing on every call.
- Add server-side request-level caching for org context:
  - Wrap `getCurrentOrgSlug` / `getCurrentOrgContext` (from `src/api/utils/jwt-parser.ts`) with React’s `cache()` so JWT parsing happens at most once per request.
- Add a batched “save goals for period” server action to replace per-goal auto-save writes where UX allows.
- Revisit `dynamic = 'force-dynamic'` after Clerk integration is stable; mark non-sensitive pages as static or partially static.

## 5. Open Questions

- Which pages absolutely require full dynamic rendering vs can be static + client hydration?
- How much batching can we introduce without harming UX (e.g. feedback timing for auto-save toasts)?
- Should we add an explicit client-side request concurrency limiter using `MAX_CONCURRENT_REQUESTS`?

## 6. Implementation Milestones

The items below should be implemented in roughly this order so we can land incremental wins without blocking on deep backend changes.

### 6.1 Core infrastructure

- **M1 – Org context caching (frontend infra)**
  - Wrap `getCurrentOrgSlug` / `getCurrentOrgContext` in React `cache()` to ensure per-request reuse.
  - Update `UnifiedHttpClient` to:
    - Use `orgSlug` / `orgSlugPromise` as an internal memoized cache.
    - Expose `clearOrgSlugCache()` for explicit invalidation on org switch.
- **M2 – Request concurrency guard**
  - Implement a lightweight in-memory semaphore inside `UnifiedHttpClient` that enforces `API_CONFIG.MAX_CONCURRENT_REQUESTS` across client calls.
  - Add minimal logging/metrics hooks to understand when throttling activates (dev only).
- **M3 – Dynamic/static rendering baseline**
  - Remove or narrow `export const dynamic = 'force-dynamic'` on the root layout.
  - Explicitly mark clearly safe pages as static/ISR (marketing / landing, static admin references).
  - Document criteria for “must-be-dynamic” vs “can be static + client hydration”.

### 6.2 Page-level loaders (evaluation flows)

- **M4 – Employee goal list loader**
  - Add a new server action `getEmployeeGoalListPageDataAction` that returns:
    - Current user (or at least user id and stage).
    - Categorized evaluation periods (current + all).
    - Users list needed for grouping.
    - Goals for the selected period with `includeReviews` + `includeRejectionHistory`.
  - Refactor the employee goal list page to:
    - Call this action in a server component.
    - Pass preloaded data into the client UI; avoid calling `getGoalsAction` / `getUsersAction` / `getCategorizedEvaluationPeriodsAction` from the browser.
  - Keep `useGoalListData` as a thin adapter over props or deprecate it once the page-level loader is stable.
- **M5 – Goal input loader + period selection**
  - Add a server action `getGoalInputPageDataAction` that returns:
    - Current user + stage weights.
    - Categorized evaluation periods.
    - Existing editable goals (draft/rejected) for a given period.
  - Refactor period selection so:
    - The page server component loads periods once and passes them to a pure `EvaluationPeriodSelector` UI component.
    - `usePeriodSelection` only manages client-state transitions based on pre-fetched data, not direct server action calls.
- **M6 – Supervisor goal review loader**
  - Add a server action `getSupervisorGoalReviewPageDataAction` that returns:
    - Period metadata.
    - Grouped goals-by-employee with the `goalId → supervisorReviewId` mapping.
  - Migrate `GoalReviewPage` to:
    - Use the loader in a server component.
    - Limit client-side hooks to tab selection, keyboard navigation, and local filters.

### 6.3 Auto-save and write patterns

- **M7 – Batched “save goals for period” API**
  - Backend: introduce a batched endpoint (e.g. `POST /goals/batch`) that can create/update multiple performance and competency goals in one transaction.
  - Frontend: add `saveGoalsForPeriodAction` in `server-actions/goals.ts` that wraps this endpoint with proper error handling and cache revalidation.
- **M8 – Auto-save refactor to use batching**
  - Update `useGoalAutoSave` to:
    - Build a batched payload from `actuallyChangedGoals`.
    - Call `saveGoalsForPeriodAction` once per auto-save cycle instead of per-goal `createGoalAction` / `updateGoalAction`.
  - Ensure toasts and error messages still reflect per-goal outcomes where needed, but without N HTTP calls.

### 6.4 Shared user / org / period context

- **M9 – CurrentUserContext contract**
  - Define a server action (and TypeScript type) for `CurrentUserContext` that includes:
    - Authenticated user, roles, stage.
    - Active org id/slug.
    - Current evaluation period (if any).
  - Load this once in a top-level layout or dashboard entrypoint.
- **M10 – Hook/context migration**
  - Refactor `useUserRoles`, `GoalListContext`, and any other user/org/period aware hooks to:
    - Read from `CurrentUserContext` (via React context) instead of calling `checkUserExistsAction`, `getUserByIdAction`, or `getCategorizedEvaluationPeriodsAction` directly.
  - Remove redundant server-action calls that only re-derive the same context.

### 6.5 Cleanup and guardrails

- **M11 – Audit server-action usage from client components**
  - Use a quick `rg "get.*Action" frontend/src/feature frontend/src/context` pass to identify remaining client-side server-action calls.
  - For each, either:
    - Move the call into a page-level loader / server component, or
    - Justify and document why it must remain client-triggered (e.g. explicit user-driven refresh).
- **M12 – Documentation and developer guidelines**
  - Extend `frontend/src/api/README.md` (or a sibling doc) with:
    - “One page = one loader” pattern and examples.
    - When to add a new server action vs when to piggyback on an existing loader.
    - How to work with org-context caching and `CurrentUserContext`.

### 6.6 Page-by-page frontend audit (recurring)

- **M13 – Per-route performance and structure check**
  - For each `app/.../page.tsx` and related layout, inspect:
    - Route layout + page component, associated `feature/*` display + hooks, shared pieces in `components/*`, and any `api/server-actions` touched.
    - Folder placement: keep page-specific UI in `feature/<domain>/<page>/display`, hooks in `feature/<domain>/<page>/hooks`, and cross-page UI in `components/*`.
    - Performance: keep loaders on the server, avoid client-side server-action calls, ensure Suspense/loading/error states, memoize/paginate list renders, and watch bundle weight for heavy imports.
  - After completing a route, tick it in `docs/frontend-refactor-checklist.md` and append bullets for any newly touched leaves.

## 7. Page-by-page review runbook
- Pick the next unchecked route from `docs/frontend-refactor-checklist.md`.
- Trace data flow: identify the server action(s) that load the page, map props to client components, and list any remaining client-triggered server actions.
- Verify folder/file organization: move or rename files if the route’s UI/hooks live outside `feature/<domain>/<page>/...` without justification; keep shared UI in `components/*`.
- Validate performance: drop unnecessary `dynamic = 'force-dynamic'`, ensure suspense/loading/error boundaries, batch network calls where possible, memoize/paginate large lists, and prefer streaming where safe.
- Record outcomes in the checklist (static vs dynamic choice, loader used, any follow-ups) and add new bullets for newly discovered files.
