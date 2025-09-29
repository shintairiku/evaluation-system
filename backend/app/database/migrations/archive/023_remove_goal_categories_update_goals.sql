-- Remove goal_categories table and update goals table
-- Replace goal_category_id with goal_category string field

-- First, update goals table to add string category field
ALTER TABLE goals ADD COLUMN goal_category VARCHAR(100);

-- Migrate existing data (update with appropriate category names)
UPDATE goals SET goal_category = 
  CASE 
    WHEN goal_category_id = 1 THEN 'Performance'
    WHEN goal_category_id = 2 THEN 'Competency' 
    WHEN goal_category_id = 3 THEN 'Core Value'
    ELSE 'Other'
  END;

-- Remove the foreign key constraint and drop the old column
ALTER TABLE goals DROP CONSTRAINT IF EXISTS fk_goals_goal_category_id;
ALTER TABLE goals DROP COLUMN goal_category_id;

-- Drop the goal_categories table
DROP TABLE IF EXISTS goal_categories;