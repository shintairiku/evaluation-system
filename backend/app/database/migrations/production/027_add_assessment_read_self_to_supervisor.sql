-- Migration: Add assessment:read:self permission to supervisor role
-- Fix: Supervisors with only the supervisor role cannot access their own
-- core-value evaluations or peer reviews because the role was missing
-- the assessment:read:self permission.

INSERT INTO role_permissions (organization_id, role_id, permission_id)
SELECT r.organization_id, r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'assessment:read:self'
WHERE r.name = 'supervisor'
ON CONFLICT DO NOTHING;
