-- Migration: Track self-assessment rejection chains
-- Date: 2025-02-10

ALTER TABLE self_assessments
  ADD COLUMN IF NOT EXISTS previous_self_assessment_id UUID REFERENCES self_assessments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_self_assessments_previous_self_assessment_id
  ON self_assessments(previous_self_assessment_id);

-- Allow multiple assessments per goal by dropping the old unique index
DROP INDEX IF EXISTS idx_self_assessments_goal_unique;
