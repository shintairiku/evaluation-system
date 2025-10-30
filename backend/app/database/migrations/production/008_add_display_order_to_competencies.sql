-- Migration: Add display_order column to competencies table
-- Purpose: Enable custom ordering of competencies within each stage
-- Author: System
-- Date: 2025-10-30

-- Add display_order column (nullable for backward compatibility)
ALTER TABLE competencies
ADD COLUMN display_order INTEGER;

-- Add index for performance optimization
CREATE INDEX idx_competencies_display_order
ON competencies(display_order);

-- Add comment to document the column purpose
COMMENT ON COLUMN competencies.display_order IS
'Display order of competency within its stage (1-6). Values: 1=Philosophy, 2=Attitude, 3=Mindset, 4=Skills, 5=Growth, 6=Management';
