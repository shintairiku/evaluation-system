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
