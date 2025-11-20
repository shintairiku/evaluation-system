-- Migration: Add bucket_decisions support to supervisor_feedback table
-- Description: Adds user_id and bucket_decisions JSONB column to support new bucket-based approval workflow
-- Date: 2025-01-20

-- Add new columns for bucket-based feedback
ALTER TABLE supervisor_feedback
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bucket_decisions JSONB DEFAULT '[]'::jsonb;

-- Make old columns nullable for backward compatibility
ALTER TABLE supervisor_feedback
  ALTER COLUMN self_assessment_id DROP NOT NULL;

-- Create unique index for new model (one feedback per user/period/supervisor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisor_feedback_user_period_unique
  ON supervisor_feedback(user_id, period_id, supervisor_id)
  WHERE user_id IS NOT NULL;

-- Create index for queries by user_id
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_user_id
  ON supervisor_feedback(user_id)
  WHERE user_id IS NOT NULL;

-- Add comment explaining the dual model support
COMMENT ON COLUMN supervisor_feedback.user_id IS 'New model: FK to employee user (one feedback per user/period). Mutually exclusive with self_assessment_id.';
COMMENT ON COLUMN supervisor_feedback.self_assessment_id IS 'Legacy model: FK to individual self_assessment (one feedback per goal). Deprecated in favor of user_id.';
COMMENT ON COLUMN supervisor_feedback.bucket_decisions IS 'New model: JSONB array of bucket-based decisions [{bucket, employeeWeight, employeeContribution, employeeRating, status, supervisorRating, comment}]. Used when user_id is set.';
COMMENT ON COLUMN supervisor_feedback.rating IS 'Legacy model: Global rating (0-100). Used when self_assessment_id is set. Nullable for new model.';
COMMENT ON COLUMN supervisor_feedback.comment IS 'Legacy model: Global comment. Used when self_assessment_id is set. In new model, comments are per-bucket in bucket_decisions.';
