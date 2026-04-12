-- Story 2.2.23 — Convert step_instance.status from varchar(50) to PG enum
-- Safety: The USING cast will fail if any row has a value outside the 8 listed.
-- Run this verification query before applying:
--   SELECT DISTINCT status FROM step_instance
--     WHERE status NOT IN ('pending','active','completed','blocked','skipped','awaiting_validation','validated','declined');

-- 1. Drop indexes whose predicates reference the status column
--    (implicit text→enum casts in index predicates are not IMMUTABLE)
DROP INDEX IF EXISTS idx_step_instance_tenant_assigned_status;

-- 2. Create the enum type
CREATE TYPE step_instance_status AS ENUM (
  'pending', 'active', 'completed', 'blocked', 'skipped',
  'awaiting_validation', 'validated', 'declined'
);

-- 3. Convert the column: drop default, change type, re-add default
ALTER TABLE step_instance
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE step_instance
  ALTER COLUMN status TYPE step_instance_status
  USING status::step_instance_status;

ALTER TABLE step_instance
  ALTER COLUMN status SET DEFAULT 'pending'::step_instance_status;

-- 4. Recreate the index with properly typed enum literals
CREATE INDEX idx_step_instance_tenant_assigned_status
  ON step_instance (tenant_id, assigned_to, status)
  WHERE status IN ('pending'::step_instance_status, 'active'::step_instance_status)
    AND deleted_at IS NULL;
