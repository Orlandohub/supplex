-- Migration 0041: Add document_review_decision table and validation_round columns
-- Story: WFH-001 (revised) - Per-reviewer document approval model

-- 1. Add validation_round to step_instance (tracks which review round we're on)
ALTER TABLE step_instance ADD COLUMN validation_round INTEGER NOT NULL DEFAULT 0;

-- 2. Add validation_round to task_instance (nullable; only set for validation tasks)
ALTER TABLE task_instance ADD COLUMN validation_round INTEGER;

-- 3. Create document_review_decision table
CREATE TABLE document_review_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_step_document_id UUID NOT NULL REFERENCES workflow_step_document(id) ON DELETE CASCADE,
  step_instance_id UUID NOT NULL REFERENCES step_instance(id) ON DELETE CASCADE,
  task_instance_id UUID NOT NULL REFERENCES task_instance(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  validation_round INTEGER NOT NULL,
  decision VARCHAR(20) NOT NULL,
  comment TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary query path: active-round decisions for a step
CREATE INDEX idx_drd_step_round ON document_review_decision (step_instance_id, validation_round);

-- Lookup decisions by task
CREATE INDEX idx_drd_task ON document_review_decision (task_instance_id);

-- Idempotency: one decision per document per validation task
CREATE UNIQUE INDEX idx_drd_doc_task_unique ON document_review_decision (workflow_step_document_id, task_instance_id);
