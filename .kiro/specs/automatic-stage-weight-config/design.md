# Design Document — Automatic Stage-Based Weight Configuration

## 1. Overview

This design translates the requirements in `requirements.md` into concrete backend and frontend changes that deliver automatic goal weights per employee stage. The goal is to eliminate manual weight entry, enforce the policy depicted in the provided weight table (定量/定性/コンピテンシー), and give admins a safe interface to maintain future policy tweaks.

## 2. Architecture

### 2.1 System Flow

```mermaid
flowchart TD
    AdminUI[Admin Stage Weight UI\nNext.js Server Components] -->|PATCH /stages/{id}/weights| StageAPI[FastAPI Stages Endpoint]
    StageAPI -->|persist| StageTable[(stages)]
    StageAPI -->|audit event| WeightHistory[(stage_weight_history)]

    GoalUI[Employee Goal Form\nClient Component] -->|POST /goals| GoalAPI[F /api/v1/goals]
    GoalAPI --> GoalService[GoalService.create_goal]
    GoalService --> StageRepo[StageRepository.get_by_id]
    StageRepo --> StageTable
    GoalService -->|auto weight + validate| GoalRepo[(goals)]
```

### 2.2 Data Flow Summary

1. **Admin Config Path** – Admins adjust weights via a modal. The UI talks to a dedicated `PATCH /stages/{stage_id}/weights` endpoint that updates the `stages` table and records the change in `stage_weight_history`.
2. **Employee Goal Creation** – Goal forms omit the weight input. Once a draft or submitted goal is posted, `GoalService` fetches the creator’s stage (with weight columns) and injects the correct weight before persisting.
3. **Read Models** – `GET /stages`, `GET /stages/{id}`, and `GET /users/me` now hydrate `quantitativeWeight`, `qualitativeWeight`, and `competencyWeight` so both admin and employee UIs have a single source of truth.
4. **Validation** – Shared validation utilities ensure decimals stay within 0–100, at least one weight is positive, and optimistic locking prevents clobbered edits.

## 3. Data Model & Persistence

### 3.1 Stage Table Extension

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| `quantitative_weight` | `DECIMAL(5,2)` | `NULL` (seeded) | 0–100, `NOT NULL` after migration, org-scoped |
| `qualitative_weight` | `DECIMAL(5,2)` | `NULL` (seeded) | Allows `0.00` for stages 6–9 |
| `competency_weight` | `DECIMAL(5,2)` | `NULL` (seeded) | 10% policy, but configurable |

Check constraints enforce the numeric bounds; `updated_at` already captures last edit timestamps.

### 3.2 Default Weight Matrix (per policy image)

| Stage | 定量 | 定性 (PJ) | コンピテンシー | Notes |
| --- | --- | --- | --- | --- |
| Stage 1 | 70 | 30 | 10 | Entries 1–3 share the same split |
| Stage 2 | 70 | 30 | 10 |  |
| Stage 3 | 70 | 30 | 10 |  |
| Stage 4 | 80 | 20 | 10 | Start of leadership accountability |
| Stage 5 | 80 | 20 | 10 |  |
| Stage 6 | 100 | 0 | 10 | Qualitative weight disabled (display as “-”) |
| Stage 7 | 100 | 0 | 10 |  |
| Stage 8 | 100 | 0 | 10 |  |
| Stage 9 | 100 | 0 | 10 |  |

New migrations seed these defaults and ensure future stages bootstrap with `70/30/10` unless otherwise specified.

### 3.3 Weight History Table

To satisfy Requirement 10, introduce `stage_weight_history`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | Generated via `gen_random_uuid()` |
| `stage_id` | UUID FK -> `stages.id` | Indexed |
| `organization_id` | VARCHAR(50) | Audit scope |
| `actor_user_id` | UUID | Admin who changed the weight |
| `quantitative_weight_before/after` | DECIMAL(5,2) | Stored separately for diffs |
| `qualitative_weight_before/after` | DECIMAL(5,2) |  |
| `competency_weight_before/after` | DECIMAL(5,2) |  |
| `changed_at` | TIMESTAMP | Defaults to `NOW()` |

Entries are append-only; retrieval sorted by `changed_at DESC`.

## 4. Backend Design

### 4.1 Database Migrations

1. **`021_add_stage_weight_columns.sql`** – Adds the three decimal columns with `CHECK` constraints and backfills defaults using the policy table.
2. **`022_create_stage_weight_history.sql`** – Creates the history table with indexes on `(stage_id, changed_at)` for fast lookups.

Alembic scripts live under `backend/app/database/migrations`. Production copies go under `migrations/production`.

### 4.2 Repository & Service Changes

- `StageRepository`
  - Include weight columns in `select` projections.
  - Add `update_weights(stage_id, payload, org_id)` using `with_for_update()` to avoid concurrent edits.
  - Provide `get_weight_history(stage_id, org_id, limit=20)` helper for admin UI timelines.

- `StageService`
  - Extend DTO mapping so `Stage`, `StageDetail`, and `StageWithUserCount` expose the three weight fields.
  - New method `update_stage_weights(auth_context, stage_id, StageWeightUpdate)` that validates, persists, and pushes an audit entry.
  - Emit structured logs (stage id, before/after values, actor).

- `GoalService`
  - Introduce `_resolve_auto_weight(goal_data, target_user_id, org_id)` which loads the user + stage weights using `UserRepository`.
  - Call `_resolve_auto_weight` inside `create_goal` and `update_goal` **before** validation so `GoalCreate.weight` can be optional in API contracts.
  - Skip manual weight validation when the system assigned the value; instead, verify that stage weights per category stay within `<= 100`.
  - When editing legacy goals, only reapply auto-weight if the user changes goal category or type (Requirement 5).

