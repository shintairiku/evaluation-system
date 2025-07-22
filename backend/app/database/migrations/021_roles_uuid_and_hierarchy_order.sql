-- Migration: Convert roles.id to UUID, add hierarchy_order, timestamps, and update user_roles references
-- Assumptions: current roles.id is smallint/integer primary key, user_roles.role_id references roles.id (integer)
-- This migration will:
--   1. Drop foreign key constraints first
--   2. Rename existing id column to hierarchy_order (INTEGER)
--   3. Add new id column (UUID, default gen_random_uuid()) as primary key
--   4. Add created_at and updated_at timestamp columns
--   5. Ensure name is UNIQUE and hierarchy_order is UNIQUE
--   6. Update user_roles table to use UUID foreign key
--   7. Insert parttime role with highest hierarchy_order
--   8. Add helpful indexes

-- Wrap in transaction
BEGIN;

-- 1) Drop foreign key constraints from user_roles first
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

-- 2) Rename id to hierarchy_order and adjust type if necessary
ALTER TABLE roles RENAME COLUMN id TO hierarchy_order;
ALTER TABLE roles ALTER COLUMN hierarchy_order TYPE INTEGER USING hierarchy_order::INTEGER;

-- 3) Add UUID id column and make it primary key
ALTER TABLE roles ADD COLUMN id UUID DEFAULT gen_random_uuid();
ALTER TABLE roles ALTER COLUMN id SET NOT NULL;

-- Drop old primary key and create new one on id
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE roles ADD PRIMARY KEY (id);

-- 4) Add timestamp columns
ALTER TABLE roles ADD COLUMN created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
ALTER TABLE roles ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- 5) Add constraints on name and hierarchy_order
-- Add unique constraint on name (drop first if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_name_unique') THEN
        ALTER TABLE roles DROP CONSTRAINT roles_name_unique;
    END IF;
END $$;
ALTER TABLE roles ADD CONSTRAINT roles_name_unique UNIQUE (name);

-- Add unique constraint on hierarchy_order
ALTER TABLE roles ADD CONSTRAINT roles_hierarchy_order_unique UNIQUE (hierarchy_order);

-- 6) Update user_roles table to reference UUID
-- 6a) Add new column
ALTER TABLE user_roles ADD COLUMN role_id_uuid UUID;

-- 6b) Populate new column by joining on hierarchy_order (old id)
UPDATE user_roles ur
SET role_id_uuid = r.id
FROM roles r
WHERE r.hierarchy_order = ur.role_id;

-- 6c) Remove old role_id column, rename new column
ALTER TABLE user_roles DROP COLUMN role_id;
ALTER TABLE user_roles RENAME COLUMN role_id_uuid TO role_id;

-- 6d) Recreate composite primary key and foreign key with UUID
ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);
ALTER TABLE user_roles ADD FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

-- 7) Insert parttime role with hierarchy_order 6
INSERT INTO roles (hierarchy_order, name, description)
VALUES (6, 'parttime', 'パートタイム')
ON CONFLICT (name) DO NOTHING;

-- 8) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_roles_name_lower ON roles (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy_order ON roles (hierarchy_order);

COMMIT; 