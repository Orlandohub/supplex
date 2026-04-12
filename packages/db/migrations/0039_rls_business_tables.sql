-- ============================================================================
-- SEC-003B: RLS Rollout for Remaining Public Business Tables
-- Enables RLS on 23 tables: 5 Tier 1 (RLS-only) + 18 Tier 2 (SELECT-only)
-- ============================================================================
-- Tier 1: Internal/operational — RLS enabled, no policies (default deny)
-- Tier 2: Domain/config — RLS enabled + tenant-scoped SELECT for authenticated
-- service_role bypasses RLS by design; no explicit bypass policies needed.
-- ============================================================================

-- ============================================================================
-- GROUP A LEGACY CLEANUP: Drop policies from rls-policies.sql (if applied)
-- ============================================================================

-- Suppliers: drop legacy policies
DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON suppliers;
DROP POLICY IF EXISTS "tenant_insert_suppliers" ON suppliers;
DROP POLICY IF EXISTS "tenant_update_suppliers" ON suppliers;
DROP POLICY IF EXISTS "tenant_delete_suppliers" ON suppliers;

-- Contacts: drop legacy policies
DROP POLICY IF EXISTS "tenant_isolation_contacts" ON contacts;
DROP POLICY IF EXISTS "tenant_supplier_match_contacts" ON contacts;

-- Documents: drop legacy policies
DROP POLICY IF EXISTS "tenant_isolation_documents" ON documents;
DROP POLICY IF EXISTS "tenant_insert_documents" ON documents;
DROP POLICY IF EXISTS "tenant_update_documents" ON documents;
DROP POLICY IF EXISTS "tenant_delete_documents" ON documents;

-- ============================================================================
-- TIER 1: RLS-only — no authenticated policy (default deny)
-- These tables are internal/operational. Only service_role accesses them.
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TIER 2: authenticated SELECT-only, tenant-scoped
-- These tables get a read-only defense-in-depth policy.
-- ============================================================================

-- === Group A: Legacy tables (suppliers, contacts, documents) ===

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_suppliers" ON suppliers;
CREATE POLICY "tenant_select_suppliers" ON suppliers
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_contacts" ON contacts;
CREATE POLICY "tenant_select_contacts" ON contacts
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_documents" ON documents;
CREATE POLICY "tenant_select_documents" ON documents
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- === Group B: Workflow execution tables ===

ALTER TABLE process_instance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_process_instance" ON process_instance;
CREATE POLICY "tenant_select_process_instance" ON process_instance
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE step_instance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_step_instance" ON step_instance;
CREATE POLICY "tenant_select_step_instance" ON step_instance
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE task_instance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_task_instance" ON task_instance;
CREATE POLICY "tenant_select_task_instance" ON task_instance
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE workflow_step_document ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_workflow_step_document" ON workflow_step_document;
CREATE POLICY "tenant_select_workflow_step_document" ON workflow_step_document
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE comment_thread ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_comment_thread" ON comment_thread;
CREATE POLICY "tenant_select_comment_thread" ON comment_thread
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- === Group C: Template & configuration tables ===

ALTER TABLE workflow_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_workflow_template" ON workflow_template;
CREATE POLICY "tenant_select_workflow_template" ON workflow_template
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE workflow_step_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_workflow_step_template" ON workflow_step_template;
CREATE POLICY "tenant_select_workflow_step_template" ON workflow_step_template
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE document_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_document_template" ON document_template;
CREATE POLICY "tenant_select_document_template" ON document_template
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE form_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_form_template" ON form_template;
CREATE POLICY "tenant_select_form_template" ON form_template
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE form_section ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_form_section" ON form_section;
CREATE POLICY "tenant_select_form_section" ON form_section
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE form_field ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_form_field" ON form_field;
CREATE POLICY "tenant_select_form_field" ON form_field
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE supplier_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_supplier_status" ON supplier_status;
CREATE POLICY "tenant_select_supplier_status" ON supplier_status
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE workflow_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_workflow_type" ON workflow_type;
CREATE POLICY "tenant_select_workflow_type" ON workflow_type
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- === Group D: Form data tables ===

ALTER TABLE form_submission ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_form_submission" ON form_submission;
CREATE POLICY "tenant_select_form_submission" ON form_submission
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE form_answer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_form_answer" ON form_answer;
CREATE POLICY "tenant_select_form_answer" ON form_answer
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ============================================================================
-- VERIFICATION QUERIES — run manually after applying
-- ============================================================================
-- Verify RLS is enabled on all public tables:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false
--   AND tablename NOT LIKE 'drizzle%';
-- Expected: empty result (all tables have RLS)
--
-- Verify policy inventory:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;

-- ============================================================================
-- EMERGENCY ROLLBACK — uncomment and run to revert all SEC-003B changes
-- ============================================================================
-- -- Tier 2: drop SELECT policies
-- DROP POLICY IF EXISTS "tenant_select_suppliers" ON suppliers;
-- DROP POLICY IF EXISTS "tenant_select_contacts" ON contacts;
-- DROP POLICY IF EXISTS "tenant_select_documents" ON documents;
-- DROP POLICY IF EXISTS "tenant_select_process_instance" ON process_instance;
-- DROP POLICY IF EXISTS "tenant_select_step_instance" ON step_instance;
-- DROP POLICY IF EXISTS "tenant_select_task_instance" ON task_instance;
-- DROP POLICY IF EXISTS "tenant_select_workflow_step_document" ON workflow_step_document;
-- DROP POLICY IF EXISTS "tenant_select_comment_thread" ON comment_thread;
-- DROP POLICY IF EXISTS "tenant_select_workflow_template" ON workflow_template;
-- DROP POLICY IF EXISTS "tenant_select_workflow_step_template" ON workflow_step_template;
-- DROP POLICY IF EXISTS "tenant_select_document_template" ON document_template;
-- DROP POLICY IF EXISTS "tenant_select_form_template" ON form_template;
-- DROP POLICY IF EXISTS "tenant_select_form_section" ON form_section;
-- DROP POLICY IF EXISTS "tenant_select_form_field" ON form_field;
-- DROP POLICY IF EXISTS "tenant_select_supplier_status" ON supplier_status;
-- DROP POLICY IF EXISTS "tenant_select_workflow_type" ON workflow_type;
-- DROP POLICY IF EXISTS "tenant_select_form_submission" ON form_submission;
-- DROP POLICY IF EXISTS "tenant_select_form_answer" ON form_answer;
--
-- -- Disable RLS on all 23 tables
-- ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_notifications DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflow_event DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_invitations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_notification_preferences DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE process_instance DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE step_instance DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE task_instance DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflow_step_document DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE comment_thread DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflow_template DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflow_step_template DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_template DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE form_template DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE form_section DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE form_field DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE supplier_status DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflow_type DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE form_submission DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE form_answer DISABLE ROW LEVEL SECURITY;
