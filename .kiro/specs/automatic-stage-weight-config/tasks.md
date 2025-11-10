# Implementation Plan — Automatic Stage-Based Weight Configuration

> GitHub Issue: [#305](https://github.com/shintairiku/evaluation-system/issues/305)

## 1. Database & Schema

- [ ] **1.1 Add weight columns to `stages` table**
  > Create Alembic migration `021_add_stage_weight_columns` that adds `quantitative_weight`, `qualitative_weight`, and `competency_weight` (`DECIMAL(5,2)`, `NOT NULL`, `CHECK 0–100`). Seed default values matching the policy image and ensure newly-created stages inherit `70/30/10`.  
  > **Related requirements:** Req 1, Req 2, Req 6, NFR-2

- [ ] **1.2 Create `stage_weight_history` audit table**
  > Migration `022_create_stage_weight_history` with before/after columns, actor id, timestamps, indexes on `(stage_id, changed_at)`.  
  > **Related requirements:** Req 10, NFR-3

## 2. Backend Services & APIs

- [ ] **2.1 Extend Stage Pydantic schemas and API responses**
  > Update `backend/app/schemas/stage_competency.py`, `/api/v1/stages` endpoints, and `StageService` DTO mapping so every stage payload includes the three weight fields.  
  > **Related requirements:** Req 1, Req 7

- [ ] **2.2 Implement weight update endpoint**
  > Add `PATCH /api/v1/stages/{stage_id}/weights` (FastAPI router + StageService method) guarded by `require_admin`. Persist via new `stage_repo.update_weights`, validate decimal bounds, and append an entry to `stage_weight_history`.  
  > **Related requirements:** Req 1, Req 6, Req 7, Req 10

- [ ] **2.3 Expose weight history API**
  > Optional but recommended: `GET /api/v1/stages/{stage_id}/weight-history?limit=20` returning newest-first audit entries for admin UI timelines.  
  > **Related requirements:** Req 10

- [ ] **2.4 Update `GET /users/me`**
  > Include `stage.weightConfig` so client goal forms can read the policy without an extra request.  
  > **Related requirements:** Req 3, Req 4, Req 9

## 3. Goal Weight Budget Logic

- [ ] **3.1 Introduce `_validate_stage_weight_budget` helper in `GoalService`**
  > Fetch the user’s stage (via `UserRepository.get_user_with_stage`), sum weights per category, and compare totals with the configured budget. Handle competency/core-value mapping and the Stage 6–9 qualitative=0 edge case.  
  > **Related requirements:** Req 3, Req 5, Req 8, Edge Cases 1–4

- [ ] **3.2 Adjust validation & legacy compatibility**
  > Enforce the new budget validator on create/update while still allowing legacy goals to remain unchanged unless their weights are edited. Keep `_validate_weight_limits` for backward compatibility with submitted drafts.  
  > **Related requirements:** Req 5, Req 8, Edge Case 4

- [ ] **3.3 Update Goal schemas & docs**
  > Document that `weight` stays in the payload but is validated server-side; add metadata indicating how much budget remains per category for client helpers.  
  > **Related requirements:** Req 3, Req 4

## 4. Admin Stage Weight UI

- [ ] **4.1 Build Stage Weight Config page**
  > New route `app/(evaluation)/(admin)/stage-weight-config/page.tsx` reusing the pattern from stage-management (server component for auth).  
  > **Related requirements:** Req 1, Req 7, Req 9

- [ ] **4.2 Implement configuration table & modal**
  > Components: `StageWeightConfigContainer`, `StageWeightTable`, `StageWeightModal`, `StageWeightHistoryDrawer`. Inputs enforce the same validation rules, show the policy footnote, and call a server action that invokes `stagesApi.updateWeights`.  
  > **Related requirements:** Req 1, Req 6, Req 9, NFR-5

- [ ] **4.3 Wire caching + history**
  > Server action should `revalidateTag(CACHE_TAGS.STAGES)` after saves; optional drawer loads `/weight-history` for auditing.  
  > **Related requirements:** Req 10

## 5. Employee Goal Experience

- [ ] **5.1 Guided weight distribution UI**
  > Update `PerformanceGoalsStep.tsx` to keep weight inputs, auto-split the remaining budget when a goal is added, and show running totals with success/error states.  
  > **Related requirements:** Req 3, Req 4, Req 9

- [ ] **5.2 Update competency/core-value goal components**
  > Mirror the same budget tracking for competency/core value goals (10% total or 0% where applicable) and block submission when totals mismatch.  
  > **Related requirements:** Req 3, Req 4, Edge Case 3

- [ ] **5.3 Ensure goal detail/review views highlight compliance**
  > Supervisors and employees should see total-by-category badges (e.g., “Quantitative: 70/70% complete”) instead of “auto weight” tags, reinforcing the policy.  
  > **Related requirements:** Req 9

## 6. Testing & Rollout

- [ ] **6.1 Backend unit/integration tests**
  > Cover Stage weight validator, repository updates, new endpoints, and GoalService flows (quantitative, qualitative, competency, legacy edit).  
  > **Related requirements:** Req 1–5, Req 7–10, NFR-2

- [ ] **6.2 Frontend tests**
  > Component tests for StageWeightModal validation, snapshot for StageWeightTable, and goal form behaviour (badge updates per stage).  
  > **Related requirements:** Req 4, Req 6, Req 9

- [ ] **6.3 E2E/Playwright scenarios**
  > Admin updates Stage 4 weights → employee at Stage 4 must rebalance goals to the new 85/15 totals before submission; ensure non-admin sees 403 when visiting the config page.  
  > **Related requirements:** Req 1, Req 3, Req 7

- [ ] **6.4 Deployment checklist**
  > Run migrations, back up existing goals table, deploy backend with budget validation in “warn only” mode → deploy frontend with guided distribution UI → flip the feature flag to enforce hard failures. Document rollback (restore previous stage weights + disable strict validation).  
  > **Related requirements:** Req 8, Success Metrics, Rollout Plan
