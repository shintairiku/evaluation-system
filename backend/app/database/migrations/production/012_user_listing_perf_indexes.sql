-- Hotfix & performance: add supporting indexes for user listing
-- Created on 2025-11-06

-- Ensure pg_trgm is available for trigram indexes (safe no-op if already installed)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users table supporting indexes for frequent filters
CREATE INDEX IF NOT EXISTS idx_users_clerk_organization_id ON users(clerk_organization_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_stage_id ON users(stage_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Role assignments quick lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Optional text search acceleration (used by LIKE/ILIKE filters)
CREATE INDEX IF NOT EXISTS idx_users_lower_name_trgm ON users USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_lower_email_trgm ON users USING gin (lower(email) gin_trgm_ops);
