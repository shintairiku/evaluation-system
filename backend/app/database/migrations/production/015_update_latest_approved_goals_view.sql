-- 015_update_latest_approved_goals_view.sql
-- Ensure all terminal approved goals are returned (no category-based dedup).

DROP VIEW IF EXISTS latest_approved_goals;

CREATE VIEW latest_approved_goals AS
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
)
SELECT * FROM latest_in_chain;

ALTER VIEW latest_approved_goals OWNER TO postgres;
