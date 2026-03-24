-- Migration: Add active field to workflow_template and completion_status to workflow_step_template
-- Story: 2.2.9 - Supplier Workflow Integration
-- Date: 2026-01-27
--
-- Purpose:
-- 1. Add 'active' field to workflow_template to allow admins to toggle template availability
-- 2. Add 'completion_status' field to workflow_step_template for custom status tracking
-- 3. Update composite index to include active filter for efficient querying
--
-- Active Field:
-- - Allows admins to deactivate workflow templates without archiving them
-- - Only templates with active=true AND status='published' appear in dropdowns
-- - Existing workflow instances continue regardless of active status
-- - Defaults to true for backward compatibility
--
-- Completion Status Field:
-- - When a workflow step completes, if completion_status is NOT NULL,
--   copy the value to process_instance.status
-- - Allows workflow status to reflect custom progression (e.g., "Under Review", "Approved")
-- - If completion_status is NULL, process_instance.status remains unchanged
-- - Nullable field (optional configuration per step)

-- =========================================
-- Add active field to workflow_template
-- =========================================
ALTER TABLE workflow_template
ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN workflow_template.active IS 'Controls whether template can be instantiated. Only active=true AND status=published templates appear in dropdowns. Does not affect existing workflow instances.';

-- =========================================
-- Add completion_status to workflow_step_template
-- =========================================
ALTER TABLE workflow_step_template
ADD COLUMN completion_status VARCHAR(100);

COMMENT ON COLUMN workflow_step_template.completion_status IS 'Optional custom status value. When step completes, if NOT NULL, this value is copied to process_instance.status. Allows workflow status to reflect custom progression (e.g., "Documents Submitted", "Under Review", "Approved"). If NULL, process status remains unchanged.';

-- =========================================
-- Update composite index to include active field
-- =========================================

-- Drop old index
DROP INDEX IF EXISTS idx_workflow_template_tenant_status;

-- Create new index with active field
CREATE INDEX idx_workflow_template_tenant_status_active
ON workflow_template (tenant_id, status, active)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_workflow_template_tenant_status_active IS 'Composite index for filtering workflow templates by tenant, status, and active flag. Partial index excludes soft-deleted records.';

-- =========================================
-- ROLLBACK INSTRUCTIONS
-- =========================================
-- To rollback this migration, run the following:
--
-- -- Drop new index
-- DROP INDEX IF EXISTS idx_workflow_template_tenant_status_active;
--
-- -- Recreate old index
-- CREATE INDEX idx_workflow_template_tenant_status
-- ON workflow_template (tenant_id, status)
-- WHERE deleted_at IS NULL;
--
-- -- Remove completion_status column
-- ALTER TABLE workflow_step_template DROP COLUMN completion_status;
--
-- -- Remove active column
-- ALTER TABLE workflow_template DROP COLUMN active;

