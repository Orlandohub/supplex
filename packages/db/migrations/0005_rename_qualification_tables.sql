-- Migration: Rename qualification-related tables for business alignment
-- Date: 2025-12-17
-- Story: 2.1.1 - Qualification Data Model Naming Alignment

-- Rename document_checklists to qualification_templates
ALTER TABLE "document_checklists" RENAME TO "qualification_templates";

-- Rename qualification_workflows to qualification_process
ALTER TABLE "qualification_workflows" RENAME TO "qualification_process";

-- Rename indexes for qualification_templates
ALTER INDEX "idx_document_checklists_tenant_default" 
  RENAME TO "idx_qualification_templates_tenant_default";

-- Rename indexes for qualification_process
ALTER INDEX "idx_qualification_workflows_tenant_supplier" 
  RENAME TO "idx_qualification_process_tenant_supplier";

ALTER INDEX "idx_qualification_workflows_tenant_status" 
  RENAME TO "idx_qualification_process_tenant_status";

-- Note: Foreign key constraints are automatically updated by PostgreSQL when tables are renamed
-- No manual FK constraint updates needed

