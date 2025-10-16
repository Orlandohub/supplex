-- ============================================================================
-- Supabase Row Level Security (RLS) Policies for Supplex
-- ============================================================================
-- Purpose: Enforce tenant isolation at the database level
-- 
-- These policies ensure that:
-- 1. Users can only access data from their own tenant
-- 2. All queries are automatically filtered by tenant_id from JWT
-- 3. Defense-in-depth: RLS is the last line of defense against bugs
--
-- Usage:
-- 1. Apply this file to your Supabase database via SQL Editor
-- 2. Test each policy manually before deploying to production
-- 3. Update policies when adding new tables
-- ============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tenant
CREATE POLICY "tenant_isolation_tenants" ON tenants
  FOR ALL
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see users in their tenant
CREATE POLICY "tenant_isolation_users" ON users
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================

-- Enable RLS on suppliers table
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see suppliers in their tenant (excluding soft-deleted)
CREATE POLICY "tenant_isolation_suppliers" ON suppliers
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND deleted_at IS NULL
  );

-- Policy: Users can insert suppliers in their tenant
CREATE POLICY "tenant_insert_suppliers" ON suppliers
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Policy: Users can update suppliers in their tenant
CREATE POLICY "tenant_update_suppliers" ON suppliers
  FOR UPDATE
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND deleted_at IS NULL
  );

-- Policy: Users can soft-delete suppliers in their tenant
CREATE POLICY "tenant_delete_suppliers" ON suppliers
  FOR UPDATE
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================

-- Enable RLS on contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see contacts for suppliers in their tenant
CREATE POLICY "tenant_isolation_contacts" ON contacts
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Additional policy: Ensure supplier belongs to same tenant (INSERT/UPDATE)
CREATE POLICY "tenant_supplier_match_contacts" ON contacts
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM suppliers 
      WHERE suppliers.id = contacts.supplier_id 
      AND suppliers.tenant_id = contacts.tenant_id
    )
  );

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see documents in their tenant (excluding soft-deleted)
CREATE POLICY "tenant_isolation_documents" ON documents
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND deleted_at IS NULL
  );

-- Policy: Users can insert documents in their tenant
CREATE POLICY "tenant_insert_documents" ON documents
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM suppliers 
      WHERE suppliers.id = documents.supplier_id 
      AND suppliers.tenant_id = documents.tenant_id
    )
  );

-- Policy: Users can update documents in their tenant
CREATE POLICY "tenant_update_documents" ON documents
  FOR UPDATE
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    AND deleted_at IS NULL
  );

-- Policy: Users can soft-delete documents in their tenant
CREATE POLICY "tenant_delete_documents" ON documents
  FOR UPDATE
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Use these queries to verify RLS policies are working correctly
-- Replace the UUID values with actual tenant IDs from your database
-- ============================================================================

-- Test 1: Verify RLS is enabled on all tables
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'users', 'suppliers', 'contacts', 'documents');
-- Expected: rowsecurity = true for all tables

-- Test 2: List all RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test 3: Simulate tenant isolation (requires test data)
-- Set JWT context for tenant A (replace UUID)
-- SELECT set_config('request.jwt.claims', '{"app_metadata":{"tenant_id":"550e8400-e29b-41d4-a716-446655440000"}}', true);
-- SELECT COUNT(*) FROM suppliers; -- Should only see tenant A suppliers

-- ============================================================================
-- ROLLBACK SCRIPT (Use if needed to remove all policies)
-- ============================================================================
-- UNCOMMENT AND RUN ONLY IF YOU NEED TO REMOVE ALL POLICIES

-- DROP POLICY IF EXISTS "tenant_isolation_tenants" ON tenants;
-- DROP POLICY IF EXISTS "tenant_isolation_users" ON users;
-- DROP POLICY IF EXISTS "tenant_isolation_suppliers" ON suppliers;
-- DROP POLICY IF EXISTS "tenant_insert_suppliers" ON suppliers;
-- DROP POLICY IF EXISTS "tenant_update_suppliers" ON suppliers;
-- DROP POLICY IF EXISTS "tenant_delete_suppliers" ON suppliers;
-- DROP POLICY IF EXISTS "tenant_isolation_contacts" ON contacts;
-- DROP POLICY IF EXISTS "tenant_supplier_match_contacts" ON contacts;
-- DROP POLICY IF EXISTS "tenant_isolation_documents" ON documents;
-- DROP POLICY IF EXISTS "tenant_insert_documents" ON documents;
-- DROP POLICY IF EXISTS "tenant_update_documents" ON documents;
-- DROP POLICY IF EXISTS "tenant_delete_documents" ON documents;

-- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================

