-- Add organization_id columns to tables for organization-scoped filtering
-- Task 5.1: Organization filtering implementation

-- Add organization_id to departments table
ALTER TABLE departments 
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to roles table  
ALTER TABLE roles
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to stages table
ALTER TABLE stages
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to competencies table
ALTER TABLE competencies
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to evaluation_periods table
ALTER TABLE evaluation_periods
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to webhook_events table (nullable for system-wide events)
ALTER TABLE webhook_events
ADD COLUMN organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE SET NULL;

-- Create indexes for organization filtering performance
CREATE INDEX idx_departments_organization_id ON departments(organization_id);
CREATE INDEX idx_roles_organization_id ON roles(organization_id);
CREATE INDEX idx_stages_organization_id ON stages(organization_id);
CREATE INDEX idx_competencies_organization_id ON competencies(organization_id);
CREATE INDEX idx_evaluation_periods_organization_id ON evaluation_periods(organization_id);
CREATE INDEX idx_webhook_events_organization_id ON webhook_events(organization_id);

-- Add unique constraints for names within organizations
-- Drop existing unique constraints first
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE stages DROP CONSTRAINT IF EXISTS stages_name_key;

-- Add organization-scoped unique constraints
ALTER TABLE departments ADD CONSTRAINT uq_departments_org_name UNIQUE (organization_id, name);
ALTER TABLE roles ADD CONSTRAINT uq_roles_org_name UNIQUE (organization_id, name);
ALTER TABLE stages ADD CONSTRAINT uq_stages_org_name UNIQUE (organization_id, name);

-- Add indexes for JOIN operations (performance optimization for task 5.1)
-- These improve JOIN performance for organization filtering via relationships
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_self_assessments_goal_id ON self_assessments(goal_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_reviews_goal_id ON supervisor_reviews(goal_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_feedback_self_assessment_id ON supervisor_feedback(self_assessment_id);

-- Ensure users.clerk_organization_id index exists (required for all filtering patterns)
CREATE INDEX IF NOT EXISTS idx_users_clerk_organization_id ON users(clerk_organization_id);