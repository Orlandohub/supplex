-- Story 2.2.20: Enable Row Level Security on Supabase Storage
-- Defense-in-depth: prevents direct bucket access outside the API from crossing tenant boundaries.
-- The API server's supabaseAdmin client uses the service_role key which bypasses RLS by default.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped SELECT: users can only read objects whose top-level folder matches their tenant_id.
CREATE POLICY "Tenant scoped read for supplier-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json->>'tenant_id')
  );

-- Service-role INSERT: included for completeness; service_role already bypasses RLS.
CREATE POLICY "Service role can insert into supplier-documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'supplier-documents'
  );
