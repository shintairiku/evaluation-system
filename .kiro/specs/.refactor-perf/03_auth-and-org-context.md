# Auth & Organization Context – Performance Refactor

## 1. Current State (High-Level)

- Clerk is used for authentication on the frontend with `clerkMiddleware` and `auth()` on server.
- Backend validates JWTs via `AuthService.get_user_from_token` and enforces org access in `OrgSlugValidationMiddleware`.
- Frontend HTTP client parses JWTs to derive `orgSlug` for organization-scoped URLs.
- Org and auth checks happen multiple times per user interaction (middleware, layout, server actions, backend middleware).

## 2. Main Problems / Bottlenecks (To Detail)

- Duplicate or redundant calls to `auth()` / Clerk on the frontend (middleware + layouts + hooks).
- Repeated JWT parsing and org slug extraction in the HTTP client for each request.
- Backend revalidates org and token on every request without reusing per-request auth context.

## 3. Goals

- Guarantee security and multi-tenant isolation without unnecessary repeated work.
- Have a single, well-defined “auth + org context” object per request that both frontend and backend layers can reuse.
- Make org switching safe and explicit while avoiding stale context.
- Ensure auth and org context handling contributes minimal overhead to the p95 latency targets defined in the infra/observability spec for hot endpoints and server actions.

## 4. Proposed Direction (Outline)

- Define a canonical “CurrentUserContext” API on the backend and a matching server action on the frontend.
- Cache decoded auth info and org slug per request on both sides:
  - Next: derive once in middleware or top-level layout, pass via context.
  - Backend: derive once in middleware and attach to `request.state`, reuse downstream.
- Add a short-TTL cache for token → `AuthUser` in `AuthService.get_user_from_token` (e.g. using `cachetools.TTLCache` or Redis) so the same JWT is not fully re-verified multiple times within a short window.
- Remove redundant org checks in per-segment layouts if middleware guarantees org membership.
- Consolidate dev keys and test-org flows so we can safely toggle performance logging without weakening auth.

## 5. Open Questions

- Where is the single source of truth for org slug vs org id in the system?
- Do we ever support “multi-org in one session/tab” flows, or is it always one active org at a time?
- How strict do we want to be about rejecting requests when org context is missing vs redirecting?
