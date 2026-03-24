-- Migration: Remove process_type from workflow_template
-- Story: 2.2.7.1 - Remove Process Type Constraint from Workflow Templates
-- Generated: 2026-01-25
--
-- Background:
-- The process_type field was added in migration 0012 to categorize workflows
-- into system-defined types. User feedback revealed this constraint is unnecessary
-- and limits flexibility. Organizations want to create workflows freely using
-- descriptive names without being constrained to predefined types.
--
-- Changes:
-- 1. Drop index idx_workflow_template_tenant_process_status (references process_type)
-- 2. Drop process_type column from workflow_template table
--
-- Impact:
-- - Existing workflow templates remain intact (no data loss)
-- - The idx_workflow_template_tenant_status index remains for filtering by status
-- - Workflows are now identified by name, description, and status only
--
-- Rollback Instructions (if needed):
-- To reverse this migration, run the following SQL:
--
-- ALTER TABLE workflow_template ADD COLUMN process_type VARCHAR(100);
-- UPDATE workflow_template SET process_type = 'general' WHERE process_type IS NULL;
-- ALTER TABLE workflow_template ALTER COLUMN process_type SET NOT NULL;
-- CREATE INDEX idx_workflow_template_tenant_process_status 
--     ON workflow_template(tenant_id, process_type, status) 
--     WHERE deleted_at IS NULL;

-- Drop index that references process_type
DROP INDEX IF EXISTS idx_workflow_template_tenant_process_status;

-- Drop process_type column
ALTER TABLE workflow_template DROP COLUMN IF EXISTS process_type;

