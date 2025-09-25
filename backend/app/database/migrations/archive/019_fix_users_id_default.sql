-- Fix UUID default generation for all tables with UUID primary keys
-- This ensures all tables get automatic UUID generation for new records

-- First enable the pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add UUID defaults to tables that are missing them
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE departments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE stages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE competencies ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE evaluation_periods ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE goals ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE supervisor_reviews ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE self_assessments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE supervisor_feedback ALTER COLUMN id SET DEFAULT gen_random_uuid();