-- =============================================================================
-- USER STATUS MANAGEMENT MIGRATION
-- =============================================================================
-- 
-- BACKGROUND:
-- This migration consolidates user status management by converting from PostgreSQL 
-- enum type to VARCHAR with application-level validation for better flexibility.
--
-- CHANGES:
-- 1. Adds 'pending_approval' status to support user approval workflow
-- 2. Converts PostgreSQL enum to VARCHAR(50) for simpler enum management
-- 3. Implements application-level enum validation via UserStatus Python enum
-- 4. Maintains data integrity with CHECK constraints
--
-- WORKFLOW:
-- pending_approval (user registers) → active (admin approves) → inactive (deactivated)
--
-- RATIONALE:
-- - Eliminates complex SQLAlchemy enum validation errors
-- - Allows easy addition of new statuses without database migrations
-- - Maintains type safety through Pydantic schema validation
-- - Follows principle of "simple approach" for maintainability
-- =============================================================================

-- Step 1: Add pending_approval to existing enum (if enum still exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status_enum') THEN
        -- Add the new enum value if enum exists
        ALTER TYPE user_status_enum ADD VALUE IF NOT EXISTS 'pending_approval';
    END IF;
END $$;

-- Step 2: Convert enum column to VARCHAR for flexibility
-- Add temporary column
ALTER TABLE users ADD COLUMN status_temp VARCHAR(50);

-- Copy data from existing column (whether enum or varchar)
UPDATE users SET status_temp = status::text;

-- Drop old column
ALTER TABLE users DROP COLUMN status;

-- Rename temp column to status
ALTER TABLE users RENAME COLUMN status_temp TO status;

-- Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN status SET NOT NULL;

-- Step 3: Add check constraint for valid values (maintains data integrity)
ALTER TABLE users ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'inactive', 'pending_approval'));

-- Step 4: Clean up enum type (no longer needed)
DROP TYPE IF EXISTS user_status_enum;

-- Step 5: Add documentation comments
COMMENT ON COLUMN users.status IS 'User status: pending_approval → active → inactive (managed by application UserStatus enum validation)';
COMMENT ON CONSTRAINT users_status_check ON users IS 'Ensures status values match application UserStatus enum values';