-- Migration: Backfill supervisor_feedback.supervisor_rating for competency feedback
-- Purpose:
--   Competency feedback stores per-action grades in rating_data and often has no supervisor_rating_code.
--   This migration derives supervisor_rating as the average mapped score across all rated actions.

WITH action_scores AS (
  SELECT
    sf.id AS feedback_id,
    AVG(
      COALESCE(
        esm.score_value,
        CASE action.rating_code
          WHEN 'SS' THEN 7.0
          WHEN 'S' THEN 6.0
          WHEN 'A' THEN 4.0
          WHEN 'B' THEN 2.0
          WHEN 'C' THEN 1.0
          WHEN 'D' THEN 0.0
          ELSE NULL
        END
      )
    )::numeric AS avg_score
  FROM supervisor_feedback sf
  JOIN self_assessments sa
    ON sa.id = sf.self_assessment_id
  JOIN goals g
    ON g.id = sa.goal_id
  JOIN users u
    ON u.id = g.user_id
  JOIN LATERAL jsonb_each(
    CASE
      WHEN jsonb_typeof(sf.rating_data) = 'object' THEN sf.rating_data
      ELSE '{}'::jsonb
    END
  ) competency(comp_key, action_map)
    ON TRUE
  JOIN LATERAL jsonb_each_text(
    CASE
      WHEN jsonb_typeof(competency.action_map) = 'object' THEN competency.action_map
      ELSE '{}'::jsonb
    END
  ) action(action_key, rating_code)
    ON TRUE
  LEFT JOIN evaluation_score_mapping esm
    ON esm.organization_id = u.clerk_organization_id
    AND esm.rating_code = action.rating_code
    AND esm.is_active = TRUE
  WHERE g.goal_category = 'コンピテンシー'
    AND sf.supervisor_rating_code IS NULL
    AND sf.rating_data IS NOT NULL
  GROUP BY sf.id
)
UPDATE supervisor_feedback sf
SET supervisor_rating = ROUND(action_scores.avg_score, 2)
FROM action_scores
WHERE sf.id = action_scores.feedback_id
  AND sf.supervisor_rating IS DISTINCT FROM ROUND(action_scores.avg_score, 2);
