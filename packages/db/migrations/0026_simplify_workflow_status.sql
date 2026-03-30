-- Migration: 0026_simplify_workflow_status
-- Description: Simplify workflow status attribution to use fixed, deterministic
--   statuses derived from step name + suffix instead of user-configured values.
--   Removes the workflow_status lookup table and related columns.
--
-- Changes:
--   1. Widen process_instance.status from VARCHAR(50) to VARCHAR(300)
--   2. Drop workflow_status_id FK from workflow_step_template
--   3. Drop completion_status from workflow_step_template
--   4. Drop workflow_status table
--
-- New status model (4 fixed statuses):
--   "{StepName} - In Progress"        — step is active
--   "{StepName} - Pending Validation"  — awaiting approvers
--   "{StepName} - Declined - Re-Submit"— approver declined
--   "Complete"                         — all steps finished

-- ============================================================
-- 1. Widen process_instance.status to accommodate step name + suffix
-- ============================================================
ALTER TABLE process_instance
  ALTER COLUMN status TYPE VARCHAR(300);

-- ============================================================
-- 2. Drop workflow_status_id FK from workflow_step_template
-- ============================================================
ALTER TABLE workflow_step_template
  DROP COLUMN IF EXISTS workflow_status_id;

-- ============================================================
-- 3. Drop completion_status from workflow_step_template
-- ============================================================
ALTER TABLE workflow_step_template
  DROP COLUMN IF EXISTS completion_status;

-- ============================================================
-- 4. Drop workflow_status table (no longer needed)
-- ============================================================
DROP TABLE IF EXISTS workflow_status;
