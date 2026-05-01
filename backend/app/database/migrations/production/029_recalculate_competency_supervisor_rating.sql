-- 029_recalculate_competency_supervisor_rating.sql
--
-- Recalculate supervisor_feedback.supervisor_rating for all コンピテンシー
-- feedbacks using the 2-step average required by the spec (section 5-7,
-- "システム推奨実装：2段階平均方式"):
--   Step 1: average action ratings within each competency.
--   Step 2: simple (unweighted) average of the per-competency averages.
--
-- Why: the previous implementation flat-averaged every action rating across
-- all competencies in one bucket. Spec lines 437-438 and 446 reject that
-- approach because competencies with more actions disproportionately
-- influence the score. This migration brings historical rows in line with
-- the new backend logic in supervisor_feedback_repo._calculate_supervisor_rating_from_rating_data.
--
-- Scope: only rows joined to コンピテンシー goals with a non-empty object
-- rating_data are touched. Rows for 業績目標 / コアバリュー / null /
-- empty rating_data are not affected.

WITH competency_avgs AS (
    SELECT
        sf.id AS feedback_id,
        comp.key AS comp_id,
        AVG(esm.score_value) AS comp_avg
    FROM supervisor_feedback sf
    JOIN self_assessments sa ON sa.id = sf.self_assessment_id
    JOIN goals g ON g.id = sa.goal_id
    JOIN users u ON u.id = g.user_id
    CROSS JOIN LATERAL jsonb_each(sf.rating_data) AS comp(key, value)
    CROSS JOIN LATERAL jsonb_each_text(comp.value) AS act(idx, code)
    JOIN evaluation_score_mapping esm
       ON esm.rating_code = UPPER(TRIM(act.code))
      AND esm.organization_id = u.clerk_organization_id
    WHERE g.goal_category = 'コンピテンシー'
      AND jsonb_typeof(sf.rating_data) = 'object'
      AND sf.rating_data::text <> '{}'
      AND act.code IS NOT NULL
      AND TRIM(act.code) <> ''
    GROUP BY sf.id, comp.key
),
goal_avgs AS (
    SELECT
        feedback_id,
        AVG(comp_avg) AS goal_avg
    FROM competency_avgs
    GROUP BY feedback_id
)
UPDATE supervisor_feedback sf
SET supervisor_rating = ROUND(ga.goal_avg::numeric, 2),
    updated_at = NOW()
FROM goal_avgs ga
WHERE sf.id = ga.feedback_id
  AND (
      sf.supervisor_rating IS NULL
   OR sf.supervisor_rating IS DISTINCT FROM ROUND(ga.goal_avg::numeric, 2)
  );
