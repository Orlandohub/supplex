-- ============================================================================
-- SEC-001: Backfill app_metadata with authorization claims
-- ============================================================================
--
-- This migration modifies auth.users (a Supabase-managed table).
-- It is IDEMPOTENT — safe to run multiple times.
-- It does NOT remove data from raw_user_meta_data (non-destructive).
--
-- OPERATOR REVIEW REQUIRED before execution.
-- If migration runner compatibility with auth.users is uncertain,
-- run manually via Supabase SQL Editor instead.
-- ============================================================================

-- ── Pre-check (run manually in Supabase SQL Editor BEFORE migration) ────────
-- SELECT count(*) AS users_needing_migration
-- FROM auth.users
-- WHERE raw_user_meta_data->>'role' IS NOT NULL
--   AND (raw_app_meta_data->>'role' IS NULL
--        OR raw_app_meta_data->>'tenant_id' IS NULL);

-- ── Backfill: copy role and tenant_id from user_metadata to app_metadata ────
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'role', raw_user_meta_data->>'role',
       'tenant_id', raw_user_meta_data->>'tenant_id'
     )
WHERE raw_user_meta_data->>'role' IS NOT NULL
  AND raw_user_meta_data->>'tenant_id' IS NOT NULL;

-- ── Post-check (run manually in Supabase SQL Editor AFTER migration) ────────
-- SELECT count(*) AS users_still_missing
-- FROM auth.users
-- WHERE raw_app_meta_data->>'role' IS NULL
--    OR raw_app_meta_data->>'tenant_id' IS NULL;
