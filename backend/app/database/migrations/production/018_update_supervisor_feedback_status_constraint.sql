-- Migration: Update supervisor_feedback status constraint for goal-like workflow
-- Date: 2025-02-10

ALTER TABLE supervisor_feedback
  DROP CONSTRAINT IF EXISTS chk_supervisor_feedback_status;

ALTER TABLE supervisor_feedback
  DROP CONSTRAINT IF EXISTS check_feedback_status_values;

ALTER TABLE supervisor_feedback
  ADD CONSTRAINT chk_supervisor_feedback_status
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
