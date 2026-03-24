-- Migration: Drop Legacy Qualification System
-- Story: 2.2.9 - Supplier Workflow Integration (Completion)
-- Sprint Change Proposal: SCP-2026-01-31-001
-- Date: 2026-01-31
-- WARNING: This migration DROPS tables and DELETES ALL LEGACY QUALIFICATION DATA
-- There is NO rollback - ensure you have backups if needed

-- ========================================
-- Drop Foreign Key Dependencies First
-- ========================================

-- workflow_step_template references qualification_templates.id via document_template_id
ALTER TABLE workflow_step_template 
DROP CONSTRAINT IF EXISTS workflow_step_template_document_template_id_fkey;

-- ========================================
-- Drop Legacy Qualification Tables
-- ========================================

-- Drop in order of dependencies (children first, parents last)
DROP TABLE IF EXISTS workflow_events CASCADE;
DROP TABLE IF EXISTS workflow_documents CASCADE;
DROP TABLE IF EXISTS qualification_stages CASCADE;
DROP TABLE IF EXISTS qualification_process CASCADE;
DROP TABLE IF EXISTS qualification_templates CASCADE;

-- ========================================
-- Update workflow_step_template
-- ========================================
-- Remove document_template_id column (was FK to qualification_templates)
-- The new system uses form_template instead for document collection

ALTER TABLE workflow_step_template 
DROP COLUMN IF EXISTS document_template_id CASCADE;

ALTER TABLE workflow_step_template 
DROP COLUMN IF EXISTS document_action_mode CASCADE;

-- Drop associated index
DROP INDEX IF EXISTS idx_workflow_step_template_document_template;

-- ========================================
-- VERIFICATION QUERIES (Run after migration)
-- ========================================

-- Verify tables are dropped
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('qualification_process', 'qualification_stages', 'qualification_templates', 'workflow_documents', 'workflow_events');
-- Expected: 0 rows

-- Verify workflow_step_template columns removed
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'workflow_step_template' 
-- AND column_name IN ('document_template_id', 'document_action_mode');
-- Expected: 0 rows

-- ========================================
-- ROLLBACK INSTRUCTIONS
-- ========================================
-- ⚠️ WARNING: NO AUTOMATIC ROLLBACK AVAILABLE
-- This migration deletes data permanently
-- 
-- To rollback (data will be EMPTY):
-- 1. Restore from database backup (if you have one)
-- 2. Re-run migrations 0000-0005 to recreate tables
-- 3. Re-run migration 0014 to add status column
-- 
-- OR accept that legacy qualification data is gone and continue
-- with new workflow engine only

