-- 013_evaluation_scoring_tables.sql
-- Introduces DB-driven scoring masters, policy flags, level deltas, submission summaries,
-- and a view for selecting the latest approved goal per chain.

-- Ensure pgcrypto is available for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Rating master: SS..D mapped to numeric scores per organization
CREATE TABLE evaluation_score_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating_code TEXT NOT NULL,
    rating_label TEXT,
    score_value DECIMAL(3,1) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evaluation_score_mapping_org_code UNIQUE (organization_id, rating_code)
);
CREATE INDEX idx_evaluation_score_mapping_org ON evaluation_score_mapping (organization_id);

-- Grade thresholds per organization
CREATE TABLE rating_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating_code TEXT NOT NULL,
    min_score DECIMAL(3,2) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rating_thresholds_org_code UNIQUE (organization_id, rating_code),
    CONSTRAINT fk_rating_thresholds_mapping FOREIGN KEY (organization_id, rating_code)
        REFERENCES evaluation_score_mapping(organization_id, rating_code)
        ON DELETE CASCADE
);
CREATE INDEX idx_rating_thresholds_org_min_score ON rating_thresholds (organization_id, min_score DESC);

-- Policy flags (JSONB) per organization, e.g., mbo_d_is_fail
CREATE TABLE evaluation_policy_flags (
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_evaluation_policy_flags PRIMARY KEY (organization_id, key)
);
CREATE INDEX idx_evaluation_policy_flags_org ON evaluation_policy_flags (organization_id);

-- Level adjustment master per organization
CREATE TABLE level_adjustment_master (
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating_code TEXT NOT NULL,
    level_delta INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_level_adjustment_master PRIMARY KEY (organization_id, rating_code),
    CONSTRAINT fk_level_adjustment_mapping FOREIGN KEY (organization_id, rating_code)
        REFERENCES evaluation_score_mapping(organization_id, rating_code)
        ON DELETE CASCADE
);
CREATE INDEX idx_level_adjustment_master_org ON level_adjustment_master (organization_id);

-- Summary snapshot for submitted self-assessments
CREATE TABLE self_assessment_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
    stage_weights JSONB NOT NULL,
    per_bucket JSONB NOT NULL,
    weighted_total DECIMAL(4,2) NOT NULL,
    final_rating_code TEXT NOT NULL,
    flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    level_adjustment_preview JSONB,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_self_assessment_summaries_org_user_period UNIQUE (organization_id, user_id, period_id)
);
CREATE INDEX idx_self_assessment_summaries_org ON self_assessment_summaries (organization_id);
CREATE INDEX idx_self_assessment_summaries_period ON self_assessment_summaries (period_id);

-- Extend self_assessments to store SS..D textual rating alongside numeric value
ALTER TABLE self_assessments
    ADD COLUMN IF NOT EXISTS self_rating_text TEXT;

-- View to select the latest approved goal per chain (per user, period, goal category, organization)
CREATE OR REPLACE VIEW latest_approved_goals AS
WITH ranked_goals AS (
    SELECT
        g.*,
        u.clerk_organization_id AS organization_id,
        ROW_NUMBER() OVER (
            PARTITION BY g.user_id, g.period_id, g.goal_category
            ORDER BY g.created_at DESC
        ) AS rn
    FROM goals g
    JOIN users u ON u.id = g.user_id
    WHERE g.status = 'approved'
)
SELECT * FROM ranked_goals WHERE rn = 1;

ALTER VIEW latest_approved_goals OWNER TO postgres;

-- Seed data per existing organization
-- Rating mappings SS..D
INSERT INTO evaluation_score_mapping (organization_id, rating_code, rating_label, score_value)
SELECT org.id, v.code, v.label, v.score
FROM organizations org
CROSS JOIN (
    VALUES
        ('SS', 'SS', 7.0),
        ('S',  'S',  6.0),
        ('A+', 'A+', 5.0),
        ('A',  'A',  4.0),
        ('A-', 'A-', 3.0),
        ('B',  'B',  2.0),
        ('C',  'C',  1.0),
        ('D',  'D',  0.0)
) AS v(code, label, score)
ON CONFLICT (organization_id, rating_code) DO NOTHING;

-- Thresholds SS..D (from spreadsheet ladder)
INSERT INTO rating_thresholds (organization_id, rating_code, min_score, note)
SELECT org.id, v.code, v.min_score, 'Initial seed'
FROM organizations org
CROSS JOIN (
    VALUES
        ('SS', 6.50),
        ('S',  5.50),
        ('A+', 4.50),
        ('A',  3.70),
        ('A-', 2.70),
        ('B',  1.70),
        ('C',  1.00),
        ('D',  0.00)
) AS v(code, min_score)
ON CONFLICT (organization_id, rating_code) DO NOTHING;

-- Policy flag seed: mbo_d_is_fail disabled by default
INSERT INTO evaluation_policy_flags (organization_id, key, value)
SELECT org.id, 'mbo_d_is_fail', '{"enabled": false}'::jsonb
FROM organizations org
ON CONFLICT (organization_id, key) DO NOTHING;

-- Level adjustment seed (example from spreadsheet: S=+8, D=-8, SS=+10)
INSERT INTO level_adjustment_master (organization_id, rating_code, level_delta, notes)
SELECT org.id, v.code, v.delta, 'Initial seed'
FROM organizations org
CROSS JOIN (
    VALUES
        ('SS', 10),
        ('S',   8),
        ('A+',  6),
        ('A',   4),
        ('A-',  2),
        ('B',   0),
        ('C',  -4),
        ('D',  -8)
) AS v(code, delta)
ON CONFLICT (organization_id, rating_code) DO NOTHING;

-- updated_at trigger hooks
CREATE TRIGGER update_evaluation_score_mapping_updated_at
    BEFORE UPDATE ON evaluation_score_mapping
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rating_thresholds_updated_at
    BEFORE UPDATE ON rating_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_policy_flags_updated_at
    BEFORE UPDATE ON evaluation_policy_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_level_adjustment_master_updated_at
    BEFORE UPDATE ON level_adjustment_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_self_assessment_summaries_updated_at
    BEFORE UPDATE ON self_assessment_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
