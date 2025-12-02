# Optimize org resolution, auth caching, and page-level read endpoints

## Summary

FastAPI ミドルウェア層での org 解決や AuthService による JWT デコードを最適化し、ページ単位の読み取り用 API を追加することで、1 画面表示あたりのクエリ数・API 呼び出し回数を削減しつつ、Goal の JSONB (target_data) スキーマを厳格化して不正データを早期に排除する。

## Background

Current API design and data-access patterns produce redundant work per request:
- JWT is decoded and the org is re-resolved multiple times in the same request lifecycle.
- Single UI screens often trigger multiple CRUD-style endpoints to assemble the data they need.
- The frontend receives mixed response shapes (page-like responses and generic CRUD responses) and performs additional filtering/aggregation in the browser.
- Several repository methods fetch large result sets and filter them in Python instead of leveraging SQL.

These lead to unnecessary database load, higher latency, and more complex frontend logic than necessary.

## Problem Statement

We want to:
- Reduce repeated JWT decoding and org lookups within a single request.
- Consolidate per-screen data fetching into as few API calls and DB queries as possible (ideally a single call per UI page).
- Clarify and separate "page-shaped" responses from generic CRUD responses to avoid over-fetching and extra client-side post-processing.
- Move filtering and aggregation from Python to SQL wherever feasible.
- Enforce stricter validation on `Goal.target_data` (JSONB) so invalid payloads are rejected before hitting the ORM/database layer.

## Scope

This issue focuses on:
- FastAPI middleware layer:
  - `OrgSlugValidationMiddleware` and its org resolution logic.
- Authentication service layer:
  - `AuthService.get_user_from_token` JWT decode and user resolution.
- Service and repository layer:
  - `backend/app/services/**`
  - `backend/app/database/repositories/**`, especially places that "fetch many and filter in Python".
- Endpoint design:
  - Introduce dedicated read endpoints that return all data needed for a single UI page.

Schema changes (beyond JSONB validation rules) and large-scale domain refactors are out of scope unless strictly required by the above.

## Proposal

### 1. Add page-level read endpoints

- Design and implement endpoints that return all data needed for a specific UI screen in one call.
  - Example: `GET /org/{slug}/evaluation/goal-list-page` returning the complete data set required by the "goal list" page.
- Keep these endpoints read-only and focused on query patterns optimized for the page.
- Clearly document the response shape and how it differs from existing CRUD endpoints.

### 2. Introduce lightweight caching (short TTL, org/user scoped)

- Org slug → org id mapping:
  - Implement a short-lived cache in the middleware layer for `slug -> org_id`.
  - Ensure cache keys are safe for multi-tenant usage and consider invalidation when org slugs change.
- Token hash → decoded `AuthUser`:
  - Cache decoded auth information in `AuthService` or the dependency injection layer keyed by a hash of the token.
  - Apply a short TTL to avoid long-lived staleness while still eliminating redundant decodes within a request window.

Implementation details (in-memory per-process cache vs. shared cache) should be chosen to balance simplicity with deployment constraints.

### 3. Rework `OrgSlugValidationMiddleware`

- Reuse org resolution results within a single request:
  - If `request.state.org_id` and/or `request.state.org_slug` have already been set, use them instead of hitting the database again.
- Ensure org lookup happens at most once per request that requires it.
- Avoid "always go to DB when the path matches" behavior by:
  - Guarding DB calls with checks for existing state and cache hits.
  - Logging only nondeterministic or side-effectful operations related to org resolution.

### 4. Optimize repository queries

- Move filtering/aggregation from Python into SQL:
  - Replace "fetch many and filter in Python" with appropriate `WHERE`, `JOIN`, and `GROUP BY` clauses.
  - Validate that these queries align with existing database indexes; propose new indexes only when necessary.
- Prefer query patterns that:
  - Are stable and predictable for maintainers.
  - Are aligned with the access patterns of the new page-level endpoints.

Where helpful, add small integration tests to guard against regressions in query semantics.

### 5. Strengthen `Goal.target_data` (JSONB) validation

- Introduce strict Pydantic models at the API layer for `Goal.target_data`, for example:
  - Discriminated unions by goal type with explicit required fields per variant.
- Ensure malformed or structurally invalid payloads:
  - Are rejected with a 4xx response (likely 400) at the API validation layer.
  - Do not reach the SQLAlchemy model/domain layer.

This should reduce inconsistent data in the JSONB field and simplify downstream logic that consumes it.

## Acceptance Criteria

- Org slug resolution and JWT decode happen at most once per request that needs them, verified via instrumentation or logs.
- At least one key UI screen (e.g., goal list page) has a dedicated page-level read endpoint that returns all required data in a single API call.
- Repositories previously performing significant Python-side filtering now use SQL-based filters, with no loss of functionality.
- `Goal.target_data` invalid structures are rejected with 4xx before persisting, and tests cover representative invalid cases.
- No regressions in existing CRUD endpoints; they remain available and functionally equivalent.

## Open Questions

- Which UI pages should be prioritized first for page-level read endpoints?
- Do we need a shared caching layer (e.g., Redis) in the near term, or is per-process in-memory caching sufficient for the current scale?
- Are there any existing indexes we should extend or new indexes we must add to support the optimized queries?