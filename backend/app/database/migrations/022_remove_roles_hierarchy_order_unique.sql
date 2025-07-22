-- Migration: Remove unique constraint on roles.hierarchy_order to allow reordering without conflicts
-- This allows temporary duplicates during role reordering operations
-- The application logic will ensure final hierarchy_order values are unique and sequential

BEGIN;

-- Drop the unique constraint on hierarchy_order
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_hierarchy_order_unique;

-- Keep the index for performance (non-unique)
-- The index already exists from the previous migration, so we don't need to recreate it

COMMIT;