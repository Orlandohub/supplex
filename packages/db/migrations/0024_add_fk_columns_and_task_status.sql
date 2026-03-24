-- Migration: Add FK columns to existing tables, rename task status, seed defaults
-- Stories: Workflow Engine Fixes & Metadata Tables
--
-- Changes:
--   1. Add supplier_status_id FK to suppliers
--   2. Add workflow_status_id FK to workflow_step_template
--   3. Add workflow_type_id FK to workflow_template
--   4. Add expiry_date to workflow_step_document
--   5. Rename task_instance status 'open' -> 'pending'
--   6. Seed default supplier statuses per existing tenant
--   7. Backfill suppliers.supplier_status_id from name match
--   8. Update partial indexes on task_instance for new status value

-- ============================================================
-- 1. Add supplier_status_id to suppliers
-- ============================================================
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS supplier_status_id UUID REFERENCES supplier_status(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Add workflow_status_id to workflow_step_template
-- ============================================================
ALTER TABLE workflow_step_template
  ADD COLUMN IF NOT EXISTS workflow_status_id UUID REFERENCES workflow_status(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Add workflow_type_id to workflow_template
-- ============================================================
ALTER TABLE workflow_template
  ADD COLUMN IF NOT EXISTS workflow_type_id UUID REFERENCES workflow_type(id) ON DELETE SET NULL;

-- ============================================================
-- 4. Add expiry_date to workflow_step_document
-- ============================================================
ALTER TABLE workflow_step_document
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;

-- ============================================================
-- 5. Rename task_instance status 'open' -> 'pending'
-- ============================================================
UPDATE task_instance SET status = 'pending' WHERE status = 'open';

-- ============================================================
-- 6. Seed default supplier statuses per existing tenant
-- ============================================================
INSERT INTO supplier_status (tenant_id, name, display_order, is_default)
SELECT t.id, s.name, s.display_order, s.is_default
FROM tenants t
CROSS JOIN (VALUES
  ('prospect',    0, true),
  ('qualified',   1, false),
  ('approved',    2, false),
  ('conditional', 3, false),
  ('blocked',     4, false)
) AS s(name, display_order, is_default)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================
-- 7. Backfill suppliers.supplier_status_id from name match
-- ============================================================
UPDATE suppliers sup
SET supplier_status_id = ss.id
FROM supplier_status ss
WHERE ss.tenant_id = sup.tenant_id
  AND ss.name = sup.status
  AND sup.supplier_status_id IS NULL;

-- ============================================================
-- 8. Rebuild partial indexes on task_instance for 'pending'
--    (The old indexes had WHERE status = 'open'; recreate for 'pending')
-- ============================================================
DROP INDEX IF EXISTS idx_task_instance_tenant_assignee_status;
CREATE INDEX idx_task_instance_tenant_assignee_status
  ON task_instance(tenant_id, assignee_type, assignee_role, status)
  WHERE status = 'pending' AND deleted_at IS NULL;

DROP INDEX IF EXISTS idx_task_instance_tenant_assignee_user_status;
CREATE INDEX idx_task_instance_tenant_assignee_user_status
  ON task_instance(tenant_id, assignee_user_id, status)
  WHERE assignee_type = 'user' AND status = 'pending' AND deleted_at IS NULL;

DROP INDEX IF EXISTS idx_task_instance_tenant_due_at;
CREATE INDEX idx_task_instance_tenant_due_at
  ON task_instance(tenant_id, due_at)
  WHERE status = 'pending' AND deleted_at IS NULL;
