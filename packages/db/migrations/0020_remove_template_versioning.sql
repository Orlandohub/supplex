-- Migration: Remove Template Versioning System
-- Story: 2.2.14
-- Date: 2026-03-15
-- Description: Removes form_template_version and workflow_template_version tables,
--              migrates FKs to point directly to templates, adds is_active to form_template

-- ==============================================================================
-- SAFETY CHECKS
-- ==============================================================================

-- Check for existing data (informational)
DO $$
DECLARE
  form_version_count INT;
  workflow_version_count INT;
  form_submission_count INT;
  workflow_step_count INT;
BEGIN
  SELECT COUNT(*) INTO form_version_count FROM form_template_version;
  SELECT COUNT(*) INTO workflow_version_count FROM workflow_template_version;
  SELECT COUNT(*) INTO form_submission_count FROM form_submission;
  SELECT COUNT(*) INTO workflow_step_count FROM workflow_step_template;
  
  RAISE NOTICE '=== PRE-MIGRATION DATA COUNTS ===';
  RAISE NOTICE 'form_template_version records: %', form_version_count;
  RAISE NOTICE 'workflow_template_version records: %', workflow_version_count;
  RAISE NOTICE 'form_submission records: %', form_submission_count;
  RAISE NOTICE 'workflow_step_template records: %', workflow_step_count;
  RAISE NOTICE '====================================';
END $$;

-- ==============================================================================
-- STEP 1: EXPORT VERSION DATA FOR ARCHIVAL
-- ==============================================================================

-- Note: This should be done via the TypeScript migration helper script
-- (packages/db/scripts/migrate-template-versions.ts)
-- This SQL migration assumes data export has been completed

-- ==============================================================================
-- STEP 2: ADD is_active COLUMN TO form_template
-- ==============================================================================

ALTER TABLE form_template 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN form_template.is_active IS 'Whether this template is active and available for use';

-- ==============================================================================
-- STEP 3: MIGRATE form_section DATA
-- ==============================================================================

-- Add temporary form_template_id column to form_section
ALTER TABLE form_section
ADD COLUMN form_template_id UUID;

-- Populate form_template_id by joining through form_template_version
UPDATE form_section fs
SET form_template_id = ftv.form_template_id
FROM form_template_version ftv
WHERE fs.form_template_version_id = ftv.id;

-- Verify no NULL values after migration (safety check)
DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM form_section WHERE form_template_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration error: % form_section records have NULL form_template_id', null_count;
  END IF;
  RAISE NOTICE 'form_section migration successful: All records have form_template_id';
END $$;

-- ==============================================================================
-- STEP 4: MIGRATE workflow_step_template DATA
-- ==============================================================================

-- Add temporary workflow_template_id column to workflow_step_template
ALTER TABLE workflow_step_template
ADD COLUMN workflow_template_id UUID;

-- Populate workflow_template_id by joining through workflow_template_version
UPDATE workflow_step_template wst
SET workflow_template_id = wtv.workflow_template_id
FROM workflow_template_version wtv
WHERE wst.workflow_template_version_id = wtv.id;

-- Verify no NULL values after migration (safety check)
DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM workflow_step_template WHERE workflow_template_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration error: % workflow_step_template records have NULL workflow_template_id', null_count;
  END IF;
  RAISE NOTICE 'workflow_step_template migration successful: All records have workflow_template_id';
END $$;

-- ==============================================================================
-- STEP 5: MIGRATE form_submission DATA
-- ==============================================================================

-- Add temporary form_template_id column to form_submission
ALTER TABLE form_submission
ADD COLUMN form_template_id UUID;

-- Populate form_template_id by joining through form_template_version
UPDATE form_submission fs
SET form_template_id = ftv.form_template_id
FROM form_template_version ftv
WHERE fs.form_template_version_id = ftv.id;

-- Verify no NULL values after migration (safety check)
DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM form_submission WHERE form_template_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration error: % form_submission records have NULL form_template_id', null_count;
  END IF;
  RAISE NOTICE 'form_submission migration successful: All records have form_template_id';
END $$;

-- ==============================================================================
-- STEP 6: DROP OLD FOREIGN KEY CONSTRAINTS
-- ==============================================================================

-- Drop FK constraints that reference version tables
ALTER TABLE form_section DROP CONSTRAINT IF EXISTS form_section_form_template_version_id_form_template_version_id_fk;
ALTER TABLE workflow_step_template DROP CONSTRAINT IF EXISTS workflow_step_template_workflow_template_version_id_workflow_t;
ALTER TABLE workflow_step_template DROP CONSTRAINT IF EXISTS workflow_step_template_form_template_version_id_form_template_;
ALTER TABLE form_submission DROP CONSTRAINT IF EXISTS form_submission_form_template_version_id_form_template_version_id_fk;

-- Drop old indexes
DROP INDEX IF EXISTS idx_form_section_tenant_version_order;
DROP INDEX IF EXISTS idx_workflow_step_template_tenant_version_order;
DROP INDEX IF EXISTS idx_workflow_step_template_form_version;

-- ==============================================================================
-- STEP 7: DROP OLD COLUMNS AND RENAME NEW ONES
-- ==============================================================================

-- form_section
ALTER TABLE form_section DROP COLUMN form_template_version_id;
-- form_template_id is already in place, no rename needed

-- workflow_step_template
ALTER TABLE workflow_step_template DROP COLUMN workflow_template_version_id;
ALTER TABLE workflow_step_template DROP COLUMN form_template_version_id;
-- workflow_template_id is already in place, no rename needed

-- form_submission
ALTER TABLE form_submission DROP COLUMN form_template_version_id;
-- form_template_id is already in place, no rename needed

