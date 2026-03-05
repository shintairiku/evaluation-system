-- Migration: Persist per-user comprehensive evaluation processing status
-- Purpose:
-- - Track processed/unprocessed state per user per evaluation period
-- - Support eval_admin user-by-user processing workflow

BEGIN;

CREATE TABLE IF NOT EXISTS comprehensive_processing_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    processed_by_user_id UUID NOT NULL REFERENCES users(id),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comprehensive_processing_statuses_org_period_user
        UNIQUE (organization_id, period_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comprehensive_processing_statuses_org_period
    ON comprehensive_processing_statuses (organization_id, period_id);

CREATE INDEX IF NOT EXISTS idx_comprehensive_processing_statuses_org_user
    ON comprehensive_processing_statuses (organization_id, user_id);

INSERT INTO comprehensive_processing_statuses (
    id,
    organization_id,
    period_id,
    user_id,
    processed_by_user_id,
    processed_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    md.organization_id,
    md.period_id,
    md.user_id,
    md.applied_by_user_id,
    md.applied_at,
    NOW(),
    NOW()
FROM comprehensive_manual_decisions md
ON CONFLICT (organization_id, period_id, user_id)
DO UPDATE
SET
    processed_by_user_id = EXCLUDED.processed_by_user_id,
    processed_at = EXCLUDED.processed_at,
    updated_at = NOW();

COMMIT;
