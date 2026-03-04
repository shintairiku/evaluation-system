-- Migration: Peer Review System (同僚評価)
-- Purpose: Create 2 tables for peer review evaluations:
--   1. peer_review_assignments - admin assigns 2 reviewers per employee
--   2. peer_review_evaluations - reviewer scores + general comment (auto-created on assignment)

-- ============================================================
-- 1. peer_review_assignments
-- ============================================================
CREATE TABLE peer_review_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_peer_assignment UNIQUE (period_id, reviewee_id, reviewer_id),
    CONSTRAINT chk_peer_no_self CHECK (reviewee_id != reviewer_id)
);

CREATE INDEX idx_pra_period_reviewee ON peer_review_assignments(period_id, reviewee_id);
CREATE INDEX idx_pra_period_reviewer ON peer_review_assignments(period_id, reviewer_id);

-- ============================================================
-- 2. peer_review_evaluations
-- ============================================================
CREATE TABLE peer_review_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES peer_review_assignments(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scores JSONB,                               -- { "coreValueDefId": "A+", ... }
    comment TEXT,                               -- 1 general comment
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_peer_eval_assignment UNIQUE (assignment_id),
    CONSTRAINT chk_pre_status CHECK (status IN ('draft', 'submitted')),
    CONSTRAINT chk_pre_submission CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);

CREATE INDEX idx_pre_period_reviewee ON peer_review_evaluations(period_id, reviewee_id);
CREATE INDEX idx_pre_period_reviewer ON peer_review_evaluations(period_id, reviewer_id);
CREATE INDEX idx_pre_status ON peer_review_evaluations(status);
