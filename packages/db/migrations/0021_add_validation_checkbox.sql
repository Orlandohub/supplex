-- Migration: Add Validation Checkbox to Workflow Steps
-- Story: 2.2.15
-- Date: 2026-03-17
-- Description: Adds requires_validation and validation_config fields to workflow_step_template
--              to enable automatic validation task creation at runtime

-- ==============================================================================
-- STEP 1: ADD VALIDATION CHECKBOX FIELDS
-- ==============================================================================

ALTER TABLE workflow_step_template
ADD COLUMN requires_validation BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN validation_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ==============================================================================
-- STEP 2: ADD COMMENTS FOR DOCUMENTATION
-- ==============================================================================

COMMENT ON COLUMN workflow_step_template.requires_validation IS 
'When true, system automatically creates validation tasks when step completes';

COMMENT ON COLUMN workflow_step_template.validation_config IS 
'JSONB config with structure: { "approverRoles": ["role1", "role2"], "requireAllApprovals": false }';

-- ==============================================================================
-- STEP 3: CREATE INDEX FOR PERFORMANCE
-- ==============================================================================

-- Index for efficient validation lookup during step completion
CREATE INDEX idx_workflow_step_requires_validation
ON workflow_step_template(requires_validation)
WHERE requires_validation = true AND deleted_at IS NULL;

-- ==============================================================================
-- VERIFICATION QUERIES (Optional - for manual testing)
-- ==============================================================================

-- Verify columns were added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_step_template' 
    AND column_name = 'requires_validation'
  ) THEN
    RAISE NOTICE '✓ Column requires_validation added successfully';
  ELSE
    RAISE EXCEPTION '✗ Column requires_validation not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_step_template' 
    AND column_name = 'validation_config'
  ) THEN
    RAISE NOTICE '✓ Column validation_config added successfully';
  ELSE
    RAISE EXCEPTION '✗ Column validation_config not found';
  END IF;

  RAISE NOTICE '=== Migration 0021 completed successfully ===';
END $$;

-- ==============================================================================
-- ROLLBACK SCRIPT (Run this to undo migration)
-- ==============================================================================
-- 
-- DROP INDEX IF EXISTS idx_workflow_step_requires_validation;
-- ALTER TABLE workflow_step_template DROP COLUMN IF EXISTS validation_config;
-- ALTER TABLE workflow_step_template DROP COLUMN IF EXISTS requires_validation;
-- 
