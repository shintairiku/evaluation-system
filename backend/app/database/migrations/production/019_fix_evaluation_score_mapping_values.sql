-- Migration: Fix evaluation_score_mapping values to match stakeholder-approved scale
-- PR #467's migration 018 seeded A=5, B=4, C=3, D=2
-- Approved scale: A=4, B=2, C=1, D=0
-- Idempotent: WHERE clauses ensure only wrong values are updated

UPDATE evaluation_score_mapping SET score_value = 4.0 WHERE rating_code = 'A' AND score_value = 5.0;
UPDATE evaluation_score_mapping SET score_value = 2.0 WHERE rating_code = 'B' AND score_value = 4.0;
UPDATE evaluation_score_mapping SET score_value = 1.0 WHERE rating_code = 'C' AND score_value = 3.0;
UPDATE evaluation_score_mapping SET score_value = 0.0 WHERE rating_code = 'D' AND score_value = 2.0;

-- ============================================================
-- Repair persisted numeric values in assessment tables
-- Reuses migration 018 step 4 logic; now reads corrected mapping values
-- Idempotent: IS DISTINCT FROM skips rows already correct
-- ============================================================
UPDATE self_assessments sa
SET self_rating = esm.score_value
FROM goals g
JOIN users u ON u.id = g.user_id
JOIN evaluation_score_mapping esm
    ON esm.organization_id = u.clerk_organization_id
   AND esm.is_active = TRUE
WHERE sa.goal_id = g.id
  AND sa.self_rating_code IS NOT NULL
  AND esm.rating_code = sa.self_rating_code
  AND sa.self_rating IS DISTINCT FROM esm.score_value;

UPDATE supervisor_feedback sf
SET supervisor_rating = esm.score_value
FROM self_assessments sa
JOIN goals g ON g.id = sa.goal_id
JOIN users u ON u.id = g.user_id
JOIN evaluation_score_mapping esm
    ON esm.organization_id = u.clerk_organization_id
   AND esm.is_active = TRUE
WHERE sf.self_assessment_id = sa.id
  AND sf.supervisor_rating_code IS NOT NULL
  AND esm.rating_code = sf.supervisor_rating_code
  AND sf.supervisor_rating IS DISTINCT FROM esm.score_value;
