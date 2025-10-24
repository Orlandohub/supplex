-- Migration: Fix typo in column name from 'snapshoted_checklist' to 'snapshotted_checklist'
-- Date: 2025-10-24
-- Story: 2.3 - Initiate Qualification Workflow (QA Fix)

ALTER TABLE "qualification_workflows" 
RENAME COLUMN "snapshoted_checklist" TO "snapshotted_checklist";

