-- Migration: Allow performance final rank in comprehensive decision rule fields
-- Purpose:
-- - Add performanceFinalRank as a valid field_name for comprehensive decision rules

BEGIN;

ALTER TABLE comprehensive_decision_rules
    DROP CONSTRAINT IF EXISTS chk_comprehensive_decision_rules_field;

ALTER TABLE comprehensive_decision_rules
    ADD CONSTRAINT chk_comprehensive_decision_rules_field
    CHECK (
        field_name IN (
            'overallRank',
            'performanceFinalRank',
            'competencyFinalRank',
            'coreValueFinalRank'
        )
    );

COMMIT;
