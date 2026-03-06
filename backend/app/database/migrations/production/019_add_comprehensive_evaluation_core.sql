-- Migration: Add comprehensive evaluation core persistence and role rollout
-- Purpose:
-- - Add users.level for comprehensive level calculations
-- - Add comprehensive evaluation rule/settings/manual decision tables
-- - Seed default comprehensive settings and eval_admin role

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- ============================================================
-- 1) users.level support
-- ============================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS level INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_users_level_range'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_level_range
            CHECK (level IS NULL OR (level >= 1 AND level <= 30));
    END IF;
END $$;

-- ============================================================
-- 2) Comprehensive settings/rule tables
-- ============================================================
CREATE TABLE IF NOT EXISTS comprehensive_overall_rank_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    overall_rank TEXT NOT NULL,
    min_score NUMERIC(10, 2) NOT NULL,
    max_score NUMERIC(10, 2),
    level_delta INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_overall_rank_rules_rank
        CHECK (overall_rank IN ('SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D')),
    CONSTRAINT chk_comprehensive_overall_rank_rules_bounds
        CHECK (max_score IS NULL OR min_score < max_score),
    CONSTRAINT uq_comprehensive_overall_rank_rules_org_rank
        UNIQUE (organization_id, overall_rank)
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_overall_rank_rules_org_active_order
    ON comprehensive_overall_rank_rules (organization_id, is_active, display_order);

CREATE TABLE IF NOT EXISTS comprehensive_decision_rule_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL,
    group_name TEXT,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_decision_rule_groups_type
        CHECK (decision_type IN ('promotion', 'demotion')),
    CONSTRAINT uq_comprehensive_decision_rule_groups_org_type_order
        UNIQUE (organization_id, decision_type, display_order)
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_decision_rule_groups_org_type_active_order
    ON comprehensive_decision_rule_groups (organization_id, decision_type, is_active, display_order);

CREATE TABLE IF NOT EXISTS comprehensive_decision_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES comprehensive_decision_rule_groups(id) ON DELETE CASCADE,
    condition_order INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    threshold_rank TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_decision_rules_field
        CHECK (field_name IN ('overallRank', 'competencyFinalRank', 'coreValueFinalRank')),
    CONSTRAINT chk_comprehensive_decision_rules_operator
        CHECK (operator IN ('rank_at_least', 'rank_at_or_worse')),
    CONSTRAINT chk_comprehensive_decision_rules_threshold_rank
        CHECK (threshold_rank IN ('SS', 'S', 'A+', 'A', 'A-', 'B', 'C', 'D')),
    CONSTRAINT uq_comprehensive_decision_rules_group_order
        UNIQUE (group_id, condition_order)
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_decision_rules_org_group_order
    ON comprehensive_decision_rules (organization_id, group_id, condition_order);

