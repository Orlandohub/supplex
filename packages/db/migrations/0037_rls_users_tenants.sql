-- ============================================================================
-- SEC-003A: RLS Rollout for users and tenants tables
-- Enables Row Level Security with tenant-isolation SELECT policies.
-- ============================================================================
-- The browser client queries these tables directly via PostgREST (anon key).
-- Without RLS, any JavaScript can construct arbitrary queries.
-- The API server uses service_role which bypasses RLS by design.
-- ============================================================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if they exist (from rls-policies.sql manual script)
DROP POLICY IF EXISTS "tenant_isolation_users" ON users;
DROP POLICY IF EXISTS "tenant_isolation_tenants" ON tenants;

-- Users: authenticated users can SELECT only their tenant's rows
CREATE POLICY "tenant_select_users" ON users
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Tenants: authenticated users can SELECT only their own tenant
CREATE POLICY "tenant_select_tenants" ON tenants
  FOR SELECT
  TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- No INSERT/UPDATE/DELETE policies for authenticated or anon.
-- All write operations go through the API server (service_role, bypasses RLS).
-- Roles without a matching permissive policy are denied by default.

-- ============================================================================
-- VERIFICATION QUERIES — run manually after applying
-- ============================================================================
-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('users', 'tenants');
--
-- Verify policies exist:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('users', 'tenants')
--   ORDER BY tablename, policyname;

-- ============================================================================
-- EMERGENCY ROLLBACK — uncomment and run if browser auth flow breaks
-- ============================================================================
-- DROP POLICY IF EXISTS "tenant_select_users" ON users;
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "tenant_select_tenants" ON tenants;
-- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
