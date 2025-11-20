-- Migration: Add previous_feedback_id to supervisor_feedback for goal-like workflow
-- Description: Enables chaining of supervisor feedback records when a review is rejected
-- Date: 2025-02-10

-- Add previous_feedback_id column referencing supervisor_feedback itself
ALTER TABLE supervisor_feedback
  ADD COLUMN IF NOT EXISTS previous_feedback_id UUID REFERENCES supervisor_feedback(id) ON DELETE SET NULL;

-- Create index to speed up chain lookups
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_previous_feedback_id
  ON supervisor_feedback(previous_feedback_id);

-- Drop old uniqueness constraint (one feedback per user/period/supervisor)
DROP INDEX IF EXISTS idx_supervisor_feedback_user_period_unique;

-- Update status constraint to allow approved/rejected states
ALTER TABLE supervisor_feedback
  DROP CONSTRAINT IF EXISTS check_feedback_status_values;

ALTER TABLE supervisor_feedback
  ADD CONSTRAINT check_feedback_status_values
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
