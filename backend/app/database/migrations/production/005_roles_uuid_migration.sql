-- Migration: Convert roles.id and user_roles.role_id from SMALLINT to UUID
-- Assumptions: current roles.id and user_roles.role_id are smallint
-- This migration will safely convert both to UUID while preserving data integrity

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wrap in transaction for safety
BEGIN;

-- 1) Drop foreign key constraints from user_roles first
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

-- 2) Add new UUID column to roles table (keep existing SMALLINT id during transition)
ALTER TABLE roles ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE roles ALTER COLUMN id_uuid SET NOT NULL;

-- 3) Add temporary UUID column to user_roles for safe mapping
ALTER TABLE user_roles ADD COLUMN role_id_uuid UUID;

-- 4) Populate user_roles.role_id_uuid by joining on existing SMALLINT ids
UPDATE user_roles ur
SET role_id_uuid = r.id_uuid
FROM roles r
WHERE ur.role_id = r.id;

-- 5) Replace old role_id with the new UUID column in user_roles
ALTER TABLE user_roles DROP COLUMN role_id;
ALTER TABLE user_roles RENAME COLUMN role_id_uuid TO role_id;

-- 6) Switch roles table to use UUID as primary key
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE roles DROP COLUMN id;
ALTER TABLE roles RENAME COLUMN id_uuid TO id;
ALTER TABLE roles ADD PRIMARY KEY (id);

-- 7) Recreate constraints on user_roles with UUID foreign key and composite primary key
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey
    PRIMARY KEY (user_id, role_id);

-- 8) Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roles_id ON roles(id);
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);

COMMIT;
