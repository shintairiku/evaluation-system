# Task: Backend Services & APIs for Self-Assessment Scoring

## Overview
Extend the FastAPI backend so self-assessment flows become fully data-driven: autosave drafts, compute weighted totals using stage-specific data, enforce policy flags, and expose submission summaries.

## Objectives
- Introduce a dedicated `ScoringService` that reads the new masters and applies stage weights, policies, and grade thresholds.
- Enhance `SelfAssessmentService` to orchestrate draft persistence, submission validation, and summary storage.
- Expose REST endpoints that power the new frontend (`/current`, `/draft`, `/submit`, `/summary/{periodId}`) while preserving RBAC rules.

## Deliverables
1. **Repositories & Services**
   - `ScoreMappingRepository` for rating masters/thresholds/policies.
   - `ScoringService` with helpers: `get_score_for_rating`, `compute_bucket_average`, `apply_stage_weights`, `map_numeric_to_grade`, `evaluate_policy_flags`, `attach_level_preview`.
   - Integrate `ScoringService` into `SelfAssessmentService` (lazy init) and extend methods: context builder, draft upsert, submit summary writer.
2. **API Layer**
   - Update `backend/app/api/v1/self_assessments.py` with new routes:
     - `GET /self-assessments/current` → current user payload (goals, draft, stage weights, thresholds, summary).
     - `POST /self-assessments/draft` → idempotent autosave endpoint.
     - `POST /self-assessments/submit` → compute + persist summary, return response DTO.
     - `GET /self-assessments/summary/{periodId}` → admin/supervisor visibility (supports `userId` filter) respecting RBAC.
   - Schemas: create `self_assessment_summary.py` defining request/response models.
3. **Validation & Error Handling**
   - Enforce: buckets with `weight > 0` must have ratings; masters missing rows raise `BadRequestError`.
   - Policy handling: e.g., `mbo_d_is_fail` sets `flags.fail` and forces final rating to `D`.
4. **Tests**
   - Unit tests (`tests/services/test_scoring_service.py`) covering numeric mapping, grade lookup, zero-weight buckets, policy override.
   - Integration tests (`tests/api/test_self_assessment_summary.py`) for draft→submit flow using spreadsheet-like fixtures.
   - Repository test ensuring `latest_approved_goals` view is honored.

## Acceptance Criteria
- All new endpoints return data structured per the spec and are gated by existing permissions.
- Submission flow persists summaries and marks assessments submitted without breaking the supervisor feedback trigger.
- `pytest` suite passes, including the newly added service and API tests.
- Logs clearly capture failures when required masters are missing or policy flags trigger.
