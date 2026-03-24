-- Migration: Add Form Template Tables
-- Story: 2.2.2 - Form Template Data Model and Versioning (Tenant-Isolated)
-- Date: 2026-01-21
--
-- This migration creates versioned, tenant-isolated form template tables:
-- - form_template: Container for versioned form templates
-- - form_template_version: Immutable versions of form templates
-- - form_section: Sections within a form template version
-- - form_field: Individual fields within a form section
--
-- Design Principles:
-- - All tables include tenant_id with CASCADE delete for multi-tenant isolation
-- - UUID primary keys for distributed systems and security
-- - Soft deletes (deleted_at) for audit trail preservation
-- - JSONB fields for flexible validation rules and field options
-- - Composite indexes starting with tenant_id for query performance
-- - Partial indexes (WHERE deleted_at IS NULL) to exclude soft-deleted records

-- ============================================================================
-- FORM_TEMPLATE TABLE
-- Container for form templates
-- Each template can have multiple versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for filtering templates by tenant and status
CREATE INDEX IF NOT EXISTS idx_form_template_tenant_status 
    ON form_template(tenant_id, status) 
    WHERE deleted_at IS NULL;

COMMENT ON TABLE form_template IS 'Container for versioned form templates';
COMMENT ON COLUMN form_template.tenant_id IS 'Foreign key to tenants table with CASCADE delete';
COMMENT ON COLUMN form_template.status IS 'Status: draft, published, archived';
COMMENT ON COLUMN form_template.deleted_at IS 'Soft delete timestamp for audit trail';

-- ============================================================================
-- FORM_TEMPLATE_VERSION TABLE
-- Immutable versions of form templates
-- Published versions cannot be edited (enforced at application level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_template_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_template(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint: prevent duplicate version numbers for same template
    CONSTRAINT uq_form_template_version_template_version 
        UNIQUE (form_template_id, version),
    
    -- CHECK constraint: is_published = true implies status = 'published'
    CONSTRAINT chk_form_template_version_published_status 
        CHECK (is_published = false OR (is_published = true AND status = 'published'))
);

-- Index for version lookups by tenant and template
CREATE INDEX IF NOT EXISTS idx_form_template_version_tenant_template_version 
    ON form_template_version(tenant_id, form_template_id, version) 
    WHERE deleted_at IS NULL;

-- Index for filtering versions by tenant and status
CREATE INDEX IF NOT EXISTS idx_form_template_version_tenant_status 
    ON form_template_version(tenant_id, status) 
    WHERE deleted_at IS NULL;

COMMENT ON TABLE form_template_version IS 'Immutable versions of form templates';
COMMENT ON COLUMN form_template_version.version IS 'Sequential version number (1, 2, 3, ...)';
COMMENT ON COLUMN form_template_version.is_published IS 'Whether this version is published (immutable)';
COMMENT ON CONSTRAINT uq_form_template_version_template_version ON form_template_version 
    IS 'Ensures unique version numbers per template';
COMMENT ON CONSTRAINT chk_form_template_version_published_status ON form_template_version 
    IS 'Ensures is_published = true only when status = published';

-- ============================================================================
-- FORM_SECTION TABLE
-- Sections within a form template version
-- Provides logical grouping of form fields
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_version_id UUID NOT NULL REFERENCES form_template_version(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    section_order INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for ordered section retrieval by tenant and version
CREATE INDEX IF NOT EXISTS idx_form_section_tenant_version_order 
    ON form_section(tenant_id, form_template_version_id, section_order) 
    WHERE deleted_at IS NULL;

COMMENT ON TABLE form_section IS 'Sections within a form template version for logical grouping';
COMMENT ON COLUMN form_section.section_order IS 'Display order within the form (1, 2, 3, ...)';
COMMENT ON COLUMN form_section.metadata IS 'JSONB field for future extensibility (icons, conditional display, etc.)';

-- ============================================================================
-- FORM_FIELD TABLE
-- Individual fields within a form section
-- Supports multiple field types with flexible validation
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_field (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_section_id UUID NOT NULL REFERENCES form_section(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    field_order INTEGER NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    placeholder TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    validation_rules JSONB NOT NULL DEFAULT '{}',
    options JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for ordered field retrieval by tenant and section
CREATE INDEX IF NOT EXISTS idx_form_field_tenant_section_order 
    ON form_field(tenant_id, form_section_id, field_order) 
    WHERE deleted_at IS NULL;

COMMENT ON TABLE form_field IS 'Individual fields within a form section';
COMMENT ON COLUMN form_field.field_order IS 'Display order within the section (1, 2, 3, ...)';
COMMENT ON COLUMN form_field.field_type IS 'Field type: text, textarea, number, date, dropdown, checkbox, multi_select';
COMMENT ON COLUMN form_field.validation_rules IS 'JSONB validation patterns: {minLength, maxLength, pattern, min, max, customMessage}';
COMMENT ON COLUMN form_field.options IS 'JSONB options for dropdown/multi_select: {choices: [{value, label}]}';

-- ============================================================================
-- EXAMPLE QUERIES FOR COMMON OPERATIONS
-- ============================================================================

-- Query 1: Get all active form templates for a tenant
-- SELECT * FROM form_template 
-- WHERE tenant_id = 'xxx' AND status = 'published' AND deleted_at IS NULL;

-- Query 2: Get latest version of a form template
-- SELECT * FROM form_template_version 
-- WHERE tenant_id = 'xxx' AND form_template_id = 'yyy' AND deleted_at IS NULL 
-- ORDER BY version DESC LIMIT 1;

-- Query 3: Get complete form structure (template -> sections -> fields)
-- SELECT t.*, v.*, s.*, f.*
-- FROM form_template t
-- JOIN form_template_version v ON t.id = v.form_template_id
-- LEFT JOIN form_section s ON v.id = s.form_template_version_id
-- LEFT JOIN form_field f ON s.id = f.form_section_id
-- WHERE t.tenant_id = 'xxx' AND v.id = 'yyy' AND t.deleted_at IS NULL
-- ORDER BY s.section_order, f.field_order;

-- Query 4: Count published versions per template
-- SELECT form_template_id, COUNT(*) as version_count
-- FROM form_template_version
-- WHERE tenant_id = 'xxx' AND is_published = true AND deleted_at IS NULL
-- GROUP BY form_template_id;

