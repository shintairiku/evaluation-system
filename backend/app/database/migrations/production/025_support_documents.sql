-- Support Documents table for storing links and files (Phase 2) that help users
-- during evaluation filling (e.g., competency criteria, manuals, external references).
-- Documents are scoped per organization; NULL organization_id = system-wide.

CREATE TABLE support_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(10) NOT NULL DEFAULT 'link' CHECK (document_type IN ('link', 'file')),
    url TEXT,
    file_path TEXT,
    file_name TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_doc_content CHECK (
        (document_type = 'link' AND url IS NOT NULL) OR
        (document_type = 'file' AND file_path IS NOT NULL)
    )
);

CREATE INDEX idx_support_docs_org ON support_documents(organization_id);
CREATE INDEX idx_support_docs_org_category ON support_documents(organization_id, category, display_order);
