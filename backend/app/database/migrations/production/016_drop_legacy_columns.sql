-- Migration: Drop legacy columns from self_assessments and supervisor_feedback
-- These columns are not used in the new self-assessment system design.

-- 1. self_assessments: drop legacy columns
ALTER TABLE self_assessments
    DROP COLUMN IF EXISTS self_rating_text,
    DROP COLUMN IF EXISTS previous_self_assessment_id;

-- 2. supervisor_feedback: backfill legacy user_id to subordinate_id before drop
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'supervisor_feedback'
          AND column_name = 'user_id'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'supervisor_feedback'
          AND column_name = 'subordinate_id'
    ) THEN
        EXECUTE '
            UPDATE supervisor_feedback
            SET subordinate_id = COALESCE(subordinate_id, user_id)
            WHERE user_id IS NOT NULL
        ';
    END IF;
END $$;

-- 2. supervisor_feedback: drop legacy columns
ALTER TABLE supervisor_feedback
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS bucket_decisions,
    DROP COLUMN IF EXISTS previous_feedback_id;
