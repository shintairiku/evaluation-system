# Backend API & Services – Performance Refactor

## 1. Current State (High-Level)

- FastAPI app with org-scoped routers under `/api/org/{org_slug}/` and some `/api/v2` endpoints.
- Business logic lives in `app/services/**` with async SQLAlchemy repositories in `app/database/repositories/**`.
- Org validation and auth happen per request in `OrgSlugValidationMiddleware` + `AuthService.get_user_from_token`.
- Goal, self-assessment, and dashboard services already batch some queries and use indexes, but still issue multiple queries per request.

## 2. Main Problems / Bottlenecks (To Detail)

- Repeated JWT decoding and org lookups on every request (even within the same user interaction).
- Some endpoint patterns still do multiple sequential queries where one well-structured query (or a read model) would suffice.
- No clear separation between “page-shaped read models” and generic CRUD endpoints, leading to over-fetching and post-processing in Python.

## 3. Goals

- Reduce per-request overhead for common flows (goal list, evaluation input, dashboards).
- Standardize “page-shaped” backend responses that map 1:1 to frontend server actions.
- Ensure queries stay efficient as org/user/goal counts grow (indexes, batching, read models).
- Keep backend endpoints for key flows within the performance budgets and SLOs defined in the infra/observability spec (see `05_infra-db-and-observability.md`).

## 4. Proposed Direction (Outline)

- Introduce page-level read endpoints (e.g. `GET /org/{slug}/evaluation/goal-list-page`), returning all data needed for a single UI in one call.
- Add lightweight caching for hot read paths (per org/user, very short TTL) where appropriate.
- Introduce small in-memory caches in middleware/service layer for:
  - org slug → org id (e.g. inside `OrgSlugValidationMiddleware` so repeated requests do not re-call `OrganizationRepository.get_by_slug` when org context is already known).
  - token hash → decoded `AuthUser` (short TTL) to avoid repeated JWT verification work in `AuthService.get_user_from_token`.
- Refactor `OrgSlugValidationMiddleware` to:
  - Reuse a previously attached `request.state.org_id` / `request.state.org_slug` when present.
  - Treat DB/org lookups as a one-time per-request concern instead of “always query on every matching path”.
- Audit repositories for any remaining “fetch many then filter in Python” patterns and move filters into SQL with proper indexes.
- Strengthen `Goal` JSONB (`target_data`) validation at the API boundary:
  - Use Pydantic models (e.g. discriminated unions for performance / competency / core value goals) in `GoalCreate` / `GoalUpdate`.
  - Ensure invalid structures are rejected before reaching the SQLAlchemy model-level validators in `app/database/models/goal.py`.

## 5. Open Questions

- Do we want dedicated read models / DB views (e.g. `goal_list_view`) for dashboards, or keep everything in ORM for now?
- What maximum org size do we explicitly design for (e.g. 5k, 20k users)?
- How aggressively should we cache read endpoints vs always hitting the DB?
