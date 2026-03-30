-- Migration 0029: Add indexes for workflow list operational control center
-- Supports the default sort (updated_at DESC) and status-filtered sort paths

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_process_instance_tenant_updated
  ON process_instance (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_process_instance_tenant_status_updated
  ON process_instance (tenant_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;
