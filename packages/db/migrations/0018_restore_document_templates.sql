-- Migration: Restore Document Templates (formerly Qualification Templates)
-- Story: 2.2.11 - Restore Document Templates
-- Date: 2026-02-01
-- Description: Restores document template functionality that was removed in migration 0017
--              Renamed from "qualification_templates" to "document_template" for clarity

-- =============================================================================
-- FORWARD MIGRATION
-- =============================================================================

-- ========================================
-- Step 1: Create document_template table
-- ========================================
CREATE TABLE document_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  template_name VARCHAR(200) NOT NULL,
  required_documents JSONB DEFAULT '[]'::jsonb NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add table comment
COMMENT ON TABLE document_template IS 'Reusable document checklist templates for workflow steps. Defines required documents for upload/validation steps.';

-- Add column comments
COMMENT ON COLUMN document_template.id IS 'Unique identifier for document template';
COMMENT ON COLUMN document_template.tenant_id IS 'Foreign key to tenants table - ensures tenant isolation';
COMMENT ON COLUMN document_template.template_name IS 'Human-readable name for template (e.g., "ISO Certification Documents")';
COMMENT ON COLUMN document_template.required_documents IS 'JSONB array of document definitions: [{ name, description, required, type }]';
COMMENT ON COLUMN document_template.is_default IS 'Flag indicating if this is the default template for the tenant';
COMMENT ON COLUMN document_template.status IS 'Template lifecycle status: draft, published, archived';
COMMENT ON COLUMN document_template.deleted_at IS 'Soft delete timestamp - NULL means active';

-- ========================================
-- Step 2: Add Foreign Key Constraints
-- ========================================

-- FK: tenant_id → tenants.id (CASCADE delete)
ALTER TABLE document_template
ADD CONSTRAINT fk_document_template_tenant
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_document_template_tenant ON document_template IS 'Ensures template is deleted when tenant is removed';

-- ========================================
-- Step 3: Create Indexes
-- ========================================

-- Index for tenant + status filtering (published templates)
CREATE INDEX idx_document_template_tenant_status
ON document_template(tenant_id, status)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_document_template_tenant_status IS 'Index for filtering published templates by tenant - used in workflow builder dropdown';

-- Index for default template lookup
CREATE INDEX idx_document_template_tenant_default
ON document_template(tenant_id, is_default);

COMMENT ON INDEX idx_document_template_tenant_default IS 'Index for quickly finding default template for a tenant';

-- ========================================
-- Step 4: Restore workflow_step_template fields
-- ========================================

-- Add document_template_id column (FK to document_template)
ALTER TABLE workflow_step_template
ADD COLUMN document_template_id UUID;

COMMENT ON COLUMN workflow_step_template.document_template_id IS 'Foreign key to document_template - defines which document checklist to use for this step';

-- Add document_action_mode column (enum: upload, validate)
-- Using varchar instead of enum for flexibility (can add more modes later)
ALTER TABLE workflow_step_template
ADD COLUMN document_action_mode VARCHAR(50);

COMMENT ON COLUMN workflow_step_template.document_action_mode IS 'Document step behavior: upload (user uploads documents) or validate (user reviews/approves documents)';

-- Add FK constraint: workflow_step_template.document_template_id → document_template.id
ALTER TABLE workflow_step_template
ADD CONSTRAINT fk_workflow_step_document_template
FOREIGN KEY (document_template_id)
REFERENCES document_template(id)
ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_workflow_step_document_template ON workflow_step_template IS 'Prevents deletion of document templates in use by workflow steps (ON DELETE RESTRICT)';

-- ========================================
-- Step 5: Create Index on workflow_step_template
-- ========================================

-- Index for tracking which workflow steps use each document template
CREATE INDEX idx_workflow_step_template_document_template
ON workflow_step_template(document_template_id)
WHERE deleted_at IS NULL AND document_template_id IS NOT NULL;

COMMENT ON INDEX idx_workflow_step_template_document_template IS 'Index for usage tracking - shows which workflow steps reference each document template';

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- =============================================================================

-- Verify document_template table exists
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'document_template';
-- Expected: 1 row

-- Verify columns exist
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'document_template'
-- ORDER BY ordinal_position;
-- Expected: 9 rows (id, tenant_id, template_name, required_documents, is_default, status, created_at, updated_at, deleted_at)

-- Verify workflow_step_template columns restored
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'workflow_step_template' 
-- AND column_name IN ('document_template_id', 'document_action_mode');
-- Expected: 2 rows

-- Verify indexes exist
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('document_template', 'workflow_step_template')
-- AND indexname LIKE '%document%';
-- Expected: 3 rows

-- Verify FK constraints
-- SELECT conname, conrelid::regclass, confrelid::regclass, confdeltype
-- FROM pg_constraint 
-- WHERE conname IN ('fk_document_template_tenant', 'fk_workflow_step_document_template');
-- Expected: 2 rows

-- =============================================================================
-- ROLLBACK SCRIPT
-- =============================================================================

-- To rollback this migration, execute the following SQL:

/*

-- Drop FK constraint from workflow_step_template
ALTER TABLE workflow_step_template
DROP CONSTRAINT IF EXISTS fk_workflow_step_document_template;

-- Drop index on workflow_step_template
DROP INDEX IF EXISTS idx_workflow_step_template_document_template;

-- Drop columns from workflow_step_template
ALTER TABLE workflow_step_template
DROP COLUMN IF EXISTS document_action_mode;

ALTER TABLE workflow_step_template
DROP COLUMN IF EXISTS document_template_id;

-- Drop indexes on document_template
DROP INDEX IF EXISTS idx_document_template_tenant_default;
DROP INDEX IF EXISTS idx_document_template_tenant_status;

-- Drop document_template table (CASCADE will drop FK constraints)
DROP TABLE IF EXISTS document_template CASCADE;

*/

