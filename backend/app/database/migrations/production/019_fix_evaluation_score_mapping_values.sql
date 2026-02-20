-- Migration: Fix evaluation_score_mapping values to match stakeholder-approved scale
-- PR #467's migration 018 seeded A=5, B=4, C=3, D=2
-- Approved scale: A=4, B=2, C=1, D=0
-- Idempotent: WHERE clauses ensure only wrong values are updated

UPDATE evaluation_score_mapping SET score_value = 4.0 WHERE rating_code = 'A' AND score_value = 5.0;
UPDATE evaluation_score_mapping SET score_value = 2.0 WHERE rating_code = 'B' AND score_value = 4.0;
UPDATE evaluation_score_mapping SET score_value = 1.0 WHERE rating_code = 'C' AND score_value = 3.0;
UPDATE evaluation_score_mapping SET score_value = 0.0 WHERE rating_code = 'D' AND score_value = 2.0;
