-- Migration: Repair rating values from rating codes after 015 rollout
-- Purpose:
-- - 015 was already applied in existing environments.
-- - Ensure persisted numeric ratings are consistent with rating codes
--   for rows that may have been incorrectly scaled.

-- 1. self_assessments: recompute self_rating from self_rating_code
UPDATE self_assessments
SET self_rating = CASE self_rating_code
    WHEN 'SS' THEN 7.0
    WHEN 'S' THEN 6.0
    WHEN 'A' THEN 5.0
    WHEN 'B' THEN 4.0
    WHEN 'C' THEN 3.0
    WHEN 'D' THEN 2.0
    ELSE self_rating
END
WHERE self_rating_code IS NOT NULL
  AND self_rating IS DISTINCT FROM (
    CASE self_rating_code
      WHEN 'SS' THEN 7.0
      WHEN 'S' THEN 6.0
      WHEN 'A' THEN 5.0
      WHEN 'B' THEN 4.0
      WHEN 'C' THEN 3.0
      WHEN 'D' THEN 2.0
      ELSE self_rating
    END
  );

-- 2. supervisor_feedback: recompute supervisor_rating from supervisor_rating_code
UPDATE supervisor_feedback
SET supervisor_rating = CASE supervisor_rating_code
    WHEN 'SS' THEN 7.0
    WHEN 'S' THEN 6.0
    WHEN 'A' THEN 5.0
    WHEN 'B' THEN 4.0
    WHEN 'C' THEN 3.0
    WHEN 'D' THEN 2.0
    ELSE supervisor_rating
END
WHERE supervisor_rating_code IS NOT NULL
  AND supervisor_rating IS DISTINCT FROM (
    CASE supervisor_rating_code
      WHEN 'SS' THEN 7.0
      WHEN 'S' THEN 6.0
      WHEN 'A' THEN 5.0
      WHEN 'B' THEN 4.0
      WHEN 'C' THEN 3.0
      WHEN 'D' THEN 2.0
      ELSE supervisor_rating
    END
  );
