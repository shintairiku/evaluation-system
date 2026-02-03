-- Migration: Drop legacy columns from self_assessments and supervisor_feedback
-- These columns are not used in the new self-assessment system design.

-- 1. self_assessments: drop legacy columns
ALTER TABLE self_assessments
    DROP COLUMN IF EXISTS self_rating_text,
    DROP COLUMN IF EXISTS previous_self_assessment_id;

-- 2. supervisor_feedback: drop legacy columns
ALTER TABLE supervisor_feedback
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS bucket_decisions,
    DROP COLUMN IF EXISTS previous_feedback_id;