-- ==============================================================================
-- STEP 8: MAKE NEW COLUMNS NOT NULL
-- ==============================================================================

ALTER TABLE form_section 
ALTER COLUMN form_template_id SET NOT NULL;

ALTER TABLE workflow_step_template 
ALTER COLUMN workflow_template_id SET NOT NULL;

ALTER TABLE form_submission 
ALTER COLUMN form_template_id SET NOT NULL;

-- ==============================================================================
-- STEP 9: ADD NEW FOREIGN KEY CONSTRAINTS
-- ==============================================================================

-- form_section -> form_template (CASCADE delete)
ALTER TABLE form_section
ADD CONSTRAINT form_section_form_template_id_fkey
FOREIGN KEY (form_template_id) REFERENCES form_template(id) ON DELETE CASCADE;

-- workflow_step_template -> workflow_template (RESTRICT delete to preserve process history)
ALTER TABLE workflow_step_template
ADD CONSTRAINT workflow_step_template_workflow_template_id_fkey
FOREIGN KEY (workflow_template_id) REFERENCES workflow_template(id) ON DELETE RESTRICT;

-- form_submission -> form_template (RESTRICT delete to preserve submission history)
ALTER TABLE form_submission
ADD CONSTRAINT form_submission_form_template_id_fkey
FOREIGN KEY (form_template_id) REFERENCES form_template(id) ON DELETE RESTRICT;

-- ==============================================================================
-- STEP 10: CREATE NEW INDEXES
-- ==============================================================================

-- form_section: (tenant_id, form_template_id, section_order)
CREATE INDEX idx_form_section_tenant_template_order
ON form_section(tenant_id, form_template_id, section_order)
WHERE deleted_at IS NULL;

-- workflow_step_template: (tenant_id, workflow_template_id, step_order)
CREATE INDEX idx_workflow_step_template_tenant_template_order
ON workflow_step_template(tenant_id, workflow_template_id, step_order)
WHERE deleted_at IS NULL;

-- form_submission: (tenant_id, form_template_id)
CREATE INDEX idx_form_submission_tenant_template
ON form_submission(tenant_id, form_template_id)
WHERE deleted_at IS NULL;

-- ==============================================================================
-- STEP 11: UPDATE UNIQUE CONSTRAINT ON form_submission
-- ==============================================================================

-- Drop old unique constraint (if exists)
ALTER TABLE form_submission DROP CONSTRAINT IF EXISTS uq_form_submission_version_step;

-- Add new unique constraint using form_template_id
-- This prevents duplicate submissions for same template + step instance
ALTER TABLE form_submission
ADD CONSTRAINT uq_form_submission_template_step 
UNIQUE NULLS NOT DISTINCT (form_template_id, step_instance_id);

-- ==============================================================================
-- STEP 12: DROP VERSION TABLES
-- ==============================================================================

-- Drop relations and constraints first
ALTER TABLE form_template DROP CONSTRAINT IF EXISTS form_template_versions;
ALTER TABLE workflow_template DROP CONSTRAINT IF EXISTS workflow_template_versions;

-- Drop version tables
DROP TABLE IF EXISTS form_template_version CASCADE;
DROP TABLE IF EXISTS workflow_template_version CASCADE;

-- ==============================================================================
-- POST-MIGRATION VERIFICATION
-- ==============================================================================

DO $$
DECLARE
  form_section_count INT;
  workflow_step_count INT;
  form_submission_count INT;
BEGIN
  SELECT COUNT(*) INTO form_section_count FROM form_section;
  SELECT COUNT(*) INTO workflow_step_count FROM workflow_step_template;
  SELECT COUNT(*) INTO form_submission_count FROM form_submission;
  
  RAISE NOTICE '=== POST-MIGRATION DATA COUNTS ===';
  RAISE NOTICE 'form_section records: %', form_section_count;
  RAISE NOTICE 'workflow_step_template records: %', workflow_step_count;
  RAISE NOTICE 'form_submission records: %', form_submission_count;
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Migration completed successfully!';
END $$;

-- ==============================================================================
-- ROLLBACK SCRIPT (FOR REFERENCE ONLY - DO NOT EXECUTE)
-- ==============================================================================

/*
-- WARNING: This rollback script is for reference only
-- It cannot restore version data once tables are dropped
-- Always backup database before running this migration

-- 1. Recreate version tables (structure only, data is lost)
-- See migrations 0007 and 0012 for original table definitions

-- 2. Add back version FK columns
ALTER TABLE form_section ADD COLUMN form_template_version_id UUID;
ALTER TABLE workflow_step_template ADD COLUMN workflow_template_version_id UUID;
ALTER TABLE workflow_step_template ADD COLUMN form_template_version_id UUID;
ALTER TABLE form_submission ADD COLUMN form_template_version_id UUID;

-- 3. Drop new FK constraints
ALTER TABLE form_section DROP CONSTRAINT form_section_form_template_id_fkey;
ALTER TABLE workflow_step_template DROP CONSTRAINT workflow_step_template_workflow_template_id_fkey;
ALTER TABLE form_submission DROP CONSTRAINT form_submission_form_template_id_fkey;

-- 4. Drop new columns
ALTER TABLE form_section DROP COLUMN form_template_id;
ALTER TABLE workflow_step_template DROP COLUMN workflow_template_id;
ALTER TABLE form_submission DROP COLUMN form_template_id;
ALTER TABLE form_template DROP COLUMN is_active;

-- 5. Recreate old FK constraints
-- (Requires version tables to be populated first - data is lost)

-- 6. Restore version data from JSON backup
-- (Manual process using TypeScript migration helper)
*/
