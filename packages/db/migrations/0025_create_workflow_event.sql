-- Migration: Create immutable workflow event log
-- Story: 2.2.12 - Audit Logging for Templates and Execution
--
-- Creates:
--   1. workflow_event table (append-only audit/event log)
--   2. Composite index for process-scoped history queries
--   3. Index for tenant-wide audit log queries
--   4. Index for event type filtering

-- ============================================================
-- 1. workflow_event table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  process_instance_id UUID REFERENCES process_instance(id) ON DELETE SET NULL,
  step_instance_id UUID REFERENCES step_instance(id) ON DELETE SET NULL,
  task_instance_id UUID REFERENCES task_instance(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_description VARCHAR(500) NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  comment TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Primary query path: all events for a process (history tab)
-- ============================================================
CREATE INDEX idx_workflow_event_process
  ON workflow_event(tenant_id, process_instance_id, created_at);

-- ============================================================
-- 3. Tenant-wide audit log (admin page, sorted newest first)
-- ============================================================
CREATE INDEX idx_workflow_event_tenant_time
  ON workflow_event(tenant_id, created_at DESC);

-- ============================================================
-- 4. Event type filtering
-- ============================================================
CREATE INDEX idx_workflow_event_type
  ON workflow_event(event_type);
