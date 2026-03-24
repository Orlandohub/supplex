-- Migration 0019: Add step_instance_id to form_submission
-- Story: Form Step Integration - Allow multiple form submissions per process
-- 
-- Changes:
-- 1. Add step_instance_id column to form_submission
-- 2. Drop old unique constraint (form_template_version_id, process_instance_id)
-- 3. Add new unique constraint (form_template_version_id, step_instance_id)
-- 4. Add index on step_instance_id for efficient lookups

-- Add step_instance_id column (nullable for backward compatibility with standalone forms)
ALTER TABLE form_submission 
ADD COLUMN step_instance_id UUID;

-- Add foreign key constraint to step_instance
ALTER TABLE form_submission
ADD CONSTRAINT fk_form_submission_step_instance
FOREIGN KEY (step_instance_id) REFERENCES step_instance(id) ON DELETE CASCADE;

-- Drop old unique constraint
ALTER TABLE form_submission
DROP CONSTRAINT IF EXISTS uq_form_submission_version_process;

-- Add new unique constraint on (form_template_version_id, step_instance_id)
-- This allows multiple form submissions per process (one per step)
-- NULLS NOT DISTINCT ensures standalone forms (NULL step_instance_id) are handled correctly
ALTER TABLE form_submission
ADD CONSTRAINT uq_form_submission_version_step
UNIQUE NULLS NOT DISTINCT (form_template_version_id, step_instance_id);

-- Add index on step_instance_id for efficient lookups
CREATE INDEX idx_form_submission_step_instance 
ON form_submission(step_instance_id, deleted_at) 
WHERE deleted_at IS NULL AND step_instance_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN form_submission.step_instance_id IS 'Links form submission to a specific workflow step instance. NULL for standalone forms not part of a workflow.';


