-- Additional Indexes and Constraints Migration
-- Performance optimizations and additional constraints not covered in main schema files
-- This migration adds supplementary indexes for common query patterns

-- Additional performance indexes for evaluation workflow queries
CREATE INDEX IF NOT EXISTS idx_evaluation_periods_status ON evaluation_periods(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_periods_dates ON evaluation_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_goals_approved_by ON goals(approved_by);
CREATE INDEX IF NOT EXISTS idx_goals_category_status ON goals(goal_category, status);
CREATE INDEX IF NOT EXISTS idx_self_assessments_status ON self_assessments(status);
CREATE INDEX IF NOT EXISTS idx_supervisor_reviews_action ON supervisor_reviews(action);
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_rating ON supervisor_feedback(rating);

-- Composite indexes for organization filtering with other common filters
CREATE INDEX IF NOT EXISTS idx_users_org_department ON users(clerk_organization_id, department_id);
CREATE INDEX IF NOT EXISTS idx_users_org_stage ON users(clerk_organization_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_users_org_status ON users(clerk_organization_id, status);

-- Indexes for supervisor relationship queries
CREATE INDEX IF NOT EXISTS idx_users_supervisors_dates ON users_supervisors(valid_from, valid_to);

-- Indexes for competency queries by organization and stage
CREATE INDEX IF NOT EXISTS idx_competencies_org_stage ON competencies(organization_id, stage_id);

-- Indexes for webhook event processing
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

-- Additional constraints for data integrity
-- Ensure evaluation period dates are logical
ALTER TABLE evaluation_periods
ADD CONSTRAINT chk_evaluation_period_dates
CHECK (start_date < end_date AND goal_submission_deadline <= evaluation_deadline);

-- Ensure goal weights are reasonable (0-100 scale)
ALTER TABLE goals
ADD CONSTRAINT chk_goal_weight
CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100));

-- Ensure ratings are on expected scale (1-5)
ALTER TABLE self_assessments
ADD CONSTRAINT chk_self_rating
CHECK (self_rating IS NULL OR (self_rating >= 1 AND self_rating <= 5));

ALTER TABLE supervisor_feedback
ADD CONSTRAINT chk_supervisor_rating
CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- Ensure status values are from expected set
ALTER TABLE users
ADD CONSTRAINT chk_user_status
CHECK (status IN ('active', 'inactive', 'pending'));

ALTER TABLE evaluation_periods
ADD CONSTRAINT chk_evaluation_period_status
CHECK (status IN ('draft', 'active', 'completed', 'cancelled'));

ALTER TABLE goals
ADD CONSTRAINT chk_goal_status
CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));

ALTER TABLE self_assessments
ADD CONSTRAINT chk_self_assessment_status
CHECK (status IN ('draft', 'submitted'));

ALTER TABLE supervisor_reviews
ADD CONSTRAINT chk_supervisor_review_status
CHECK (status IN ('draft', 'submitted'));

ALTER TABLE supervisor_feedback
ADD CONSTRAINT chk_supervisor_feedback_status
CHECK (status IN ('draft', 'submitted'));

-- Ensure supervisor review actions are valid
ALTER TABLE supervisor_reviews
ADD CONSTRAINT chk_supervisor_review_action
CHECK (action IN ('APPROVED', 'REJECTED', 'PENDING'));

-- Ensure domain verification status values
ALTER TABLE domain_settings
ADD CONSTRAINT chk_domain_verification_status
CHECK (verification_status IN ('pending', 'verified', 'failed'));