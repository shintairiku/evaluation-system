-- 014_update_self_assessment_backfill.sql
-- Fixes latest approved goals view to honor previous_goal_id chains and backfills textual ratings.

-- Recreate view using previous_goal_id to pick the terminal approved goal in each chain
CREATE OR REPLACE VIEW latest_approved_goals AS
WITH approved_goals AS (
    SELECT
        g.*,
        u.clerk_organization_id AS organization_id
    FROM goals g
    JOIN users u ON u.id = g.user_id
    WHERE g.status = 'approved'
),
latest_in_chain AS (
    SELECT ag.*
    FROM approved_goals ag
    WHERE NOT EXISTS (
        SELECT 1 FROM approved_goals child WHERE child.previous_goal_id = ag.id
    )
),
ranked AS (
    SELECT
        lic.*,
        ROW_NUMBER() OVER (
            PARTITION BY lic.user_id, lic.period_id, lic.goal_category
            ORDER BY lic.created_at DESC
        ) AS rn
    FROM latest_in_chain lic
)
SELECT * FROM ranked WHERE rn = 1;

ALTER VIEW latest_approved_goals OWNER TO postgres;

-- Backfill self_rating_text based on existing numeric scores for legacy drafts
UPDATE self_assessments
SET self_rating_text = CASE
    WHEN self_rating >= 6.5 THEN 'SS'
    WHEN self_rating >= 5.5 THEN 'S'
    WHEN self_rating >= 4.5 THEN 'A+'
    WHEN self_rating >= 3.7 THEN 'A'
    WHEN self_rating >= 2.7 THEN 'A-'
    WHEN self_rating >= 1.7 THEN 'B'
    WHEN self_rating >= 1.0 THEN 'C'
    ELSE 'D'
END
WHERE self_rating_text IS NULL
  AND self_rating IS NOT NULL;
