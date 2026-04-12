-- Story 2.2.19: Workflow Engine Correctness — Idempotency & Performance Indexes
-- These partial unique indexes enforce idempotency at the DB level as a safety net.

-- Prevents duplicate pending validation tasks for the same role on the same step
CREATE UNIQUE INDEX idx_task_instance_step_validation_role_pending
  ON task_instance (step_instance_id, task_type, assignee_role)
  WHERE status = 'pending' AND deleted_at IS NULL AND task_type = 'validation';

-- Prevents duplicate pending action/resubmission tasks on the same step
CREATE UNIQUE INDEX idx_task_instance_step_action_pending
  ON task_instance (step_instance_id, task_type)
  WHERE status = 'pending' AND deleted_at IS NULL AND task_type IN ('action', 'resubmission');

-- Performance index for the hot validation approval path
CREATE INDEX idx_task_instance_step_status
  ON task_instance (step_instance_id, status)
  WHERE deleted_at IS NULL;
