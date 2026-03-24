-- Migration: Department/stage-scoped comprehensive evaluation rulesets
-- Purpose:
-- - Replace global comprehensive evaluation rule persistence with reusable rulesets
-- - Add period default assignment plus period/department/stage overrides
-- - Backfill existing org-level settings into default template + period snapshots

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

CREATE TABLE IF NOT EXISTS comprehensive_rulesets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    settings_json JSONB NOT NULL,
    is_default_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_rulesets_name_not_blank
        CHECK (btrim(name) <> ''),
    CONSTRAINT uq_comprehensive_rulesets_org_name
        UNIQUE (organization_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprehensive_rulesets_org_default_template
    ON comprehensive_rulesets (organization_id)
    WHERE is_default_template = TRUE;

CREATE INDEX IF NOT EXISTS idx_comprehensive_rulesets_org_name
    ON comprehensive_rulesets (organization_id, name);

CREATE TABLE IF NOT EXISTS comprehensive_ruleset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    settings_json JSONB NOT NULL,
    source_ruleset_id UUID REFERENCES comprehensive_rulesets(id) ON DELETE SET NULL,
    source_ruleset_name_snapshot TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comprehensive_ruleset_assignments_single_target
        CHECK (
            (CASE WHEN department_id IS NULL THEN 0 ELSE 1 END) +
            (CASE WHEN stage_id IS NULL THEN 0 ELSE 1 END) <= 1
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprehensive_ruleset_assignments_period_default
    ON comprehensive_ruleset_assignments (organization_id, period_id)
    WHERE department_id IS NULL AND stage_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprehensive_ruleset_assignments_period_department
    ON comprehensive_ruleset_assignments (organization_id, period_id, department_id)
    WHERE department_id IS NOT NULL AND stage_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprehensive_ruleset_assignments_period_stage
    ON comprehensive_ruleset_assignments (organization_id, period_id, stage_id)
    WHERE department_id IS NULL AND stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comprehensive_ruleset_assignments_org_period
    ON comprehensive_ruleset_assignments (organization_id, period_id);

CREATE INDEX IF NOT EXISTS idx_comprehensive_ruleset_assignments_org_period_department
    ON comprehensive_ruleset_assignments (organization_id, period_id, department_id);

CREATE INDEX IF NOT EXISTS idx_comprehensive_ruleset_assignments_org_period_stage
    ON comprehensive_ruleset_assignments (organization_id, period_id, stage_id);

ALTER TABLE comprehensive_settings_audit_log
    ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS ruleset_id UUID REFERENCES comprehensive_rulesets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comprehensive_settings_audit_log_org_period_changed
    ON comprehensive_settings_audit_log (organization_id, period_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_comprehensive_settings_audit_log_org_ruleset_changed
    ON comprehensive_settings_audit_log (organization_id, ruleset_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_comprehensive_settings_audit_log_org_period_stage_changed
    ON comprehensive_settings_audit_log (organization_id, period_id, stage_id, changed_at DESC);

WITH org_defaults AS (
    SELECT
        o.id AS organization_id,
        jsonb_build_object(
            'promotion',
            jsonb_build_object(
                'ruleGroups',
                COALESCE(
                    (
                        SELECT jsonb_agg(group_json ORDER BY display_order)
                        FROM (
                            SELECT
                                g.display_order,
                                jsonb_build_object(
                                    'id', g.id::text,
                                    'conditions',
                                    COALESCE(
                                        (
                                            SELECT jsonb_agg(
                                                jsonb_build_object(
                                                    'type', 'rank_at_least',
                                                    'field', r.field_name,
                                                    'minimumRank', r.threshold_rank
                                                )
                                                ORDER BY r.condition_order
                                            )
                                            FROM comprehensive_decision_rules r
                                            WHERE r.group_id = g.id
                                              AND r.organization_id = g.organization_id
                                              AND r.is_active = TRUE
                                        ),
                                        '[]'::jsonb
                                    )
                                ) AS group_json
                            FROM comprehensive_decision_rule_groups g
                            WHERE g.organization_id = o.id
                              AND g.decision_type = 'promotion'
                              AND g.is_active = TRUE
                        ) promotion_groups
                    ),
                    jsonb_build_array(
                        jsonb_build_object(
                            'id', 'promotion-default',
                            'conditions', jsonb_build_array(
                                jsonb_build_object('type', 'rank_at_least', 'field', 'overallRank', 'minimumRank', 'A+'),
                                jsonb_build_object('type', 'rank_at_least', 'field', 'competencyFinalRank', 'minimumRank', 'A+'),
                                jsonb_build_object('type', 'rank_at_least', 'field', 'coreValueFinalRank', 'minimumRank', 'A+')
                            )
                        )
                    )
                )
            ),
            'demotion',
            jsonb_build_object(
                'ruleGroups',
                COALESCE(
                    (
                        SELECT jsonb_agg(group_json ORDER BY display_order)
                        FROM (
                            SELECT
                                g.display_order,
                                jsonb_build_object(
                                    'id', g.id::text,
                                    'conditions',
                                    COALESCE(
                                        (
                                            SELECT jsonb_agg(
                                                jsonb_build_object(
                                                    'type', 'rank_at_or_worse',
                                                    'field', r.field_name,
                                                    'thresholdRank', r.threshold_rank
                                                )
                                                ORDER BY r.condition_order
                                            )
                                            FROM comprehensive_decision_rules r
                                            WHERE r.group_id = g.id
                                              AND r.organization_id = g.organization_id
                                              AND r.is_active = TRUE
                                        ),
                                        '[]'::jsonb
                                    )
                                ) AS group_json
                            FROM comprehensive_decision_rule_groups g
                            WHERE g.organization_id = o.id
                              AND g.decision_type = 'demotion'
                              AND g.is_active = TRUE
                        ) demotion_groups
                    ),
                    jsonb_build_array(
                        jsonb_build_object(
                            'id', 'demotion-default',
                            'conditions', jsonb_build_array(
                                jsonb_build_object('type', 'rank_at_or_worse', 'field', 'overallRank', 'thresholdRank', 'D')
                            )
                        )
                    )
                )
            ),
            'overallScoreThresholds',
            COALESCE(
                (
                    SELECT jsonb_object_agg(overall_rank, min_score ORDER BY display_order)
                    FROM comprehensive_overall_rank_rules r
                    WHERE r.organization_id = o.id
                      AND r.is_active = TRUE
                ),
                jsonb_build_object(
                    'SS', 6.5,
                    'S', 5.5,
                    'A+', 4.5,
                    'A', 3.7,
                    'A-', 2.7,
                    'B', 1.7,
                    'C', 1.0,
                    'D', 0.1
                )
            ),
            'levelDeltaByOverallRank',
            COALESCE(
                (
                    SELECT jsonb_object_agg(overall_rank, level_delta ORDER BY display_order)
                    FROM comprehensive_overall_rank_rules r
                    WHERE r.organization_id = o.id
                      AND r.is_active = TRUE
                ),
                jsonb_build_object(
                    'SS', 10,
                    'S', 8,
                    'A+', 6,
                    'A', 5,
                    'A-', 2,
                    'B', 1,
                    'C', -5,
                    'D', -8
                )
            )
        ) AS settings_json
    FROM organizations o
),
upserted_rulesets AS (
    INSERT INTO comprehensive_rulesets (
        id,
        organization_id,
        name,
        settings_json,
        is_default_template,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        organization_id,
        'Default',
        settings_json,
        TRUE,
        NOW(),
        NOW()
    FROM org_defaults
    ON CONFLICT (organization_id, name)
    DO UPDATE SET
        settings_json = EXCLUDED.settings_json,
        is_default_template = TRUE,
        updated_at = NOW()
    RETURNING id, organization_id, name, settings_json
)
INSERT INTO comprehensive_ruleset_assignments (
    id,
    organization_id,
    period_id,
    department_id,
    stage_id,
    settings_json,
    source_ruleset_id,
    source_ruleset_name_snapshot,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    ep.organization_id,
    ep.id,
    NULL,
    NULL,
    rs.settings_json,
    rs.id,
    rs.name,
    NOW(),
    NOW()
FROM evaluation_periods ep
JOIN comprehensive_rulesets rs
  ON rs.organization_id = ep.organization_id
 AND rs.is_default_template = TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM comprehensive_ruleset_assignments existing
    WHERE existing.organization_id = ep.organization_id
      AND existing.period_id = ep.id
      AND existing.department_id IS NULL
      AND existing.stage_id IS NULL
);

COMMIT;
