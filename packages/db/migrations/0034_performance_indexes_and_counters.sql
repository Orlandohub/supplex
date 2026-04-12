-- Story 2.2.22: Workflow Engine Performance
-- Denormalized progress counters, trigram indexes, missing partial indexes

-- Denormalized progress counters
ALTER TABLE process_instance ADD COLUMN IF NOT EXISTS total_steps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE process_instance ADD COLUMN IF NOT EXISTS completed_steps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE process_instance ADD COLUMN IF NOT EXISTS has_overdue_tasks BOOLEAN NOT NULL DEFAULT false;

-- Backfill total_steps
UPDATE process_instance pi SET total_steps = (
  SELECT COUNT(*) FROM step_instance si
  WHERE si.process_instance_id = pi.id AND si.deleted_at IS NULL
);

-- Backfill completed_steps
UPDATE process_instance pi SET completed_steps = (
  SELECT COUNT(*) FROM step_instance si
  WHERE si.process_instance_id = pi.id
    AND si.status IN ('completed', 'validated')
    AND si.deleted_at IS NULL
);

-- Trigram extension + indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_process_instance_workflow_name_trgm
  ON process_instance USING GIN (workflow_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
  ON suppliers USING GIN (name gin_trgm_ops);

-- Missing partial index for step-count lookups and transition code
CREATE INDEX IF NOT EXISTS idx_step_instance_process_status
  ON step_instance (process_instance_id, status)
  WHERE deleted_at IS NULL;
