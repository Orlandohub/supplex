-- Migration 0031: Remove Multi-Approver Feature
-- Story 2.2.18: Complete multi-approver removal
-- Multi-approver replaced by auto-validation (Story 2.2.15)

-- Drop the step_approver table entirely
DROP TABLE IF EXISTS step_approver CASCADE;

-- Remove multi-approver columns from workflow_step_template
ALTER TABLE workflow_step_template DROP COLUMN IF EXISTS multi_approver;
ALTER TABLE workflow_step_template DROP COLUMN IF EXISTS approver_count;

-- Drop the approver_type enum if it exists and is no longer referenced
DROP TYPE IF EXISTS approver_type;
