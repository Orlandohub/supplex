-- Migration 0027: Convert process_instance.status to PostgreSQL ENUM
-- and add current_step_instance_id FK for efficient step lookups.
--
-- Rationale: varchar-based composite statuses ("StepName - In Progress")
-- prevent efficient indexing and filtering. A fixed ENUM with a separate
-- FK pointer to the current step is cleaner and faster at scale.

BEGIN;

-- 1. Create the enum type
CREATE TYPE workflow_process_status AS ENUM (
  'in_progress',
  'pending_validation',
  'declined_resubmit',
  'complete',
  'cancelled'
);

-- 2. Add current_step_instance_id FK
ALTER TABLE process_instance
  ADD COLUMN current_step_instance_id UUID REFERENCES step_instance(id) ON DELETE SET NULL;

-- 3. Backfill current_step_instance_id from active/awaiting_validation steps
UPDATE process_instance pi
SET current_step_instance_id = sub.id
FROM (
  SELECT DISTINCT ON (process_instance_id) id, process_instance_id
  FROM step_instance
  WHERE status IN ('active', 'awaiting_validation')
    AND deleted_at IS NULL
  ORDER BY process_instance_id, step_order ASC
) sub
WHERE pi.id = sub.process_instance_id;

-- 4. Normalise existing status values into enum-compatible strings
UPDATE process_instance SET status = 'in_progress'         WHERE status = 'active';
UPDATE process_instance SET status = 'complete'             WHERE status = 'completed';
UPDATE process_instance SET status = 'complete'             WHERE status = 'Complete';
UPDATE process_instance SET status = 'in_progress'          WHERE status LIKE '% - In Progress';
UPDATE process_instance SET status = 'pending_validation'   WHERE status LIKE '% - Pending Validation';
UPDATE process_instance SET status = 'declined_resubmit'    WHERE status LIKE '% - Declined - Re-Submit';
-- Catch-all for any remaining unknown values
UPDATE process_instance SET status = 'in_progress'
  WHERE status NOT IN ('in_progress', 'pending_validation', 'declined_resubmit', 'complete', 'cancelled');

-- 5. Convert column type from VARCHAR to ENUM
ALTER TABLE process_instance
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE process_instance
  ALTER COLUMN status TYPE workflow_process_status USING status::workflow_process_status;

ALTER TABLE process_instance
  ALTER COLUMN status SET DEFAULT 'in_progress'::workflow_process_status;

ALTER TABLE process_instance
  ALTER COLUMN status SET NOT NULL;

-- 6. Index on the new FK for efficient joins in list views
CREATE INDEX idx_process_instance_current_step
  ON process_instance(current_step_instance_id)
  WHERE current_step_instance_id IS NOT NULL;

COMMIT;
