-- Migration: Add previous_goal_id to goals table for rejection history tracking
-- This enables tracking the chain of goal resubmissions when a goal is rejected

-- Add previous_goal_id column (nullable, references another goal)
ALTER TABLE goals
ADD COLUMN previous_goal_id UUID REFERENCES goals(id);

-- Add index for performance when querying goal history
CREATE INDEX idx_goals_previous_goal_id ON goals(previous_goal_id);

-- Add comment for documentation
COMMENT ON COLUMN goals.previous_goal_id IS 'References the previous goal when this goal is created from a rejected goal. Used to track resubmission history and display supervisor feedback.';
