-- Migration: Add viewer visibility overrides for Viewer role
-- Introduces resource-scoped viewer grants backed by strict FK tables and a unified read view

BEGIN;

-- Viewer visibility for individual users
CREATE TABLE IF NOT EXISTS viewer_visibility_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    viewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(30) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT viewer_visibility_user_unique_assignment UNIQUE (organization_id, viewer_user_id, target_user_id, resource_type),
    CONSTRAINT viewer_visibility_user_resource_type_check CHECK (resource_type IN ('user', 'goal', 'evaluation', 'assessment', 'department', 'stage'))
);

CREATE INDEX IF NOT EXISTS idx_viewer_visibility_user_org_viewer ON viewer_visibility_user (organization_id, viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_visibility_user_org_target ON viewer_visibility_user (organization_id, target_user_id);
CREATE TRIGGER update_viewer_visibility_user_updated_at
    BEFORE UPDATE ON viewer_visibility_user
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Viewer visibility for departments
CREATE TABLE IF NOT EXISTS viewer_visibility_department (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    viewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    resource_type VARCHAR(30) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT viewer_visibility_department_unique_assignment UNIQUE (organization_id, viewer_user_id, target_department_id, resource_type),
    CONSTRAINT viewer_visibility_department_resource_type_check CHECK (resource_type IN ('user', 'goal', 'evaluation', 'assessment', 'department', 'stage'))
);

CREATE INDEX IF NOT EXISTS idx_viewer_visibility_department_org_viewer ON viewer_visibility_department (organization_id, viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_visibility_department_org_target ON viewer_visibility_department (organization_id, target_department_id);
CREATE TRIGGER update_viewer_visibility_department_updated_at
    BEFORE UPDATE ON viewer_visibility_department
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Viewer visibility for supervisor teams
CREATE TABLE IF NOT EXISTS viewer_visibility_supervisor_team (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    viewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(30) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT viewer_visibility_supervisor_team_unique_assignment UNIQUE (organization_id, viewer_user_id, supervisor_user_id, resource_type),
    CONSTRAINT viewer_visibility_supervisor_team_resource_type_check CHECK (resource_type IN ('user', 'goal', 'evaluation', 'assessment', 'department', 'stage'))
);

CREATE INDEX IF NOT EXISTS idx_viewer_visibility_supervisor_org_viewer ON viewer_visibility_supervisor_team (organization_id, viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_viewer_visibility_supervisor_org_supervisor ON viewer_visibility_supervisor_team (organization_id, supervisor_user_id);
CREATE TRIGGER update_viewer_visibility_supervisor_team_updated_at
    BEFORE UPDATE ON viewer_visibility_supervisor_team
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Unified read-only view for grants
CREATE OR REPLACE VIEW viewer_visibility_grants AS
SELECT
    organization_id,
    viewer_user_id,
    'user' AS subject_type,
    target_user_id AS subject_id,
    resource_type,
    created_by,
    created_at
FROM viewer_visibility_user
UNION ALL
SELECT
    organization_id,
    viewer_user_id,
    'department' AS subject_type,
    target_department_id AS subject_id,
    resource_type,
    created_by,
    created_at
FROM viewer_visibility_department
UNION ALL
SELECT
    organization_id,
    viewer_user_id,
    'supervisor_team' AS subject_type,
    supervisor_user_id AS subject_id,
    resource_type,
    created_by,
    created_at
FROM viewer_visibility_supervisor_team;

COMMIT;
