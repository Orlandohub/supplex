-- Migration: Add comment_thread table for workflow decline comments and responses
-- Story: 2.2.8 - Workflow Execution Engine
-- Date: 2026-01-26

-- Create comment_thread table
CREATE TABLE IF NOT EXISTS comment_thread (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  process_instance_id UUID NOT NULL,
  step_instance_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('form', 'document')),
  entity_id UUID,
  parent_comment_id UUID,
  comment_text TEXT NOT NULL,
  commented_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Foreign key constraints
  CONSTRAINT fk_comment_thread_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE,
  
  CONSTRAINT fk_comment_thread_process
    FOREIGN KEY (process_instance_id)
    REFERENCES process_instance(id)
    ON DELETE CASCADE,
  
  CONSTRAINT fk_comment_thread_step
    FOREIGN KEY (step_instance_id)
    REFERENCES step_instance(id)
    ON DELETE CASCADE,
  
  CONSTRAINT fk_comment_thread_parent
    FOREIGN KEY (parent_comment_id)
    REFERENCES comment_thread(id)
    ON DELETE CASCADE,
  
  CONSTRAINT fk_comment_thread_user
    FOREIGN KEY (commented_by)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Create indexes for efficient queries
-- Composite index for tenant + process + step filtering
CREATE INDEX idx_comment_thread_tenant_process_step
  ON comment_thread(tenant_id, process_instance_id, step_instance_id)
  WHERE deleted_at IS NULL;

-- Index for parent comment lookups (threaded comments)
CREATE INDEX idx_comment_thread_parent
  ON comment_thread(parent_comment_id)
  WHERE deleted_at IS NULL AND parent_comment_id IS NOT NULL;

-- Index for user comments
CREATE INDEX idx_comment_thread_user
  ON comment_thread(commented_by, tenant_id)
  WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON TABLE comment_thread IS 'Stores decline comments and responses for workflow steps';
COMMENT ON COLUMN comment_thread.entity_type IS 'Type of entity being commented on: form or document';
COMMENT ON COLUMN comment_thread.entity_id IS 'Reference to specific entity (for future use)';
COMMENT ON COLUMN comment_thread.parent_comment_id IS 'Reference to parent comment for threaded replies';

