-- 010_add_stage_weight_columns.sql
-- Adds quantitative/qualitative/competency weight columns to stages
-- and seeds default values per current policy.

ALTER TABLE stages
    ADD COLUMN quantitative_weight DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN qualitative_weight DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN competency_weight DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE stages
    ADD CONSTRAINT chk_stages_quantitative_weight_range
        CHECK (quantitative_weight >= 0 AND quantitative_weight <= 100),
    ADD CONSTRAINT chk_stages_qualitative_weight_range
        CHECK (qualitative_weight >= 0 AND qualitative_weight <= 100),
    ADD CONSTRAINT chk_stages_competency_weight_range
        CHECK (competency_weight >= 0 AND competency_weight <= 100);

-- Stage 1-3: 70 / 30 / 10
UPDATE stages
SET
    quantitative_weight = 70,
    qualitative_weight = 30,
    competency_weight = 10
WHERE name LIKE 'Stage1:%'
   OR name LIKE 'Stage2:%'
   OR name LIKE 'Stage3:%';

-- Stage 4-5: 80 / 20 / 10
UPDATE stages
SET
    quantitative_weight = 80,
    qualitative_weight = 20,
    competency_weight = 10
WHERE name LIKE 'Stage4:%'
   OR name LIKE 'Stage5:%';

-- Stage 6-9: 100 / 0 / 10
UPDATE stages
SET
    quantitative_weight = 100,
    qualitative_weight = 0,
    competency_weight = 10
WHERE name LIKE 'Stage6:%'
   OR name LIKE 'Stage7:%'
   OR name LIKE 'Stage8:%'
   OR name LIKE 'Stage9:%';

-- Any remaining stages fallback to 70 / 30 / 10
UPDATE stages
SET
    quantitative_weight = 70,
    qualitative_weight = 30,
    competency_weight = 10
WHERE (quantitative_weight = 0 AND qualitative_weight = 0 AND competency_weight = 0);