-- ============================================================
-- 3) Comprehensive manual decision + audit tables
-- ============================================================
CREATE TABLE IF NOT EXISTS comprehensive_manual_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    stage_after TEXT,
    level_after INTEGER,
    reason TEXT NOT NULL,
    double_checked_by TEXT NOT NULL,
    applied_by_user_id UUID NOT NULL REFERENCES users(id),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_manual_decisions_decision
        CHECK (decision IN ('昇格', '降格', '対象外')),
    CONSTRAINT chk_comprehensive_manual_decisions_stage_required
        CHECK ((decision = '対象外') OR (stage_after IS NOT NULL AND btrim(stage_after) <> '')),
    CONSTRAINT chk_comprehensive_manual_decisions_level_range
        CHECK (level_after IS NULL OR (level_after >= 1 AND level_after <= 30)),
    CONSTRAINT uq_comprehensive_manual_decisions_org_period_user
        UNIQUE (organization_id, period_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_manual_decisions_org_period
    ON comprehensive_manual_decisions (organization_id, period_id);
CREATE INDEX IF NOT EXISTS idx_comprehensive_manual_decisions_org_user
    ON comprehensive_manual_decisions (organization_id, user_id);

CREATE TABLE IF NOT EXISTS comprehensive_manual_decision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    decision TEXT,
    stage_after TEXT,
    level_after INTEGER,
    reason TEXT,
    double_checked_by TEXT,
    applied_by_user_id UUID REFERENCES users(id),
    applied_at TIMESTAMPTZ,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_manual_decision_history_operation
        CHECK (operation IN ('UPSERT', 'CLEAR')),
    CONSTRAINT chk_comprehensive_manual_decision_history_decision
        CHECK (decision IS NULL OR decision IN ('昇格', '降格', '対象外')),
    CONSTRAINT chk_comprehensive_manual_decision_history_level_range
        CHECK (level_after IS NULL OR (level_after >= 1 AND level_after <= 30))
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_manual_decision_history_org_period_changed
    ON comprehensive_manual_decision_history (organization_id, period_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_comprehensive_manual_decision_history_org_user_changed
    ON comprehensive_manual_decision_history (organization_id, user_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS comprehensive_settings_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES users(id),
    before_json JSONB,
    after_json JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_settings_audit_log_org_changed
    ON comprehensive_settings_audit_log (organization_id, changed_at DESC);

-- ============================================================
-- 4) eval_admin role rollout + permission cloning from admin
-- ============================================================
INSERT INTO roles (
    id,
    organization_id,
    name,
    description,
    hierarchy_order,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    o.id,
    'eval_admin',
    '評価管理者',
    1,
    NOW(),
    NOW()
FROM organizations o
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO role_permissions (
    id,
    organization_id,
    role_id,
    permission_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    eval_role.organization_id,
    eval_role.id,
    admin_perm.permission_id,
    NOW(),
    NOW()
FROM roles eval_role
JOIN roles admin_role
  ON admin_role.organization_id = eval_role.organization_id
 AND admin_role.name = 'admin'
JOIN role_permissions admin_perm
  ON admin_perm.organization_id = admin_role.organization_id
 AND admin_perm.role_id = admin_role.id
WHERE eval_role.name = 'eval_admin'
ON CONFLICT (organization_id, role_id, permission_id) DO NOTHING;

-- ============================================================
-- 5) Seed default comprehensive overall rank rules
-- ============================================================
INSERT INTO comprehensive_overall_rank_rules (
    id,
    organization_id,
    overall_rank,
    min_score,
    max_score,
    level_delta,
    display_order,
    is_active,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    o.id,
    defaults.overall_rank,
    defaults.min_score,
    defaults.max_score,
    defaults.level_delta,
    defaults.display_order,
    TRUE,
    NOW(),
    NOW()
FROM organizations o
CROSS JOIN (
    VALUES
        ('SS', 6.5::numeric, NULL::numeric, 10, 1),
        ('S',  5.5::numeric, 6.5::numeric, 8, 2),
        ('A+', 4.5::numeric, 5.5::numeric, 6, 3),
        ('A',  3.7::numeric, 4.5::numeric, 5, 4),
        ('A-', 2.7::numeric, 3.7::numeric, 2, 5),
        ('B',  1.7::numeric, 2.7::numeric, 1, 6),
        ('C',  1.0::numeric, 1.7::numeric, -5, 7),
        ('D',  0.1::numeric, 1.0::numeric, -8, 8)
) AS defaults(overall_rank, min_score, max_score, level_delta, display_order)
ON CONFLICT (organization_id, overall_rank)
DO UPDATE
SET
    min_score = EXCLUDED.min_score,
    max_score = EXCLUDED.max_score,
    level_delta = EXCLUDED.level_delta,
    display_order = EXCLUDED.display_order,
    is_active = TRUE,
    updated_at = NOW();

-- ============================================================
-- 6) Seed default decision rule groups and conditions
-- ============================================================
INSERT INTO comprehensive_decision_rule_groups (
    id,
    organization_id,
    decision_type,
    group_name,
    display_order,
    is_active,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    o.id,
    'promotion',
    'Default Promotion Group',
    1,
    TRUE,
    NOW(),
    NOW()
FROM organizations o
ON CONFLICT (organization_id, decision_type, display_order)
DO UPDATE
SET
    group_name = EXCLUDED.group_name,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO comprehensive_decision_rule_groups (
    id,
    organization_id,
    decision_type,
    group_name,
    display_order,
    is_active,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    o.id,
    'demotion',
    'Default Demotion Group',
    1,
    TRUE,
    NOW(),
    NOW()
FROM organizations o
ON CONFLICT (organization_id, decision_type, display_order)
DO UPDATE
SET
    group_name = EXCLUDED.group_name,
    is_active = TRUE,
    updated_at = NOW();

WITH promotion_groups AS (
    SELECT id, organization_id
    FROM comprehensive_decision_rule_groups
    WHERE decision_type = 'promotion'
      AND display_order = 1
)
INSERT INTO comprehensive_decision_rules (
    id,
    organization_id,
    group_id,
    condition_order,
    field_name,
    operator,
    threshold_rank,
    is_active,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    pg.organization_id,
    pg.id,
    c.condition_order,
    c.field_name,
    'rank_at_least',
    'A+',
    TRUE,
    NOW(),
    NOW()
FROM promotion_groups pg
CROSS JOIN (
    VALUES
        (1, 'overallRank'),
        (2, 'competencyFinalRank'),
        (3, 'coreValueFinalRank')
) AS c(condition_order, field_name)
ON CONFLICT (group_id, condition_order)
DO UPDATE
SET
    field_name = EXCLUDED.field_name,
    operator = EXCLUDED.operator,
    threshold_rank = EXCLUDED.threshold_rank,
    is_active = TRUE,
    updated_at = NOW();

WITH demotion_groups AS (
    SELECT id, organization_id
    FROM comprehensive_decision_rule_groups
    WHERE decision_type = 'demotion'
      AND display_order = 1
)
INSERT INTO comprehensive_decision_rules (
    id,
    organization_id,
    group_id,
    condition_order,
    field_name,
    operator,
    threshold_rank,
    is_active,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    dg.organization_id,
    dg.id,
    1,
    'overallRank',
    'rank_at_or_worse',
    'D',
    TRUE,
    NOW(),
    NOW()
FROM demotion_groups dg
ON CONFLICT (group_id, condition_order)
DO UPDATE
SET
    field_name = EXCLUDED.field_name,
    operator = EXCLUDED.operator,
    threshold_rank = EXCLUDED.threshold_rank,
    is_active = TRUE,
    updated_at = NOW();

COMMIT;
