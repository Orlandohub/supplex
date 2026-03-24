-- Migration: Add form_submission and form_answer tables
-- Story: 2.2.4 - Form Runtime Execution with Save Draft
-- Description: Creates tables for storing form submissions and answers

-- Create submission status enum
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'archived');

-- Create form_submission table
CREATE TABLE IF NOT EXISTS form_submission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    form_template_version_id UUID NOT NULL REFERENCES form_template_version(id) ON DELETE CASCADE,
    process_instance_id UUID, -- Nullable: for workflow integration (Story 2.2.9)
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status submission_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP WITH TIME ZONE, -- Nullable: NULL for drafts, set on submit
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete support
    
    -- Business rule: Prevent duplicate submissions for same workflow step
    CONSTRAINT uq_form_submission_version_process UNIQUE NULLS NOT DISTINCT (form_template_version_id, process_instance_id)
);

-- Add indexes for form_submission
CREATE INDEX idx_form_submission_tenant_status ON form_submission(tenant_id, status, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_form_submission_process_instance ON form_submission(process_instance_id, deleted_at) WHERE deleted_at IS NULL AND process_instance_id IS NOT NULL;
CREATE INDEX idx_form_submission_submitted_by ON form_submission(submitted_by, tenant_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_form_submission_tenant_created ON form_submission(tenant_id, created_at DESC, deleted_at) WHERE deleted_at IS NULL;

-- Create form_answer table
CREATE TABLE IF NOT EXISTS form_answer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_submission_id UUID NOT NULL REFERENCES form_submission(id) ON DELETE CASCADE,
    form_field_id UUID NOT NULL REFERENCES form_field(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- All answers stored as TEXT, parsed based on field_type at runtime
    -- Examples: text="Hello", number="42.5", date="2026-01-22", checkbox="true", multi_select="value1,value2"
    answer_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Business rule: One answer per field per submission
    CONSTRAINT uq_form_answer_submission_field UNIQUE (form_submission_id, form_field_id)
);

-- Add index for form_answer (tenant_id first for multi-tenant query performance)
CREATE INDEX idx_form_answer_tenant_submission_field ON form_answer(tenant_id, form_submission_id, form_field_id);

-- Add SQL comments for documentation
COMMENT ON TABLE form_submission IS 'Runtime execution of a form template version. Tracks submission status and links to workflow processes.';
COMMENT ON COLUMN form_submission.id IS 'Unique submission identifier';
COMMENT ON COLUMN form_submission.tenant_id IS 'Tenant isolation - CASCADE delete when tenant removed';
COMMENT ON COLUMN form_submission.form_template_version_id IS 'Immutable reference to published form version';
COMMENT ON COLUMN form_submission.process_instance_id IS 'Optional link to workflow process for workflow integration';
COMMENT ON COLUMN form_submission.submitted_by IS 'User who created/submitted the form';
COMMENT ON COLUMN form_submission.status IS 'Submission lifecycle: draft (editable) | submitted (immutable) | archived';
COMMENT ON COLUMN form_submission.submitted_at IS 'Timestamp when form was finalized (NULL for drafts)';

COMMENT ON TABLE form_answer IS 'Individual field answers for a form submission. All answers stored as TEXT.';
COMMENT ON COLUMN form_answer.id IS 'Unique answer identifier';
COMMENT ON COLUMN form_answer.form_submission_id IS 'Parent submission - CASCADE delete';
COMMENT ON COLUMN form_answer.form_field_id IS 'Reference to field definition';
COMMENT ON COLUMN form_answer.tenant_id IS 'Tenant isolation for query performance';
COMMENT ON COLUMN form_answer.answer_value IS 'Answer stored as text, interpretation based on field_type (number="42.5", date="2026-01-22", checkbox="true", multi_select="val1,val2")';

COMMENT ON CONSTRAINT uq_form_submission_version_process ON form_submission IS 'Prevents duplicate submissions for same workflow step';
COMMENT ON CONSTRAINT uq_form_answer_submission_field ON form_answer IS 'One answer per field per submission - enables upsert pattern for draft saves';