- `UserRepository`
  - Provide `get_user_with_stage(user_id, org_id)` that joins `stages` to avoid double queries.

### 4.3 Validation Logic

- Shared `StageWeightValidator` module (e.g., `backend/app/services/validators/stage_weights.py`) centralizes:
  - Bound checks (`0 <= weight <= 100`).
  - “At least one weight > 0”.
  - Converting `None` to defaults when a stage has not been configured.

- Edge cases:
  - Users without a stage raise `BadRequestError("User must be assigned to a stage before creating goals")`.
  - Stage weights missing -> fallback to defaults, but log at WARN to prompt admins.

### 4.4 Serialization & Auth Context

- Update Pydantic schemas in `backend/app/schemas/stage_competency.py` to include `quantitative_weight`, `qualitative_weight`, `competency_weight`.
- Extend `AuthContext` hydration (used in `get_users_me`) so the frontend can render explanatory text without additional calls.

## 5. API Surface

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/v1/stages` | List stages + weights (cached) | Authenticated user |
| `GET` | `/api/v1/stages/{stage_id}` | Stage detail + weights + history link | Authenticated |
| `PATCH` | `/api/v1/stages/{stage_id}/weights` | Update weights (body: `{ quantitativeWeight, qualitativeWeight, competencyWeight }`) | Admin only |
| `GET` | `/api/v1/stages/{stage_id}/weight-history` | Paginated audit log (optional) | Admin only |
| `GET` | `/api/v1/users/me` | Include `stage.weightConfig` block | Authenticated |
| `POST/PUT` | `/api/v1/goals` | Accept omitting `weight`; backend injects | Existing RBAC |

Error payloads reuse the FastAPI validation format for consistency.

## 6. Frontend Design

### 6.1 Shared Types & Server Actions

- Extend `frontend/src/api/types/stage.ts` interfaces with `quantitativeWeight`, `qualitativeWeight`, `competencyWeight`.
- Update `stagesApi` + server actions to pass weight data through and add `updateStageWeights(stageId, StageWeightUpdate)`/`getStageWeightHistory`.
- Add `StageWeightConfig` type reused by admin UI and goal forms.

### 6.2 Admin Stage Weight UI

- **Route:** `app/(evaluation)/(admin)/stage-weight-config/page.tsx` (sibling to stage-management and competency-management). Server component ensures admin verification via `getStagesAdminAction`.
- **Component Tree:**
  ```
  StageWeightConfigPage (Server)
    └── StageWeightConfigContainer (Client, state)
        ├── StageWeightTable (lists all stages)
        │     └── StageWeightRow (edit + history CTA)
        └── StageWeightModal (form inputs, validation, help text)
              └── StageWeightHistoryDrawer (lazy loads history endpoint)
  ```
- Inputs render percentage fields with helper footnotes referencing the Japanese labels from the policy image. Validation mirrors backend rules and disables “Save” until values are valid.
- Upon success, call `revalidateTag(CACHE_TAGS.STAGES)` so other admin screens refresh automatically.

### 6.3 Goal Creation & Editing UI

- **Performance Goals (`PerformanceGoalsStep.tsx`):**
  - Remove the editable weight input and replace it with a badge showing `quantitativeWeight` or `qualitativeWeight` from the user’s stage.
  - When switching between tabs (定量/定性), update the displayed badge instantly using cached stage data from `getUsersMeAction`.
  - Keep track of whether a goal predates auto-weighting; display “Legacy weight (editable)” for those records but disable editing for new ones.

- **Competency Goals / Core Values Components:**
  - Display a static “10% / Stage policy” badge.
  - For stages with `qualitativeWeight = 0`, show a tooltip “Stage 6以上では定性目標の比重は設定されていません (0%)”.

- **Forms Submission:**
  - Remove `weight` from client payloads; allow backend-injected weight to round-trip by reading from API responses when showing confirmation to the user.

### 6.4 User Education

- Reuse the policy table as a small inline `Popover` under the goal form so employees can confirm the breakdown.
- Provide toast copy “Weight automatically assigned based on your Stage X” after creation to reinforce the change (Requirement 9).

## 7. Security, Audit, and Observability

- Weight endpoints guarded by `require_admin`.
- History table captures actor identity; expose `GET /weight-history` only to admins.
- Add structured logs (`stage_id`, `actor`, `before`, `after`) at INFO level.
- Emit a Prometheus counter `stage_weight_updates_total{stage_id}` to trace frequency (optional but recommended).

## 8. Rollout & Testing

1. **Feature Flag (optional):** Wrap auto-weight enforcement in a server-side flag so we can enable per organization.
2. **Testing Layers:**
   - Unit tests for `StageWeightValidator`, `StageService.update_stage_weights`, and `GoalService._resolve_auto_weight`.
   - API tests covering 403/422 paths and history retrieval.
   - Frontend component tests for the admin modal and goal form badge swapping.
   - Cypress/Playwright scenario: admin edits Stage 4 weights, employee at Stage 4 sees new auto weight.
3. **Deployment Order:**
   1. Ship migrations + backend (while frontend still sends weights) – backend still accepts manual weight until FE rolls out.
   2. Deploy frontend removing manual weights.
   3. Backfill flag to enforce auto assignment after confirming everything works.

With these steps the system remains maintainable, aligns with the engineering philosophy (“simplicity first”), and mirrors the policy table provided in the reference image.
