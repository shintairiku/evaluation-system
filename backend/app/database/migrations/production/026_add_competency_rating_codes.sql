-- Migration: Add A+ and A- rating codes for competency evaluations (7-level scale)
-- Competency now uses: SS, S, A+, A, A-, B, C (was: SS, S, A, B, C)

-- Update self_assessments CHECK constraint
ALTER TABLE self_assessments DROP CONSTRAINT IF EXISTS chk_self_rating_code;
ALTER TABLE self_assessments ADD CONSTRAINT chk_self_rating_code
  CHECK (self_rating_code IS NULL OR self_rating_code IN ('SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D'));

-- Update supervisor_feedback CHECK constraint
ALTER TABLE supervisor_feedback DROP CONSTRAINT IF EXISTS chk_supervisor_rating_code;
ALTER TABLE supervisor_feedback ADD CONSTRAINT chk_supervisor_rating_code
  CHECK (supervisor_rating_code IS NULL OR supervisor_rating_code IN ('SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D'));
