# Requirements Document: DB-Driven Evaluation Scoring & Self-Assessment UI

## 1. Overview
This initiative grounds the evaluation workflow in data that already exists in our FastAPI + Next.js stack. GitHub issue [#355](https://github.com/shintairiku/evaluation-system/issues/355) summarizes the latest HR workshop plus the spreadsheet (`20251104_summary_report.xlsx`) captured in the shared screenshots (rating ladders, MBO D flag, promotion/demotion notes). Today none of those rules are wired into the product:

- The `self_assessments` table only stores a raw `self_rating` (0–100) per goal; there is no database master for textual ratings (SS…D) or their numeric equivalents.
- Stage weights live in the `stages` table (`quantitative_weight`, `qualitative_weight`, `competency_weight` from migration 010) but the self-assessment flow never reads them.
- Frontend screens such as `PerformanceGoalsEvaluate.tsx` are mock data; there is no `/self-assessment` route, summary ladder, or autosave tied to the backend.

This document defines **what** must be built so the spreadsheet rules and meeting decisions appear inside the application using existing repositories (`SelfAssessmentRepository`, `StageRepository`, `GoalRepository`, etc.).

## 2. Requirements

### Requirement 1 — Persist Rating Masters & Thresholds

**User Story:**
> As an HR administrator, I want rating labels (SS–D), their numeric scores, and grade thresholds in the database so backend services can match spreadsheet totals without hardcoding values.

**Acceptance Criteria:**
```gherkin
GIVEN migrations seed `evaluation_score_mapping` with SS=7, S=6, A+=5, A=4, A-=3, B=2, C=1, D=0
AND every row carries `organization_id` (FK → `organizations.id`) so each tenant maintains its own mapping
AND `rating_thresholds` with the spreadsheet bands (SS ≥ 6.5, S ≥ 5.5, A+ ≥ 4.5, A ≥ 3.7, A- ≥ 2.7, B ≥ 1.7, C ≥ 1.0, else D) scoped by `organization_id`
WHEN the API requests the score for "A-"
THEN the repository returns 3.0 from the DB (never a constant in code)

GIVEN HR updates any threshold directly in SQL
WHEN `map_numeric_to_grade(total_score)` runs
THEN the new cutoff is applied without redeploying

WHEN either table is missing required rows
THEN the backend responds with a 500 and a clear error (e.g., "rating_thresholds empty") instead of defaulting
```

### Requirement 2 — Stage-Aware Weighted Scoring

**User Story:**
> As an employee, I want my total score calculated with the stage weights stored in `stages` so that self-assessment totals follow HR policy (e.g., Stage 6 qualitative weight = 0%).

**Acceptance Criteria:**
```gherkin
GIVEN a user assigned to Stage 5 with weights 80/20/10 (quantitative/qualitative/competency)
AND goals exist only for the first two buckets
WHEN the user submits self-assessments
THEN the backend computes per-bucket averages, multiplies by weight/100, and leaves the competency bucket at contribution 0

GIVEN Stage 6 has `qualitative_weight = 0`
WHEN the frontend renders `/self-assessment`
THEN qualitative inputs are hidden and validation does not require them

GIVEN weights are updated through `StageService.update_stage_weights`
WHEN the user fetches a draft afterwards
THEN the stage weights in the payload match the latest DB values (no cached constants)
```

### Requirement 3 — Latest Approved Goals & Draft Autosave

**User Story:**
> As an employee completing the new Self-Assessment UI, I only want to rate the latest approved goals and I want autosave to protect my input.

**Acceptance Criteria:**
```gherkin
GIVEN a goal chain via `previous_goal_id` (002 → 003 → 004)
AND only goal 004 is `approved`
WHEN the backend builds the self-assessment payload
THEN only goal 004 appears even if earlier drafts exist

WHEN the user edits a quantitative rating and pauses for ~1s
THEN the UI sends `/self-assessments/draft` with a requestId
AND stale responses arriving after a newer autosave are ignored (UI state never regresses)

GIVEN a draft exists
WHEN the user reloads `/self-assessment`
THEN previously entered ratings/comments rehydrate from the draft payload
```

### Requirement 4 — Submission Summary, Grade Ladder & Read-Only Lock

**User Story:**
> As an employee, after submitting I want a read-only summary showing per-bucket contributions, total score, grade ladder, and fail/promote flags so I understand the outcome.

**Acceptance Criteria:**
```gherkin
GIVEN the user clicks Submit
WHEN all buckets with weight > 0 contain SS–D ratings
THEN the backend returns
  - `stage_weights`
  - `per_bucket` array (bucket, weight, avg_score, contribution)
  - `weighted_total`
  - `final_rating`
  - `flags.fail` (bool) with `notes[]`
  - optional `level_adjustment_preview`
AND the frontend stores the summary and locks the form in read-only mode

GIVEN `final_rating = "S"` and `weighted_total = 6.0`
WHEN the grade ladder renders
THEN the "S" rung is highlighted, SS shows 6.5 as its cutoff, etc., sourced from `rating_thresholds`

GIVEN `flags.fail = true`
WHEN the user revisits `/self-assessment`
THEN a prominent badge explains the fail reason (e.g., "MBO rating D")
```

### Requirement 5 — Policy Flags & Level Adjustment Preview

**User Story:**
> As HR, I need optional policies like “if any MBO is D, final grade becomes D and a stage-down flag appears” plus a level-delta preview (e.g., +8 for S, −8 for D) because those fields drive promotion/demotion reviews.

**Acceptance Criteria:**
```gherkin
GIVEN `evaluation_policy_flags` contains `{ key: "mbo_d_is_fail", value: { "enabled": true } }`
AND a quantitative (MBO) item is rated D
WHEN totals are computed
THEN `flags.fail = true`, `flags.notes` includes "MBO rating D", and `final_rating` is forced to D even if the numeric total exceeds 1.0

GIVEN `level_adjustment_master` maps `S => +8`, `D => -8`
WHEN the submission summary is returned
THEN `level_adjustment_preview = { rating: "S", delta: 8 }`
AND the frontend displays the delta near the ladder (matching the spreadsheet "Level Delta" column)

GIVEN the policy toggle is disabled
WHEN every MBO rating is ≥ C
THEN no fail flag is emitted
```

### Requirement 6 — Performance, Accessibility & Internationalization

**User Story:**
> As the team maintaining this feature, I want it to be fast, accessible, and bilingual (JP/EN) so it feels native to the rest of the product.

**Acceptance Criteria:**
```gherkin
WHEN an employee with 60 goals opens `/self-assessment`
THEN the page renders interactive content (skeletons) within 1.5s p95 and final data within 3s

WHEN autosave fails because of a network issue
THEN the UI shows a toast with retry instead of silently discarding data

WHEN ladder labels, form text, and validation errors render
THEN each has Japanese and English strings following the existing i18n pattern

WHEN navigating via keyboard
THEN radio groups (SS–D) and submit buttons are reachable and have visible focus states (Tailwind + shadcn conventions)
```
