-- Organization System Migration
-- Creates multi-tenant organization support with Clerk integration
-- Includes organization-scoped data isolation and webhook tracking

-- Create organizations table for Clerk organization integration
CREATE TABLE organizations (
    id VARCHAR(50) PRIMARY KEY,  -- Clerk organization ID
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create domain settings table for auto-approval functionality
CREATE TABLE domain_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain VARCHAR(100) NOT NULL,
    auto_join_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Ensure unique domain per organization
    UNIQUE(organization_id, domain)
);

-- Create webhook_events table for idempotency tracking
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE SET NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add organization relationship to users table
ALTER TABLE users
ADD COLUMN clerk_organization_id VARCHAR(50) REFERENCES organizations(id);

-- Add organization_id columns to core tables for organization-scoped filtering
ALTER TABLE departments
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE roles
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE stages
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE competencies
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE evaluation_periods
ADD COLUMN organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- Add indexes for organization tables
CREATE INDEX idx_domain_settings_organization_id ON domain_settings(organization_id);
CREATE INDEX idx_domain_settings_domain ON domain_settings(domain);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_organization_id ON webhook_events(organization_id);

-- Add indexes for organization filtering performance on existing tables
CREATE INDEX idx_users_clerk_organization_id ON users(clerk_organization_id);
CREATE INDEX idx_departments_organization_id ON departments(organization_id);
CREATE INDEX idx_roles_organization_id ON roles(organization_id);
CREATE INDEX idx_stages_organization_id ON stages(organization_id);
CREATE INDEX idx_competencies_organization_id ON competencies(organization_id);
CREATE INDEX idx_evaluation_periods_organization_id ON evaluation_periods(organization_id);

-- Remove existing unique constraints that will be replaced with organization-scoped ones
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE stages DROP CONSTRAINT IF EXISTS stages_name_key;

-- Add organization-scoped unique constraints
ALTER TABLE departments ADD CONSTRAINT uq_departments_org_name UNIQUE (organization_id, name);
ALTER TABLE roles ADD CONSTRAINT uq_roles_org_name UNIQUE (organization_id, name);
ALTER TABLE stages ADD CONSTRAINT uq_stages_org_name UNIQUE (organization_id, name);

-- Apply updated_at triggers to organization tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_settings_updated_at
    BEFORE UPDATE ON domain_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();