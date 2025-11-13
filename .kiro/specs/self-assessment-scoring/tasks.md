# Implementation Tasks: DB-Driven Evaluation Scoring & Self-Assessment UI

> Traceability: Req-1 ↔ master tables, Req-2 ↔ weighted scoring, Req-3 ↔ latest approved goals + autosave, Req-4 ↔ submission summary & ladder, Req-5 ↔ policy flags / level preview, Req-6 ↔ perf+i18n.

## 1. Database & Seed Work

- [ ] **1.1 Create rating master migration**
  - File: `backend/app/database/migrations/0xx_create_evaluation_score_tables.sql`
  - Tables: `evaluation_score_mapping`, `rating_thresholds`, `evaluation_policy_flags`, `level_adjustment_master`, `self_assessment_summaries`.
  - Seed data inline or via `COPY` using spreadsheet values.
- [ ] **1.2 Add `self_rating_text` to `self_assessments`**
  - Nullable TEXT column storing SS–D value the employee selected.
  - Backfill from existing numeric scores (map ranges to codes temporarily) so past drafts remain valid.
- [ ] **1.3 Create `latest_approved_goals` view**
  - Encapsulate recursion for `previous_goal_id` chain.
  - Ensure `ALTER VIEW ... OWNER TO postgres` is included for Supabase compatibility.

## 2. Backend Services & Schemas

- [ ] **2.1 Implement `ScoreMappingRepository` + `ScoringService`**
  - Location: `backend/app/database/repositories/score_mapping_repo.py` & `backend/app/services/scoring_service.py`.
  - Methods: `get_score(code)`, `list_scores()`, `list_thresholds()`, `map_numeric_to_grade(total)`, `compute_summary(buckets, stage_weights, policy_context)`.
- [ ] **2.2 Extend `SelfAssessmentService` payload builder**
  - Add helper `get_self_assessment_context(user_id, period_id)` returning `{goals, draft, stage_weights, thresholds}`.
  - Fetch stage via `StageRepository.get_by_id` using `current_user_context.user.stage_id`.
  - Goals query uses new view + `GoalRepository` to hydrate full target data.
- [ ] **2.3 Draft upsert endpoint**
  - API route `POST /self-assessments/draft` accepts `SelfAssessmentDraftRequest`.
  - Persist `self_rating_text`, `self_rating` (numeric optional), and `self_comment` for each goal.
  - Idempotent: repeated payload updates `updated_at` only when data actually changes.
- [ ] **2.4 Submission endpoint + summary persistence**
  - `POST /self-assessments/submit` orchestrates validation, scoring, insert/update `self_assessment_summaries`.
  - Respect `evaluation_policy_flags` (force D when `mbo_d_is_fail` & any quantitative entry rated `D`).
  - Return summary DTO defined in `backend/app/schemas/self_assessment_summary.py`.
- [ ] **2.5 RBAC & Supervisor visibility**
  - Add `GET /self-assessments/summary/{periodId}` with optional `userId` query.
  - Guard with `Permission.ASSESSMENT_READ_ALL` (admins) and subordinate checks for supervisors via `RBACHelper`.

## 3. Backend Tests

- [ ] **3.1 Unit tests for scoring**
  - New file `backend/tests/services/test_scoring_service.py`.
  - Cases: direct mapping (SS→7), reverse thresholds, 0% bucket, policy override, failure when master rows missing.
- [ ] **3.2 Integration tests for draft→submit**
  - File: `backend/tests/api/test_self_assessment_summary.py`.
  - Use fixtures replicating spreadsheet examples (Employee 00001 S total 6.0, Employee 00002 D with MBO flag).
- [ ] **3.3 Regression tests for `latest_approved_goals`**
  - Add to `backend/tests/repositories/test_goal_repo.py` verifying only the most recent approved goal per chain is returned.

## 4. Frontend Feature

- [ ] **4.1 Routing & server actions**
  - Add `/self-assessment` route under `frontend/src/app/(evaluation)/(employee)/`.
  - Create `getSelfAssessmentContextAction`, `saveSelfAssessmentDraftAction`, `submitSelfAssessmentAction` hitting new endpoints.
  - Update `routes.ts` + global navigation icon (clipboard-check).
- [ ] **4.2 Feature module scaffolding**
  - Directory `frontend/src/feature/evaluation/employee/self-assessment/` with `display`, `components`, `hooks`, `types`.
  - `SelfAssessmentPage.tsx` orchestrates data load, loading skeleton, empty state when no approved goals.
- [ ] **4.3 Bucket form components**
  - `BucketSection` renders cards per bucket with stage weight chips and list of goals.
  - `RatingRadioGroup` covers SS–D options with keyboard support, disabled when bucket weight=0 or page locked.
  - Comments optional `Textarea` limited to 500 chars, show char count.
- [ ] **4.4 Autosave hook**
  - `useAutosaveDraft` handles debounce, requestId, optimistic timestamp, offline retry.
  - Display `AutosaveToast` component referencing last saved time.
- [ ] **4.5 Summary panel + grade ladder**
  - `AssessmentSummaryPanel` shows per-bucket averages, contributions, total, final rating, fail badge, level delta.
  - `GradeLadder` consumes thresholds array, highlights rung, shows numeric markers from screenshot (SS 6.5 etc.).
  - After successful submit, entire form toggles to read-only and summary uses backend values only.
- [ ] **4.6 i18n & states**
  - Introduce `copy.ts` with `ja`/`en` strings; integrate with existing locale selector.
  - Error handling: display `Callout` when autosave fails, `AlertDialog` on submit failure.

## 5. Frontend Tests & QA

- [ ] **5.1 Component tests**
  - React Testing Library for `BucketSection` (hides 0% buckets) and `GradeLadder` (updates when thresholds change).
- [ ] **5.2 E2E scenario**
  - Playwright spec `tests/e2e/self-assessment.spec.ts` covering draft save, reload, submit, read-only lock.
  - Mock API with MSW to simulate policy flag fail path.
- [ ] **5.3 Accessibility audit**
  - Run `@axe-core/react` assertions ensuring radios, buttons, summary tables meet WCAG (Req-6).

## 6. Operational Readiness

- [ ] **6.1 Logging/metrics**
  - Emit structured log when `flags.fail=true` and push Prometheus counter `self_assessment_submission_total{stage,final_rating}`.
- [ ] **6.2 Runbook update**
  - Document in `docs/operations/self-assessment.md` how HR can update thresholds/policies via SQL.
- [ ] **6.3 Performance verification**
  - Load-test new endpoints with 100 concurrent submissions (Locust or k6) to ensure <500ms p95 backend time.
