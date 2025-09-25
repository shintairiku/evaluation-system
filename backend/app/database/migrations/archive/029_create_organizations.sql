-- Create organizations table for Clerk organization integration
CREATE TABLE organizations (
    id VARCHAR(50) PRIMARY KEY,  -- Clerk organization ID
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add organization relationship to users table
ALTER TABLE users 
ADD COLUMN clerk_organization_id VARCHAR(50) REFERENCES organizations(id);

-- Add index for organization lookups
CREATE INDEX idx_users_clerk_organization_id ON users(clerk_organization_id);

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

-- Add index for domain lookups
CREATE INDEX idx_domain_settings_organization_id ON domain_settings(organization_id);
CREATE INDEX idx_domain_settings_domain ON domain_settings(domain);

-- Add trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to new tables
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_settings_updated_at 
    BEFORE UPDATE ON domain_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();