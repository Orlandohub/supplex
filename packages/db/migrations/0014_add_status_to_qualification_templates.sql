-- Migration: Add status column to qualification_templates and FK constraint to workflow_step_template
-- Description: Connects document templates to qualification_templates table
-- Date: 2026-01-26
-- Story: 2.2.7.3

-- =============================================================================
-- FORWARD MIGRATION
-- =============================================================================

-- Step 1: Add status column to qualification_templates
ALTER TABLE qualification_templates
ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'published';

COMMENT ON COLUMN qualification_templates.status IS 'Template lifecycle status: draft, published, archived';

-- Step 2: Update existing records to published status
UPDATE qualification_templates
SET status = 'published'
WHERE deleted_at IS NULL;

-- Step 3: Create index for (tenant_id, status) filtering
CREATE INDEX idx_qualification_templates_tenant_status
ON qualification_templates(tenant_id, status)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_qualification_templates_tenant_status IS 'Index for filtering published templates by tenant';

-- Step 4: Add FK constraint from workflow_step_template.document_template_id to qualification_templates.id
ALTER TABLE workflow_step_template
ADD CONSTRAINT fk_workflow_step_document_template
FOREIGN KEY (document_template_id)
REFERENCES qualification_templates(id)
ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_workflow_step_document_template ON workflow_step_template IS 'Prevents deletion of qualification templates in use by workflow steps';

-- Step 5: Add index on workflow_step_template.document_template_id for usage tracking
CREATE INDEX idx_workflow_step_template_document_template
ON workflow_step_template(document_template_id)
WHERE deleted_at IS NULL AND document_template_id IS NOT NULL;

COMMENT ON INDEX idx_workflow_step_template_document_template IS 'Index for tracking which workflow steps use each document template';

-- =============================================================================
-- ROLLBACK SCRIPT
-- =============================================================================

-- To rollback this migration, execute the following SQL:

/*

-- Drop index on workflow_step_template.document_template_id
DROP INDEX IF EXISTS idx_workflow_step_template_document_template;

-- Drop FK constraint from workflow_step_template to qualification_templates
ALTER TABLE workflow_step_template
DROP CONSTRAINT IF EXISTS fk_workflow_step_document_template;

-- Drop index on qualification_templates(tenant_id, status)
DROP INDEX IF EXISTS idx_qualification_templates_tenant_status;

-- Drop status column from qualification_templates
ALTER TABLE qualification_templates
DROP COLUMN IF EXISTS status;

*/

