-- Migration 020: Enhance Roles Table for Task #73
-- Adds code, permissions, parent_id, timestamps and constraints to roles table

-- Step 1: Add new columns to roles table
ALTER TABLE roles 
ADD COLUMN code VARCHAR(20),
ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN parent_id SMALLINT,
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Update description to be NOT NULL (if it isn't already)
ALTER TABLE roles 
ALTER COLUMN description SET NOT NULL;

-- Step 3: Add foreign key constraint for parent_id (self-referencing)
ALTER TABLE roles
ADD CONSTRAINT fk_roles_parent_id 
FOREIGN KEY (parent_id) REFERENCES roles(id) ON DELETE CASCADE;

-- Step 4: Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 5: Create trigger to automatically update updated_at
CREATE TRIGGER update_roles_updated_at 
BEFORE UPDATE ON roles 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Populate code field for existing roles (if any)
-- These should match the actual role codes used in the system
UPDATE roles SET code = UPPER(name) WHERE code IS NULL;

-- Step 7: Add constraints after populating data
ALTER TABLE roles 
ALTER COLUMN code SET NOT NULL,
ADD CONSTRAINT uk_roles_code UNIQUE (code),
ADD CONSTRAINT uk_roles_name UNIQUE (name);

-- Step 8: Add check constraint for code format (uppercase only)
ALTER TABLE roles 
ADD CONSTRAINT chk_roles_code_uppercase 
CHECK (code = UPPER(code) AND code ~ '^[A-Z_]+$');

-- Step 9: Add comment to document the enhanced table
COMMENT ON TABLE roles IS 'Enhanced roles table with hierarchical support and permissions (Task #73)';
COMMENT ON COLUMN roles.code IS 'Unique uppercase role code (e.g., ADMIN, MANAGER)';
COMMENT ON COLUMN roles.permissions IS 'JSON array of permission strings';
COMMENT ON COLUMN roles.parent_id IS 'Self-referencing parent role for hierarchy';
COMMENT ON COLUMN roles.created_at IS 'Timestamp when role was created';
COMMENT ON COLUMN roles.updated_at IS 'Timestamp when role was last updated'; 