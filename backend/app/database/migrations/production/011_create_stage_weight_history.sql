-- 011_create_stage_weight_history.sql
-- Creates audit table for tracking stage weight updates.

CREATE TABLE IF NOT EXISTS stage_weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_stage_weight_history_stage_changed_at
    ON stage_weight_history (stage_id, changed_at DESC);
