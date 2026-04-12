-- SQL-level test for custom_access_token_hook (SEC-009 Task 5.1)
-- Run in Supabase SQL Editor AFTER applying 0040_custom_access_token_hook.sql
--
-- Test 1: Valid user — claims should contain role and tenant_id
-- Test 2: Non-existent user — event returned unchanged
-- Test 3: User with NULL role — event returned unchanged
-- Test 4: Preserves pre-existing app_metadata keys

-- ============================================================
-- Test 1: Valid user with role and tenant_id
-- ============================================================
DO $$
DECLARE
  test_event jsonb;
  result jsonb;
  result_role text;
  result_tenant text;
  test_user_id uuid;
  expected_role text;
  expected_tenant text;
BEGIN
  -- Pick a real user who has both role and tenant_id set
  SELECT id, role, tenant_id::text
  INTO test_user_id, expected_role, expected_tenant
  FROM public.users
  WHERE role IS NOT NULL AND tenant_id IS NOT NULL
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 1 SKIPPED: No user with role and tenant_id found';
    RETURN;
  END IF;

  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(
      'app_metadata', jsonb_build_object('provider', 'email', 'providers', '["email"]'::jsonb),
      'sub', test_user_id::text,
      'aud', 'authenticated',
      'role', 'authenticated'
    )
  );

  result := public.custom_access_token_hook(test_event);

  result_role := result->'claims'->'app_metadata'->>'role';
  result_tenant := result->'claims'->'app_metadata'->>'tenant_id';

  ASSERT result_role = expected_role,
    format('TEST 1 FAILED: Expected role=%s, got=%s', expected_role, result_role);
  ASSERT result_tenant = expected_tenant,
    format('TEST 1 FAILED: Expected tenant_id=%s, got=%s', expected_tenant, result_tenant);

  -- Verify pre-existing keys preserved
  ASSERT result->'claims'->'app_metadata'->>'provider' = 'email',
    'TEST 1 FAILED: Pre-existing provider key was clobbered';

  RAISE NOTICE 'TEST 1 PASSED: Valid user — role=%, tenant_id=%, provider preserved', result_role, result_tenant;
END $$;

-- ============================================================
-- Test 2: Non-existent user — event returned unchanged
-- ============================================================
DO $$
DECLARE
  test_event jsonb;
  result jsonb;
  fake_id text := '00000000-0000-0000-0000-000000000000';
BEGIN
  test_event := jsonb_build_object(
    'user_id', fake_id,
    'claims', jsonb_build_object(
      'app_metadata', jsonb_build_object('provider', 'email'),
      'sub', fake_id,
      'aud', 'authenticated',
      'role', 'authenticated'
    )
  );

  result := public.custom_access_token_hook(test_event);

  -- Should be unchanged — no role or tenant_id injected
  ASSERT result->'claims'->'app_metadata'->>'role' IS NULL,
    'TEST 2 FAILED: role should be NULL for non-existent user';
  ASSERT result->'claims'->'app_metadata'->>'tenant_id' IS NULL,
    'TEST 2 FAILED: tenant_id should be NULL for non-existent user';
  ASSERT result->'claims'->'app_metadata'->>'provider' = 'email',
    'TEST 2 FAILED: Pre-existing provider key was modified';

  RAISE NOTICE 'TEST 2 PASSED: Non-existent user — event returned unchanged';
END $$;

-- ============================================================
-- Test 3: User with NULL role — event returned unchanged
-- (Simulated with a non-existent user since all real users should have roles)
-- ============================================================
DO $$
DECLARE
  test_event jsonb;
  result jsonb;
  fake_id text := '00000000-0000-0000-0000-999999999999';
BEGIN
  test_event := jsonb_build_object(
    'user_id', fake_id,
    'claims', jsonb_build_object(
      'app_metadata', '{}'::jsonb,
      'sub', fake_id,
      'aud', 'authenticated',
      'role', 'authenticated'
    )
  );

  result := public.custom_access_token_hook(test_event);

  ASSERT result->'claims'->'app_metadata'->>'role' IS NULL,
    'TEST 3 FAILED: role should be NULL when user has NULL role';
  ASSERT result->'claims'->'app_metadata'->>'tenant_id' IS NULL,
    'TEST 3 FAILED: tenant_id should be NULL when user has NULL role';

  RAISE NOTICE 'TEST 3 PASSED: NULL role/tenant — event returned unchanged';
END $$;

-- ============================================================
-- Test 4: Empty app_metadata — hook should create the key
-- ============================================================
DO $$
DECLARE
  test_event jsonb;
  result jsonb;
  test_user_id uuid;
  expected_role text;
  expected_tenant text;
BEGIN
  SELECT id, role, tenant_id::text
  INTO test_user_id, expected_role, expected_tenant
  FROM public.users
  WHERE role IS NOT NULL AND tenant_id IS NOT NULL
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 4 SKIPPED: No user with role and tenant_id found';
    RETURN;
  END IF;

  -- Event with NO app_metadata key at all
  test_event := jsonb_build_object(
    'user_id', test_user_id::text,
    'claims', jsonb_build_object(
      'sub', test_user_id::text,
      'aud', 'authenticated',
      'role', 'authenticated'
    )
  );

  result := public.custom_access_token_hook(test_event);

  ASSERT result->'claims'->'app_metadata'->>'role' = expected_role,
    format('TEST 4 FAILED: Expected role=%s', expected_role);
  ASSERT result->'claims'->'app_metadata'->>'tenant_id' = expected_tenant,
    format('TEST 4 FAILED: Expected tenant_id=%s', expected_tenant);

  RAISE NOTICE 'TEST 4 PASSED: Empty app_metadata — hook created key and injected claims';
END $$;
