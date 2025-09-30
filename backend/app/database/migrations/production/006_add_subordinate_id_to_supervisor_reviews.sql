-- Add subordinate_id column to supervisor_reviews table
-- This allows direct filtering of reviews by subordinate without joining goals table

-- Add the subordinate_id column
ALTER TABLE supervisor_reviews
ADD COLUMN subordinate_id UUID;

-- Populate existing records with subordinate_id from goals table
UPDATE supervisor_reviews sr
SET subordinate_id = g.user_id
FROM goals g
WHERE sr.goal_id = g.id;

-- Make the column NOT NULL after populating existing data
ALTER TABLE supervisor_reviews
ALTER COLUMN subordinate_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE supervisor_reviews
ADD CONSTRAINT fk_supervisor_reviews_subordinate
FOREIGN KEY (subordinate_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add index for better query performance on subordinate filtering
CREATE INDEX idx_supervisor_reviews_subordinate_id
ON supervisor_reviews(subordinate_id);

-- Add composite index for common query pattern (supervisor viewing subordinate reviews)
CREATE INDEX idx_supervisor_reviews_supervisor_subordinate
ON supervisor_reviews(supervisor_id, subordinate_id);

-- Add comment for documentation
COMMENT ON COLUMN supervisor_reviews.subordinate_id IS 'ID of the subordinate whose goal is being reviewed';