-- Fix: Add form_template_id column to workflow_step_template
-- This was missing from the original 0020 migration
-- NOTE: This file shares the 0020_ prefix with 0020_remove_template_versioning.sql.
-- Both have been applied to production; renaming would break drizzle-kit tracking.
-- See migrations/README.md for details.

-- Step 1: Add the new column
ALTER TABLE workflow_step_template
ADD COLUMN IF NOT EXISTS form_template_id UUID;

-- Step 2: Populate form_template_id from form_template_version_id (if it exists)
DO $$
BEGIN
  -- Check if the old column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_step_template' 
    AND column_name = 'form_template_version_id'
  ) THEN
    -- Migrate data from version to direct template reference
    UPDATE workflow_step_template wst
    SET form_template_id = ftv.form_template_id
    FROM form_template_version ftv
    WHERE wst.form_template_version_id = ftv.id;
    
    RAISE NOTICE 'Migrated form_template_version_id to form_template_id';
  ELSE
    RAISE NOTICE 'form_template_version_id column does not exist, skipping migration';
  END IF;
END $$;

-- Step 3: Add foreign key constraint
ALTER TABLE workflow_step_template
ADD CONSTRAINT workflow_step_template_form_template_id_fkey 
FOREIGN KEY (form_template_id) 
REFERENCES form_template(id) 
ON DELETE RESTRICT;

-- Step 4: Drop the old constraint and column (if they exist)
ALTER TABLE workflow_step_template 
DROP CONSTRAINT IF EXISTS workflow_step_template_form_template_version_id_form_template_;

ALTER TABLE workflow_step_template 
DROP COLUMN IF EXISTS form_template_version_id;

-- Step 5: Create index on form_template_id
CREATE INDEX IF NOT EXISTS idx_workflow_step_template_form_template 
ON workflow_step_template(form_template_id);

-- Success notification
DO $$
BEGIN
  RAISE NOTICE 'workflow_step_template.form_template_id migration complete';
END $$;
