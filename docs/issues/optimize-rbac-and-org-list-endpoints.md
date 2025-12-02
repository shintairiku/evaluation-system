# Optimize RBAC and org-scoped list endpoints

## Summary

認可・組織キャッシュを導入した後（#374 参照）も、組織スコープのリストエンドポイント（ユーザー、目標、評価期間、上司レビュー、部門）は依然として2〜5秒のマルチセカンドレイテンシーが発生しています。主なボトルネックはJWT/組織解決ではなく、RBACコンテキストのロードと重いリストクエリにあると思われます。本課題は、RBACの参照最適化とページ志向のリストクエリの改善にフォーカスします。

## Background

Recent logs from the dockerized production-like environment (run via `scripts/run-local.sh`) show:
- `GET /api/v2/org/{slug}/users/` taking ~4–5s.
- `GET /api/org/{slug}/evaluation-periods/` repeatedly taking ~2–2.6s.
- `GET /api/org/{slug}/supervisor-reviews/pending?limit=100` taking ~2.2s.
- `GET /api/org/{slug}/goals/?...includeReviews=true&includeRejectionHistory=true` and `GET /api/org/{slug}/admin/goals?...includeReviews=true&includeRejectionHistory=true` taking ~2.5–3.5s.

Each of these requests passes through:
- `OrgSlugValidationMiddleware` (now with slug → org_id caching).
- `get_auth_context` (RBAC context construction).
- A service-layer list operation that executes one or more SQL queries.

Auth/org resolution has been optimized (per `optimize-auth-org-resolution-and-page-read-endpoints.md`), but overall latency remains above the desired SLO for common list pages.

## Problem Statement

We want to:
- Reduce per-request RBAC overhead for org-scoped endpoints that are called very frequently (dashboards, lists).
- Ensure user/goals/evaluation-periods/departments/supervisor-reviews list endpoints use well-structured, index-friendly SQL without redundant joins or N+1 patterns.
- Provide page-shaped read models for the highest-impact list UIs so the frontend can render a full screen with minimal API calls.

## Scope

This issue focuses on:
- `backend/app/security/dependencies.py` (RBAC context loading).
- Org-scoped list endpoints and services:
  - `backend/app/api/v2/users.py` and related services/repositories.
  - `backend/app/api/v1/evaluation_periods.py` and `EvaluationPeriodRepository`.
  - `backend/app/api/v1/supervisor_reviews.py` and `SupervisorReviewRepository`.
  - `backend/app/api/v1/goals.py` / `GoalService` list/admin endpoints where includeReviews/includeRejectionHistory are used.
  - `backend/app/api/v1/departments.py` and `DepartmentRepository`.

Out of scope:
- JWT verification, org slug resolution, and Goal.target_data validation (covered by `optimize-auth-org-resolution-and-page-read-endpoints.md`).

## Proposal

### 1. Optimize RBAC context loading for hot paths

- Introduce a short-lived per-request cache inside `get_auth_context` so repeated dependency resolution within the same request reuses an already-built `AuthContext`.
- Avoid re-querying role permissions when the same user/org/role set is already cached in-process (leverage and extend `role_permission_cache`).
- Ensure viewer visibility overrides are only loaded when strictly needed (viewer-only flows), and cached with a sensible TTL.

### 2. Introduce page-level list read endpoints where missing

- For admin/manager dashboards that currently call multiple list endpoints (users, goals, evaluation periods, departments), introduce consolidated, page-shaped read endpoints that:
  - Return all table data and necessary filter metadata in a single call.
  - Are backed by explicit read models/queries (not generic CRUD + post-processing).

### 3. Audit and optimize list queries

- For each of the slow endpoints listed above:
  - Inspect the service/repository implementations for N+1 patterns and Python-side filtering.
  - Move filtering/aggregation into SQL and ensure proper use of indexes.
  - Add targeted logging (at debug/info level) of query counts and elapsed time around the service call to validate improvements.

## Acceptance Criteria

- RBAC context construction (`get_auth_context`) does not dominate request time for typical org-scoped list endpoints; repeated dependency resolutions within a single request reuse the same `AuthContext`.
- At least one high-impact dashboard/list UI (e.g., admin goals dashboard or users v2 list) has a dedicated page-level read endpoint that returns all necessary data in a single API call.
- Identified N+1 patterns and Python-side filtering in the targeted services/repositories are replaced with SQL-based filters and batch queries.
- Slow-log entries for the targeted endpoints (2–5s range) are reduced to within agreed SLOs under the same test load in the dockerized production-like environment.

