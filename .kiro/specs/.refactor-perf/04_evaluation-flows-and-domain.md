# Evaluation Flows & Domain – Performance Refactor

## 1. Current State (High-Level)

- Evaluation flows (goals, self-assessments, supervisor reviews, dashboards) are spread across multiple services and pages.
- Existing goal/evaluation endpoints already support batching (embedded reviews, rejection history), but flows still make several calls end-to-end.
- A new evaluation spec (`.kiro/specs/evaluation/requirements.md` in the IDE context) defines a richer domain model (grades, score mappings, versioned masters).

## 2. Main Problems / Bottlenecks (To Detail)

- Goal/evaluation UIs often fetch data in multiple steps instead of a single “evaluation summary” call.
- There is no unified evaluation record per `(org × period × evaluatee)`; data is scattered across goals, self-assessments, feedback, etc.
- Aggregation for dashboards (admin/supervisor/employee) recomputes similar statistics for each request.

## 3. Goals

- Design evaluation endpoints around “evaluation session” and “evaluation summary” shapes, not raw tables.
- Minimize the number of round-trips needed for a typical evaluation flow (setting goals, self-assessment, supervisor review, 360/core value).
- Make it easy to compute org/department-level aggregates without scanning large raw tables each time.

## 4. Proposed Direction (Outline)

- Introduce a unified evaluation domain model aligned with the new spec:
  - Versioned grade/score mappings per org.
  - Evaluation records that store frozen grade + score + master version at evaluation time.
- Design dedicated endpoints:
  - `GET evaluation-session` for a user/period (goals + assessments + supervisor reviews + 360).
  - `GET evaluation-summary` for dashboards (per user, per department, per org).
- Introduce an `EvaluationAggregateService` on the backend responsible for:
  - Building the full “evaluation session” view in one pass using existing repositories (goals, self-assessments, supervisor reviews, etc.).
  - Keeping aggregation logic out of individual services like `GoalService` so endpoints can reuse a single, optimized aggregation path.
- Add appropriate indexes and, where needed, materialized summaries for heavy aggregation paths.

## 5. Open Questions

- How much of the legacy goal/evaluation API do we need to keep backward compatible?
- Where do we draw the line between “online” aggregation vs precomputed summaries?
- Which evaluation KPIs are most important to optimize first (for both UX and analytics)?
