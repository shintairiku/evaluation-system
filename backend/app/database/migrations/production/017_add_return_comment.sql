-- Migration: Add return_comment column to supervisor_feedback
-- Used by the "return for correction" (差し戻し) feature.
-- Stores feedback from supervisor visible to the subordinate when requesting corrections.

ALTER TABLE supervisor_feedback
    ADD COLUMN return_comment TEXT;
