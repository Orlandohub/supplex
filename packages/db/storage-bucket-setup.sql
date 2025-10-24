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
-- RLS Policies for Storage Bucket (Phase 2 - currently using application-level security)
-- ============================================================================
-- Note: For MVP, we rely on application-level tenant filtering in API endpoints.
-- RLS policies on storage buckets will be added in Phase 2 for defense-in-depth.
--
-- Planned RLS Policy (Phase 2):
-- CREATE POLICY "Users can access their tenant's documents"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'supplier-documents' 
--   AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json->>'tenant_id')
-- );
--
-- This policy would ensure users can only access files in their tenant's folder.
-- Storage path pattern: {tenantId}/{supplierId}/{uuid}_{filename}
-- ============================================================================

-- Verify bucket was created
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'supplier-documents';

