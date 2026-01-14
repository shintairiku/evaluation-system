-- 014_add_user_goal_weight_overrides.sql
-- Adds user-level goal weight overrides and audit history.

ALTER TABLE users
    ADD COLUMN quantitative_weight_override DECIMAL(5,2),
    ADD COLUMN qualitative_weight_override DECIMAL(5,2),
    ADD COLUMN competency_weight_override DECIMAL(5,2);

ALTER TABLE users
    ADD CONSTRAINT chk_users_quantitative_weight_override_range
        CHECK (quantitative_weight_override IS NULL OR (quantitative_weight_override >= 0 AND quantitative_weight_override <= 100)),
    ADD CONSTRAINT chk_users_qualitative_weight_override_range
        CHECK (qualitative_weight_override IS NULL OR (qualitative_weight_override >= 0 AND qualitative_weight_override <= 100)),
    ADD CONSTRAINT chk_users_competency_weight_override_range
        CHECK (competency_weight_override IS NULL OR (competency_weight_override >= 0 AND competency_weight_override <= 100)),
    ADD CONSTRAINT chk_users_goal_weight_override_all_or_none
        CHECK (
            (quantitative_weight_override IS NULL AND qualitative_weight_override IS NULL AND competency_weight_override IS NULL)
            OR
            (quantitative_weight_override IS NOT NULL AND qualitative_weight_override IS NOT NULL AND competency_weight_override IS NOT NULL)
        );

CREATE TABLE IF NOT EXISTS user_goal_weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    quantitative_weight_before DECIMAL(5,2),
    quantitative_weight_after DECIMAL(5,2),
    qualitative_weight_before DECIMAL(5,2),
    qualitative_weight_after DECIMAL(5,2),
    competency_weight_before DECIMAL(5,2),
    competency_weight_after DECIMAL(5,2),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_goal_weight_history_org_user_changed_at
    ON user_goal_weight_history (organization_id, user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_goal_weight_history_user_changed_at
    ON user_goal_weight_history (user_id, changed_at DESC);
