-- Migration: Add workflow_step_document table
-- Story: 2.2.17 - Workflow Document Upload, Per-Document Validation

CREATE TABLE IF NOT EXISTS workflow_step_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  process_instance_id UUID NOT NULL REFERENCES process_instance(id) ON DELETE CASCADE,
  step_instance_id UUID NOT NULL REFERENCES step_instance(id) ON DELETE CASCADE,
  required_document_name VARCHAR(255) NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'approved', 'declined')),
  decline_comment TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_wsd_step_instance ON workflow_step_document(step_instance_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_wsd_tenant_process ON workflow_step_document(tenant_id, process_instance_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_wsd_step_doc_name ON workflow_step_document(step_instance_id, required_document_name)
  WHERE deleted_at IS NULL;
