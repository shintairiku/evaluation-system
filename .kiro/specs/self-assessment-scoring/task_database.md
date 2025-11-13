# Task: Database Foundations for Self-Assessment Scoring

## Overview
Create the foundation that enables per-organization, data-driven scoring. This task introduces all necessary tables, seeds, and views so backend services can consume rating masters, policies, and summaries without hardcoded values.

## Objectives
- Provide normalized masters (`evaluation_score_mapping`, `rating_thresholds`, `evaluation_policy_flags`, `level_adjustment_master`) scoped by `organization_id`.
- Persist final submission snapshots in `self_assessment_summaries` for auditing and read-only UI states.
- Ensure employees only rate the latest approved goals through a database view.

## Deliverables
1. **Migration 0xx**
   - Tables listed above with:
     - `organization_id` FK → `organizations.id`.
     - Composite unique keys (e.g., `(organization_id, rating_code)`).
     - Updated/created timestamps and indexes on `organization_id`.
   - Seed data:
     - Rating codes SS..D with numeric values per organization default.
     - Threshold cutoffs (SS ≥ 6.5 ... D < 1.0).
     - Optional policy + level masters using spreadsheet defaults.
2. **`self_assessments` alteration**
   - Add `self_rating_text` (TEXT, nullable) to capture SS..D for each goal.
3. **`self_assessment_summaries` table**
   - Columns: `organization_id`, `user_id`, `period_id`, `stage_id`, `stage_weights` JSONB, `per_bucket` JSONB, `weighted_total`, `final_rating_code`, `flags`, `level_adjustment_preview`, `submitted_at`, timestamps.
   - Unique index `(organization_id, user_id, period_id)`.
4. **`latest_approved_goals` view**
   - Recursive CTE selecting the most recent `approved` goal per `(user_id, period_id, goal_category)`.
   - Apply `ALTER VIEW ... OWNER` so Supabase grants stay consistent.
5. **Documentation snippet**
   - Update `docs/operations/self-assessment.md` (or create placeholder) explaining how to edit masters via SQL.

## Acceptance Criteria
- Running migrations on a fresh DB results in the new tables populated with seed rows without violating constraints.
- Existing data remains intact; `self_assessments` rows show `self_rating_text = NULL` until users edit drafts.
- Querying `SELECT * FROM latest_approved_goals` per organization returns only the newest approved version.
- Insertion tests confirm that each organization can maintain independent mappings without collisions.
