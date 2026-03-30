-- Migration 0030: Add workflow_name to process_instance and backfill due dates
-- 1. Adds workflow_name column to process_instance (denormalized from workflow_template.name)
-- 2. Backfills workflow_name from the linked workflow_template
-- 3. Backfills task_instance.due_at where missing but completion_time_days is set

BEGIN;

-- Step 1: Add workflow_name column to process_instance
ALTER TABLE process_instance
  ADD COLUMN IF NOT EXISTS workflow_name VARCHAR(255);

-- Step 2: Backfill workflow_name from workflow_template
UPDATE process_instance pi
SET workflow_name = wt.name
FROM workflow_template wt
WHERE pi.workflow_template_id = wt.id
  AND pi.workflow_name IS NULL;

-- Step 3: Backfill task_instance.due_at from created_at + completion_time_days
UPDATE task_instance
SET due_at = created_at + (completion_time_days * INTERVAL '1 day')
WHERE due_at IS NULL
  AND completion_time_days IS NOT NULL;

COMMIT;
