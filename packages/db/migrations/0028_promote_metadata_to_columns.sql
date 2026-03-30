-- Migration 0028: Promote frequently-accessed metadata fields to proper columns.
--
-- 1. process_instance.workflow_template_id  (FK → workflow_template)
-- 2. step_instance.workflow_step_template_id (FK → workflow_step_template)
-- 3. task_instance.task_type                 (ENUM: action | validation | resubmission)
-- 4. task_instance.outcome                   (ENUM: submitted | approved | declined | auto_closed)

BEGIN;

-- ============================================================
-- 1. process_instance.workflow_template_id
-- ============================================================
ALTER TABLE process_instance
  ADD COLUMN workflow_template_id UUID REFERENCES workflow_template(id) ON DELETE SET NULL;

UPDATE process_instance
SET workflow_template_id = (metadata->>'workflowTemplateId')::uuid
WHERE metadata->>'workflowTemplateId' IS NOT NULL;

CREATE INDEX idx_process_instance_workflow_template
  ON process_instance(workflow_template_id)
  WHERE workflow_template_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 2. step_instance.workflow_step_template_id
-- ============================================================
ALTER TABLE step_instance
  ADD COLUMN workflow_step_template_id UUID REFERENCES workflow_step_template(id) ON DELETE SET NULL;

UPDATE step_instance
SET workflow_step_template_id = (metadata->>'workflowStepTemplateId')::uuid
WHERE metadata->>'workflowStepTemplateId' IS NOT NULL;

CREATE INDEX idx_step_instance_step_template
  ON step_instance(workflow_step_template_id)
  WHERE workflow_step_template_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 3. task_instance.task_type
-- ============================================================
CREATE TYPE task_type AS ENUM ('action', 'validation', 'resubmission');

ALTER TABLE task_instance
  ADD COLUMN task_type task_type NOT NULL DEFAULT 'action';

UPDATE task_instance SET task_type = 'validation'
  WHERE (metadata->>'isValidationTask')::boolean = true;

UPDATE task_instance SET task_type = 'resubmission'
  WHERE (metadata->>'isResubmission')::boolean = true
    AND task_type = 'action';  -- don't overwrite validation

-- ============================================================
-- 4. task_instance.outcome
-- ============================================================
CREATE TYPE task_outcome AS ENUM ('submitted', 'approved', 'declined', 'auto_closed');

ALTER TABLE task_instance
  ADD COLUMN outcome task_outcome;

UPDATE task_instance SET outcome = 'declined'
  WHERE metadata->>'action' = 'declined';

UPDATE task_instance SET outcome = 'auto_closed'
  WHERE metadata->>'autoCompleted' = 'true'
     OR metadata->>'action' = 'auto_closed_decline';

-- Completed validation tasks that were not declined/auto-closed → approved
UPDATE task_instance SET outcome = 'approved'
  WHERE task_type = 'validation'
    AND status = 'completed'
    AND outcome IS NULL
    AND metadata->>'action' IS DISTINCT FROM 'declined';

-- Completed action tasks that were not declined → submitted
UPDATE task_instance SET outcome = 'submitted'
  WHERE task_type = 'action'
    AND status = 'completed'
    AND outcome IS NULL;

-- Same for resubmission tasks
UPDATE task_instance SET outcome = 'submitted'
  WHERE task_type = 'resubmission'
    AND status = 'completed'
    AND outcome IS NULL;

COMMIT;
