-- Migration: Add assessment:read:self and assessment:manage:self permissions to manager role
-- Fix: Managers with only the manager role cannot access their own
-- peer review assignments because the role was missing the
-- assessment:read:self permission. They also could not save/submit
-- peer reviews without assessment:manage:self.

INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('assessment:read:self', 'assessment:manage:self')
WHERE r.name = 'manager'
ON CONFLICT DO NOTHING;
