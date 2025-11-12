# Design Document — Automatic Stage-Based Weight Configuration

## 1. Overview

This design translates the requirements in `requirements.md` into concrete backend and frontend changes that deliver guided stage weight budgets. The goal is to eliminate guesswork, ensure every employee’s quantitative/qualitative totals match the policy table (定量/定性/コンピテンシー), and give admins a safe interface to maintain future policy tweaks.

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
    GoalService -->|validate stage budgets| GoalRepo[(goals)]
```

### 2.2 Data Flow Summary

1. **Admin Config Path** – Admins adjust weights via a modal. The UI talks to a dedicated `PATCH /stages/{stage_id}/weights` endpoint that updates the `stages` table and records the change in `stage_weight_history`.
2. **Employee Goal Creation** – Goal forms keep editable weights but auto-split the remaining budget per category. On submit, `GoalService` verifies that the totals per category equal the stage configuration before saving the user-defined values.
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
  - Introduce `_validate_stage_weight_budget(goals, user_stage)` that sums weights per category and compares with the stage configuration.
  - Call the validator inside `create_goal` and `update_goal` so drafts/submissions cannot exceed or undershoot the configured totals.
  - Provide helper `_prefill_default_weights(goals, stage_config)` that the frontend can invoke via API to suggest even splits when adding new cards.
  - When editing legacy goals, bypass rebalancing unless the user touches weight fields; as soon as they do, enforce the current stage budget (Requirement 5).

- `UserRepository`
  - Provide `get_user_with_stage(user_id, org_id)` that joins `stages` to avoid double queries.

### 4.3 Validation Logic

- Shared `StageWeightValidator` module (e.g., `backend/app/services/validators/stage_weights.py`) centralizes:
  - Bound checks (`0 <= weight <= 100`).
  - “At least one weight > 0”.
  - Aggregating goal weights per category and comparing totals to the stage configuration with descriptive errors.
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
| `POST/PUT` | `/api/v1/goals` | Accepts user-entered weights; backend validates sums against stage budgets | Existing RBAC |

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
  - Keep the numeric weight input but initialize it with an even split of the remaining budget (e.g., first quantitative goal = 70, add second goal → both become 35).
  - Show a progress badge per category (`Quantitative: 40 / 70% allocated`). When totals reach the budget, highlight in green; when under/over, show warnings and disable submit.
  - Provide a quick action “Fill remaining” that sets the selected goal’s weight to whatever is left to hit the budget.

- **Competency/Core Value Goals:**
  - Default to 10% total; if multiple competency goals are allowed, auto-split the 10% but keep inputs editable with the same validation rules.
  - For Stage 6+ qualitative budgets (0%), show tooltip “定性目標はこのステージでは評価対象外 (0%)” and prevent non-zero totals.

- **Forms Submission:**
  - Still send `weight` in the payload; backend re-validates totals to prevent tampering or race conditions.

### 6.4 User Education

- Reuse the policy table as a small inline `Popover` under the goal form so employees can confirm the breakdown.
- Provide helper text such as “残り30%を定量目標に割り当ててください” and toast confirmation “Stage 3 の70%/30%配分が完了しました” once totals are satisfied.

## 7. Security, Audit, and Observability

- Weight endpoints guarded by `require_admin`.
- History table captures actor identity; expose `GET /weight-history` only to admins.
- Add structured logs (`stage_id`, `actor`, `before`, `after`) at INFO level.
- Emit a Prometheus counter `stage_weight_updates_total{stage_id}` to trace frequency (optional but recommended).

## 8. Rollout & Testing

1. **Feature Flag (optional):** Wrap budget enforcement in a server-side flag so we can enable per organization.
2. **Testing Layers:**
   - Unit tests for `StageWeightValidator`, `StageService.update_stage_weights`, and `GoalService._validate_stage_weight_budget`.
   - API tests covering 403/422 paths and history retrieval.
   - Frontend component tests for the admin modal and goal form badge swapping.
   - Cypress/Playwright scenario: admin edits Stage 4 weights, employee at Stage 4 sees updated budget totals (e.g., 85/15) and must rebalance before submission.
3. **Deployment Order:**
   1. Ship migrations + backend (which validates totals but still accepts existing payloads).
   2. Deploy frontend with guided distribution UI.
   3. Backfill flag to enforce strict validation after confirming everything works.

With these steps the system remains maintainable, aligns with the engineering philosophy (“simplicity first”), and mirrors the policy table provided in the reference image.
