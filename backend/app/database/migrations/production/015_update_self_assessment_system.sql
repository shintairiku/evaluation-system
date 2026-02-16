-- Migration: Update Self-Assessment System
-- Adds rating code system, competency granular ratings (rating_data JSONB),
-- 3-state self-assessment (draft/submitted/approved), and supervisor feedback enhancements.
-- Related: GitHub Issue #453

-- ============================================================
-- 1. SELF_ASSESSMENTS TABLE CHANGES
-- ============================================================

-- 1a. Add new columns
ALTER TABLE self_assessments
    ADD COLUMN IF NOT EXISTS self_rating_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS rating_data JSONB;

-- 1b. Drop conflicting constraints from migration 004 and model constraints
ALTER TABLE self_assessments DROP CONSTRAINT IF EXISTS chk_self_rating;
ALTER TABLE self_assessments DROP CONSTRAINT IF EXISTS chk_self_assessment_status;
ALTER TABLE self_assessments DROP CONSTRAINT IF EXISTS check_self_rating_bounds;
ALTER TABLE self_assessments DROP CONSTRAINT IF EXISTS check_status_values;

-- 1c. Backfill legacy data before enforcing new constraints
UPDATE self_assessments
SET self_rating = ROUND((LEAST(GREATEST(self_rating, 0), 100) * 7.0 / 100.0)::numeric, 2)
WHERE self_rating IS NOT NULL;

UPDATE self_assessments
SET status = 'draft'
WHERE status IS NULL
  OR status NOT IN ('draft', 'submitted', 'approved');

UPDATE self_assessments
SET self_rating_code = NULL
WHERE self_rating_code IS NOT NULL
  AND self_rating_code NOT IN ('SS', 'S', 'A', 'B', 'C', 'D');

UPDATE self_assessments
SET submitted_at = COALESCE(submitted_at, updated_at, created_at, NOW())
WHERE status IN ('submitted', 'approved')
  AND submitted_at IS NULL;

-- 1d. Update self_rating scale from 0-100 to 0-7 (auto-calculated from rating_code)
ALTER TABLE self_assessments
    ADD CONSTRAINT chk_self_rating_bounds
    CHECK (self_rating IS NULL OR (self_rating >= 0 AND self_rating <= 7));

-- 1e. Update status CHECK to include 'approved' (3-state system)
ALTER TABLE self_assessments
    ADD CONSTRAINT chk_self_assessment_status
    CHECK (status IN ('draft', 'submitted', 'approved'));

-- 1f. Rating code validation
ALTER TABLE self_assessments
    ADD CONSTRAINT chk_self_rating_code
    CHECK (self_rating_code IS NULL OR self_rating_code IN ('SS', 'S', 'A', 'B', 'C', 'D'));

-- 1g. Submission logic: submitted/approved assessments must have submitted_at
ALTER TABLE self_assessments DROP CONSTRAINT IF EXISTS check_submission_required;
ALTER TABLE self_assessments
    ADD CONSTRAINT chk_self_assessment_submission
    CHECK ((status = 'draft') OR (submitted_at IS NOT NULL));

-- 1h. Index on self_rating_code for filtering
CREATE INDEX IF NOT EXISTS idx_self_assessments_rating_code ON self_assessments(self_rating_code);

-- ============================================================
-- 2. SUPERVISOR_FEEDBACK TABLE CHANGES
-- ============================================================

-- 2a. Add new columns
ALTER TABLE supervisor_feedback
    ADD COLUMN IF NOT EXISTS subordinate_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS supervisor_rating_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS rating_data JSONB,
    ADD COLUMN IF NOT EXISTS action VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 2b. Rename columns: rating → supervisor_rating, comment → supervisor_comment
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'supervisor_feedback'
          AND column_name = 'rating'
    ) THEN
        ALTER TABLE supervisor_feedback RENAME COLUMN rating TO supervisor_rating;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'supervisor_feedback'
          AND column_name = 'comment'
    ) THEN
        ALTER TABLE supervisor_feedback RENAME COLUMN comment TO supervisor_comment;
    END IF;
END $$;

-- 2c. Drop conflicting constraints from migration 004 and model constraints
ALTER TABLE supervisor_feedback DROP CONSTRAINT IF EXISTS chk_supervisor_rating;
ALTER TABLE supervisor_feedback DROP CONSTRAINT IF EXISTS chk_supervisor_feedback_status;
ALTER TABLE supervisor_feedback DROP CONSTRAINT IF EXISTS check_feedback_rating_bounds;
ALTER TABLE supervisor_feedback DROP CONSTRAINT IF EXISTS check_feedback_status_values;

-- 2d. Backfill legacy data before enforcing new constraints
UPDATE supervisor_feedback sf
SET subordinate_id = g.user_id
FROM self_assessments sa
JOIN goals g ON g.id = sa.goal_id
WHERE sf.self_assessment_id = sa.id
  AND sf.subordinate_id IS NULL;

UPDATE supervisor_feedback
SET supervisor_rating = ROUND((LEAST(GREATEST(supervisor_rating, 0), 100) * 7.0 / 100.0)::numeric, 2)
WHERE supervisor_rating IS NOT NULL;

UPDATE supervisor_feedback
SET status = 'draft'
WHERE status IS NULL
  OR status NOT IN ('incomplete', 'draft', 'submitted');

UPDATE supervisor_feedback
SET action = 'PENDING'
WHERE action IS NULL
  OR action NOT IN ('PENDING', 'APPROVED');

UPDATE supervisor_feedback
SET supervisor_rating_code = NULL
WHERE supervisor_rating_code IS NOT NULL
  AND supervisor_rating_code NOT IN ('SS', 'S', 'A', 'B', 'C', 'D');

UPDATE supervisor_feedback
SET submitted_at = COALESCE(submitted_at, updated_at, created_at, NOW())
WHERE status = 'submitted'
  AND submitted_at IS NULL;

UPDATE supervisor_feedback
SET reviewed_at = COALESCE(reviewed_at, submitted_at, updated_at, created_at, NOW())
WHERE action = 'APPROVED'
  AND reviewed_at IS NULL;

-- 2e. Update supervisor_rating scale from 0-100 to 0-7
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_feedback_rating_bounds
    CHECK (supervisor_rating IS NULL OR (supervisor_rating >= 0 AND supervisor_rating <= 7));

-- 2f. Update status CHECK to include 'incomplete'
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_feedback_status
    CHECK (status IN ('incomplete', 'draft', 'submitted'));

-- 2g. Rating code validation
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_rating_code
    CHECK (supervisor_rating_code IS NULL OR supervisor_rating_code IN ('SS', 'S', 'A', 'B', 'C', 'D'));

-- 2h. Action validation (PENDING or APPROVED only, no REJECTED)
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_feedback_action
    CHECK (action IN ('PENDING', 'APPROVED'));

-- 2i. Submission logic update
ALTER TABLE supervisor_feedback DROP CONSTRAINT IF EXISTS check_feedback_submission_required;
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_feedback_submission
    CHECK ((status != 'submitted') OR (submitted_at IS NOT NULL));

-- 2j. Approval logic: APPROVED must have reviewed_at
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_feedback_approval
    CHECK ((action != 'APPROVED') OR (reviewed_at IS NOT NULL));

-- 2k. Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_subordinate ON supervisor_feedback(subordinate_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_action ON supervisor_feedback(action);
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_rating_code ON supervisor_feedback(supervisor_rating_code);
