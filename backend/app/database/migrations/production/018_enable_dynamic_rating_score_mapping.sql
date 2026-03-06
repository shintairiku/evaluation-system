-- Migration: Enable dynamic organization score mappings for rating codes
-- Purpose:
-- - Support organization-specific numeric score mappings (e.g. SS=7.5)
-- - Remove hard dependency on fixed 0-7 score ceiling in assessment tables
-- - Recompute persisted numeric scores from evaluation_score_mapping

-- ============================================================
-- 1. Ensure evaluation_score_mapping table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_score_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating_code TEXT NOT NULL,
    rating_label TEXT NULL,
    score_value NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_evaluation_score_mapping_org_code'
    ) THEN
        ALTER TABLE evaluation_score_mapping
            ADD CONSTRAINT uq_evaluation_score_mapping_org_code
            UNIQUE (organization_id, rating_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evaluation_score_mapping_org
    ON evaluation_score_mapping(organization_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_score_mapping_org_active
    ON evaluation_score_mapping(organization_id, is_active);

-- ============================================================
-- 2. Seed default code mappings for each organization (idempotent)
-- ============================================================
INSERT INTO evaluation_score_mapping (
    organization_id,
    rating_code,
    rating_label,
    score_value,
    is_active,
    created_at,
    updated_at
)
SELECT
    o.id,
    m.rating_code,
    m.rating_label,
    m.score_value,
    TRUE,
    NOW(),
    NOW()
FROM organizations o
CROSS JOIN (
    VALUES
        ('SS', 'SS', 7.0::numeric),
        ('S',  'S',  6.0::numeric),
        ('A',  'A',  5.0::numeric),
        ('B',  'B',  4.0::numeric),
        ('C',  'C',  3.0::numeric),
        ('D',  'D',  2.0::numeric)
) AS m(rating_code, rating_label, score_value)
ON CONFLICT (organization_id, rating_code) DO NOTHING;

-- ============================================================
-- 3. Expand score bounds to 0-100
-- ============================================================
ALTER TABLE self_assessments
    DROP CONSTRAINT IF EXISTS chk_self_rating_bounds;
ALTER TABLE self_assessments
    ADD CONSTRAINT chk_self_rating_bounds
    CHECK (self_rating IS NULL OR (self_rating >= 0 AND self_rating <= 100));

ALTER TABLE supervisor_feedback
    DROP CONSTRAINT IF EXISTS chk_supervisor_feedback_rating_bounds;
ALTER TABLE supervisor_feedback
    ADD CONSTRAINT chk_supervisor_feedback_rating_bounds
    CHECK (supervisor_rating IS NULL OR (supervisor_rating >= 0 AND supervisor_rating <= 100));

-- ============================================================
-- 4. Repair persisted numeric values from org mappings
-- ============================================================
UPDATE self_assessments sa
SET self_rating = esm.score_value
FROM goals g
JOIN users u ON u.id = g.user_id
JOIN evaluation_score_mapping esm
    ON esm.organization_id = u.clerk_organization_id
   AND esm.is_active = TRUE
WHERE sa.goal_id = g.id
  AND sa.self_rating_code IS NOT NULL
  AND esm.rating_code = sa.self_rating_code
  AND sa.self_rating IS DISTINCT FROM esm.score_value;

UPDATE supervisor_feedback sf
SET supervisor_rating = esm.score_value
FROM self_assessments sa
JOIN goals g ON g.id = sa.goal_id
JOIN users u ON u.id = g.user_id
JOIN evaluation_score_mapping esm
    ON esm.organization_id = u.clerk_organization_id
   AND esm.is_active = TRUE
WHERE sf.self_assessment_id = sa.id
  AND sf.supervisor_rating_code IS NOT NULL
  AND esm.rating_code = sf.supervisor_rating_code
  AND sf.supervisor_rating IS DISTINCT FROM esm.score_value;
