-- Migration: Core Value Evaluation System
-- Purpose: Create 3 dedicated tables for core value evaluations:
--   1. core_value_definitions - 9 fixed organizational values
--   2. core_value_evaluations - employee self-evaluation (like self_assessments)
--   3. core_value_feedback - supervisor feedback (like supervisor_feedback)
-- Includes seed data for the 9 default core values per organization.

-- ============================================================
-- 1. core_value_definitions
-- ============================================================
CREATE TABLE core_value_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL,
    display_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cv_def_org_order UNIQUE (organization_id, display_order),
    CONSTRAINT uq_cv_def_org_name UNIQUE (organization_id, name)
);

-- ============================================================
-- 2. core_value_evaluations (employee self-evaluation)
-- ============================================================
CREATE TABLE core_value_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scores JSONB,                               -- { "coreValueDefId": "A+", ... }
    comment TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cv_eval UNIQUE (period_id, user_id),
    CONSTRAINT chk_cv_status CHECK (status IN ('draft', 'submitted', 'approved')),
    CONSTRAINT chk_cv_submission CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);

CREATE INDEX idx_cv_eval_period_user ON core_value_evaluations(period_id, user_id);
CREATE INDEX idx_cv_eval_status ON core_value_evaluations(status);

-- ============================================================
-- 3. core_value_feedback (supervisor feedback)
-- ============================================================
CREATE TABLE core_value_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    core_value_evaluation_id UUID NOT NULL REFERENCES core_value_evaluations(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subordinate_id UUID REFERENCES users(id),
    scores JSONB,
    comment TEXT,
    return_comment TEXT,
    action VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    status VARCHAR(50) NOT NULL DEFAULT 'incomplete',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cvf_action CHECK (action IN ('PENDING', 'APPROVED')),
    CONSTRAINT chk_cvf_status CHECK (status IN ('incomplete', 'draft', 'submitted')),
    CONSTRAINT chk_cvf_submission CHECK (status != 'submitted' OR submitted_at IS NOT NULL),
    CONSTRAINT chk_cvf_approval CHECK (action != 'APPROVED' OR reviewed_at IS NOT NULL)
);

CREATE UNIQUE INDEX idx_cvf_evaluation_unique ON core_value_feedback(core_value_evaluation_id);
CREATE INDEX idx_cvf_period_status ON core_value_feedback(period_id, status);
CREATE INDEX idx_cvf_supervisor ON core_value_feedback(supervisor_id);
CREATE INDEX idx_cvf_subordinate ON core_value_feedback(subordinate_id);
CREATE INDEX idx_cvf_action ON core_value_feedback(action);

-- ============================================================
-- 4. Seed default core values for all organizations (idempotent)
-- ============================================================
INSERT INTO core_value_definitions (organization_id, display_order, name, is_active, created_at, updated_at)
SELECT o.id, cv.display_order, cv.name, TRUE, NOW(), NOW()
FROM organizations o
CROSS JOIN (
    VALUES
        (1, 'ポジティブマインドを持つ'),
        (2, '未来にワクワクし大胆に挑戦する'),
        (3, 'ハングリーな気持ちを忘れない'),
        (4, '一人ひとりが起因となる'),
        (5, '誠実でいる勇気を持ち続ける'),
        (6, '理念を実現する仲間として敬意を持つ'),
        (7, '一致団結して進む'),
        (8, 'プロフェッショナルであろう'),
        (9, '信頼と成果でつながるパートナーになる')
) AS cv(display_order, name)
ON CONFLICT (organization_id, display_order) DO NOTHING;
