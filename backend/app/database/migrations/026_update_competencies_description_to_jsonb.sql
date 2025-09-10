-- Migration to change competencies.description from TEXT to JSONB
-- This allows storing 5 sub-items as a JSON object with keys "1", "2", "3", "4", "5"

-- First, add a new column with JSONB type
ALTER TABLE competencies ADD COLUMN ideal_actions JSONB;

-- Migrate existing text descriptions to JSONB format
-- If description exists, wrap it in a JSON object with key "1"
UPDATE competencies 
SET ideal_actions = jsonb_build_object('1', description)
WHERE description IS NOT NULL AND description != '';

-- For empty descriptions, set to null
UPDATE competencies 
SET ideal_actions = NULL
WHERE description IS NULL OR description = '';

-- Drop the old TEXT column
ALTER TABLE competencies DROP COLUMN description;

-- Rename the new column to description (keeping description as the column name)
ALTER TABLE competencies RENAME COLUMN ideal_actions TO description;

-- Add a check constraint to ensure the JSONB has the correct structure
-- The description should be either NULL or an object with keys "1" through "5"
ALTER TABLE competencies ADD CONSTRAINT check_description_structure 
CHECK (
    description IS NULL OR 
    (jsonb_typeof(description) = 'object' AND 
     (description ? '1' OR description ? '2' OR description ? '3' OR description ? '4' OR description ? '5'))
);