# Requirements Document: DB-Driven Evaluation Scoring & Self-Assessment UI

## 1. Overview
This initiative grounds the evaluation workflow in data that already exists in our FastAPI + Next.js stack. GitHub issue [#355](https://github.com/shintairiku/evaluation-system/issues/355) captures the outcomes of the latest HR workshop and the spreadsheet (`20251104総合表レポート.xlsx`) shown in the provided screenshots (rating ladders, MBO D flag, promotion/demotion notes). However, none of those assumptions are wired into our current implementation:

- The `self_assessments` table stores only a raw `self_rating` (0–100) per goal; there is no DB master for textual ratings (SS…D) or their numeric equivalents.
- Stage weights live in the `stages` table (`quantitative_weight`, `qualitative_weight`, `competency_weight` from migration 010) but today nothing consumes them when employees submit self-assessments.
- Frontend screens such as `PerformanceGoalsEvaluate.tsx` are mock data; there is no `/self-assessment` route, summary ladder, or autosave.

This document defines **what** needs to be built so that the spreadsheet rules and meeting decisions surface inside the product, using the existing repositories (`SelfAssessmentRepository`, `StageRepository`, `GoalRepository`, etc.).

## 2. Requirements List

### Requirement 1: Persist Rating Masters & Thresholds in the Database

**User Story:**
> As an HR administrator, I want rating labels (SS–D), their numeric scores, and grade thresholds to live in our DB so that backend services can calculate the same totals as the spreadsheet without hardcoding values.

**Acceptance Criteria:**
```gherkin
GIVEN the migration seeds `evaluation_score_mapping` with SS=7, S=6, A+=5, A=4, A-=3, B=2, C=1, D=0
AND `rating_thresholds` with the spreadsheet bands (SS ≥ 6.5, S ≥ 5.5, A+ ≥ 4.5, A ≥ 3.7, A- ≥ 2.7, B ≥ 1.7, C ≥ 1.0, else D)
WHEN the API asks for the score behind "A-"
THEN the repository returns 3.0 from the DB (never a constant in code)

GIVEN the thresholds table is updated in SQL (e.g., HR tweaks SS to 6.7)
WHEN `map_numeric_to_grade(total_score)` runs
THEN it reflects the new cutoff without a redeploy

WHEN either table is missing required rows
THEN the backend must return a 500 with a clear error (`"rating_thresholds empty"`) instead of defaulting
```

### Requirement 2: Weighted Scoring Engine that Honors Stage Buckets

**User Story:**
> As an employee, I want my total score to be calculated using the stage weights stored in the `stages` table so that self-assessment totals match HR policy (e.g., Stage6 qualitative weight = 0%).

**Acceptance Criteria:**
```gherkin
GIVEN a user assigned to Stage5 with weights 80/20/10 (quantitative/qualitative/competency)
AND goals exist only for the first two buckets
WHEN the user submits self-assessments
THEN the backend computes per-bucket averages, multiplies by weight/100, and ignores the competency bucket because its weight is >0 but there are no items (contribution 0)

GIVEN Stage6 has a qualitative_weight of 0
WHEN the frontend renders `/self-assessment`
THEN qualitative inputs are hidden and the form validation does not require them

GIVEN weights are edited via `StageService.update_stage_weights`
WHEN a user fetches the self-assessment draft afterwards
THEN the stage weights in the payload match the DB (no cached constants)
```

### Requirement 3: Latest Approved Goals Only & Draft Autosave

**User Story:**
> As an employee filling out the new Self-Assessment UI, I only want to rate goals that were approved (latest version) and I want autosave to protect my input.

**Acceptance Criteria:**
```gherkin
GIVEN a goal chain created via `previous_goal_id` (002 > 003 > 004)
AND only goal 004 has status `approved`
WHEN the backend builds the self-assessment payload
THEN only goal 004 appears, even if earlier drafts still exist

WHEN the user edits the quantitative rating and pauses for 1s
THEN the UI sends a draft POST (/self-assessments) with a requestId
AND if the server responds after a newer autosave was sent, the stale response is ignored (no regress of UI state)

GIVEN the user reloads `/self-assessment`
WHEN a draft exists
THEN the ratings/comments they previously entered rehydrate from the draft payload
```

### Requirement 4: Submission Summary, Grade Ladder & Read-Only Lock

**User Story:**
> As an employee, after submitting I want a read-only summary that shows per-bucket contributions, total score, final grade ladder, and any fail/promote flags so that I understand the outcome.

**Acceptance Criteria:**
```gherkin
GIVEN the user hits Submit
WHEN all required buckets (weight > 0) contain ratings from SS–D
THEN the backend returns:
  - `stage_weights`
  - `per_bucket` array (bucket, weight, avg_score, contribution)
  - `weighted_total`
  - `final_rating`
  - `flags.fail` (bool) + notes array
  - optional `level_adjustment_preview`
AND the frontend stores this summary and switches components to read-only state

GIVEN the summary sets `final_rating = "S"`, `weighted_total = 6.0`
WHEN the grade ladder renders
THEN the "S" rung is highlighted, SS shown as 6.5 threshold, etc., sourced from `rating_thresholds`

GIVEN the backend sets `flags.fail = true`
WHEN the user revisits `/self-assessment`
THEN a prominent badge explains the fail reason (e.g., "MBO has D rating")
```

### Requirement 5: Policy Flags & Level Adjustment Preview

**User Story:**
> As HR, I need optional policies like “if any MBO is D, final grade becomes D and stage-down flag = true” and a level delta preview (+8 for S, −8 for D) because the spreadsheet drives promotion/demotion discussions.

**Acceptance Criteria:**
```gherkin
GIVEN `evaluation_policy_flags` contains `{ key: "mbo_d_is_fail", value: { "enabled": true } }`
AND a quantitative (MBO) item is rated D
WHEN totals are computed
THEN `flags.fail = true`, `flags.notes` includes "MBO rating D", and `final_rating` is forced to D even if the numeric total is >1.0

GIVEN `level_adjustment_master` sets `S => +8`, `D => -8`
WHEN the summary is returned
THEN `level_adjustment_preview` = { rating: "S", delta: 8 }
AND the frontend shows the delta near the ladder, matching the spreadsheet column “レベル増減”

GIVEN the policy toggle is disabled in DB
WHEN all MBO ratings are >= C
THEN no fail flag is emitted
```

### Requirement 6: Performance, Accessibility & Internationalization

**User Story:**
> As a team maintaining this feature, I want it to be fast, accessible, and bilingual (JP/EN) so that it feels native to the rest of the product.

**Acceptance Criteria:**
```gherkin
WHEN an employee with 60 goals opens `/self-assessment`
THEN the page renders interactive content (form skeletons) within 1.5s (95th percentile) and final data within 3s

WHEN autosave fails due to network issues
THEN the UI shows a toast with retry rather than silently losing data

WHEN the ladder, form labels, and validation errors render
THEN text is available in both Japanese and English using the existing i18n pattern (same approach as other evaluation screens)

WHEN navigating via keyboard
THEN radio groups (SS–D) and submit buttons are reachable and have visible focus states (Tailwind + shadcn conventions)
```
