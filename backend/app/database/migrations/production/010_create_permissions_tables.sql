-- Migration: Create permissions catalog and role_permissions assignments
-- Enables admin-managed role permissions backed by database tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- 1) Permissions catalog (global)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT permissions_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

CREATE TRIGGER update_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Role permission assignments (organization scoped)
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT role_permissions_unique_assignment UNIQUE (organization_id, role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_org_role ON role_permissions(organization_id, role_id);

CREATE TRIGGER update_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3) Seed permissions catalog from current Permission enum
INSERT INTO permissions (code, description)
VALUES
    ('user:read:all', 'Read all users'),
    ('user:read:subordinates', 'Read subordinate users'),
    ('user:read:self', 'Read own user profile'),
    ('user:manage', 'Manage users'),
    ('user:manage:basic', 'Manage basic user fields'),
    ('user:manage:plus', 'Manage basic fields and subordinates'),
    ('department:read', 'View departments'),
    ('department:manage', 'Manage departments'),
    ('role:read:all', 'View roles'),
    ('role:manage', 'Manage roles'),
    ('goal:read:self', 'View own goals'),
    ('goal:read:all', 'View all goals'),
    ('goal:read:subordinates', 'View subordinate goals'),
    ('goal:manage', 'Manage all goals'),
    ('goal:manage:self', 'Manage own goals'),
    ('goal:approve', 'Approve goals'),
    ('evaluation:read', 'View evaluations'),
    ('evaluation:manage', 'Manage evaluations'),
    ('evaluation:review', 'Review evaluations'),
    ('competency:read', 'View competencies'),
    ('competency:read:self', 'View own competencies'),
    ('competency:manage', 'Manage competencies'),
    ('assessment:read:self', 'View own assessments'),
    ('assessment:read:all', 'View all assessments'),
    ('assessment:read:subordinates', 'View subordinate assessments'),
    ('assessment:manage:self', 'Manage own assessments'),
    ('report:access', 'Access reports'),
    ('stage:read:all', 'View all stages'),
    ('stage:read:self', 'View own stage'),
    ('stage:manage', 'Manage stages'),
    ('hierarchy:manage', 'Manage hierarchy relationships')
ON CONFLICT (code) DO NOTHING;

-- Admin permissions
INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'user:read:all',
    'user:read:subordinates',
    'user:read:self',
    'user:manage',
    'user:manage:basic',
    'user:manage:plus',
    'department:read',
    'department:manage',
    'role:read:all',
    'role:manage',
    'goal:read:self',
    'goal:read:all',
    'goal:read:subordinates',
    'goal:manage',
    'goal:manage:self',
    'goal:approve',
    'evaluation:read',
    'evaluation:manage',
    'evaluation:review',
    'competency:read',
    'competency:read:self',
    'competency:manage',
    'assessment:read:self',
    'assessment:read:all',
    'assessment:read:subordinates',
    'assessment:manage:self',
    'report:access',
    'stage:read:all',
    'stage:manage',
    'hierarchy:manage'
)
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'user:read:subordinates',
    'user:read:self',
    'user:manage:plus',
    'department:read',
    'role:read:all',
    'goal:read:self',
    'goal:read:subordinates',
    'goal:manage:self',
    'goal:approve',
    'evaluation:read',
    'evaluation:manage',
    'evaluation:review',
    'competency:read:self',
    'assessment:read:subordinates',
    'assessment:manage:self',
    'report:access',
    'stage:read:all',
    'hierarchy:manage'
)
WHERE r.name = 'manager'
ON CONFLICT DO NOTHING;

-- Supervisor permissions
INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'user:read:subordinates',
    'user:read:self',
    'user:manage:plus',
    'department:read',
    'role:read:all',
    'goal:read:self',
    'goal:read:subordinates',
    'goal:manage:self',
    'goal:approve',
    'evaluation:read',
    'evaluation:manage',
    'evaluation:review',
    'competency:read:self',
    'assessment:read:subordinates',
    'assessment:manage:self',
    'report:access',
    'stage:read:all',
    'hierarchy:manage'
)
WHERE r.name = 'supervisor'
ON CONFLICT DO NOTHING;

-- Viewer permissions
INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'user:read:self',
    'department:read',
    'role:read:all',
    'goal:read:self',
    'evaluation:read',
    'competency:read:self',
    'assessment:read:self',
    'assessment:manage:self',
    'stage:read:all'
)
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;

-- Employee permissions
INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'user:read:self',
    'user:manage:basic',
    'department:read',
    'role:read:all',
    'goal:read:self',
    'goal:manage:self',
    'evaluation:read',
    'evaluation:manage',
    'competency:read:self',
    'assessment:read:self',
    'assessment:manage:self',
    'stage:read:all'
)
WHERE r.name = 'employee'
ON CONFLICT DO NOTHING;

-- Part-time permissions
INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'user:read:self',
    'user:manage:basic',
    'department:read',
    'role:read:all',
    'goal:read:self',
    'goal:manage:self',
    'evaluation:read',
    'evaluation:manage',
    'competency:read:self',
    'assessment:read:self',
    'assessment:manage:self',
    'stage:read:all'
)
WHERE r.name = 'parttime'
ON CONFLICT DO NOTHING;

COMMIT;
