-- ============================================================================
-- SEC-003A: Fix storage RLS policy claim path
-- Changes from current_setting('request.jwt.claims') to auth.jwt() -> 'app_metadata'
-- ============================================================================
-- The old policy used current_setting('request.jwt.claims')::json->>'tenant_id'
-- which reads from the JWT top level. After SEC-001, tenant_id lives in
-- app_metadata. The old policy always evaluated to NULL (safe-fail: deny all).
-- This migration corrects the claim path so the policy is functional.
-- ============================================================================

-- Drop old policies (handles both naming conventions from migration 0033 and storage-bucket-setup.sql)
DROP POLICY IF EXISTS "Tenant scoped read for supplier-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can access their tenant's documents" ON storage.objects;

-- Recreate with correct claim path (app_metadata)
CREATE POLICY "Tenant scoped read for supplier-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

-- ============================================================================
-- VERIFICATION — run manually after applying
-- ============================================================================
-- SELECT policyname, qual FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE '%supplier-documents%';
-- Expected: qual contains 'app_metadata' (not 'request.jwt.claims')
