-- ============================================================================
-- Supabase Storage Bucket Setup for Document Management
-- Story 1.8: Document Upload & Management
-- ============================================================================

-- Create supplier-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
  false, -- Private bucket (not publicly accessible)
  10485760, -- 10MB file size limit
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS Policies for Storage Bucket (Active — Story 2.2.20)
-- ============================================================================
-- Defense-in-depth: RLS on storage.objects scopes direct SDK access by tenant.
-- The API server uses the service_role key which bypasses RLS by default.
-- Storage path pattern: {tenantId}/{supplierId}/{uuid}_{filename}
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped SELECT: users can only read files in their tenant's folder
CREATE POLICY "Tenant scoped read for supplier-documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'supplier-documents'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

-- Service-role INSERT: allows the API server (service_role) to write files.
-- Note: service_role bypasses RLS by default in Supabase, but this policy
-- is included for documentation and defense-in-depth if RLS is forced.
CREATE POLICY "Service role can insert documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'supplier-documents'
  );

-- Verify bucket was created
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'supplier-documents';

