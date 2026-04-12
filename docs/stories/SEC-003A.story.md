# Story SEC-003A: RLS Rollout for Exposed Tables

<!-- Powered by BMAD™ Core -->

## Status

**Done**

Date Created: April 5, 2026

---

## Story

**As a** platform operator,
**I want** Row Level Security enabled and enforced on the `users` and `tenants` tables that the browser client queries directly via PostgREST, and the storage RLS policy fixed to use the correct JWT claim path,
**so that** a compromised or malicious browser client cannot read or modify data from other tenants, even with the anon key exposed in `window.ENV`.

---

## Context

This story addresses the highest-urgency RLS gap: tables that the browser client queries directly via the Supabase JavaScript SDK (which uses PostgREST and the anon key).

The Supabase anon key is exposed in the browser (`window.ENV.SUPABASE_ANON_KEY` in `root.tsx`). Without RLS, any JavaScript running in the browser can construct arbitrary queries against unprotected tables. The `.eq("id", user.id)` filter in the application code is a **client-side filter** — PostgREST does not enforce it server-side unless RLS is enabled.

The API server uses the `service_role` key, which **bypasses RLS** by default. Enabling RLS on these tables does not affect API server behavior.

### Analysis Report Items Addressed

| ID | Finding | Severity |
|----|---------|----------|
| T4 | **Browser client queries `users` and `tenants` directly via PostgREST** — must have functional RLS on these tables. `AuthProvider.tsx` uses `supabase.from("users").select("*, tenant:tenants(*)").eq("id", user.id)`. Without RLS, any JavaScript can query these tables. | **Critical** |
| F4 | **Storage RLS `tenant_id` path does not match JWT claim location** — the policy references `current_setting('request.jwt.claims', true)::json->>'tenant_id'` which reads from the JWT top level. After SEC-001, `tenant_id` lives in `app_metadata`. The storage policy is currently non-functional (safe-fail: denies all direct access) but must be corrected. | **High** |

### Dependencies

- **Depends on SEC-001** — RLS policies must reference `app_metadata.tenant_id`, which is only populated after the SEC-001 claims model migration and backfill are complete.
- **Downstream**: SEC-003B (RLS for remaining business tables) builds on the patterns established here.

### Relationship to Legacy `rls-policies.sql`

The file `packages/db/rls-policies.sql` is a manual SQL script that was never converted to a migration. It contains RLS policies for `tenants`, `users`, `suppliers`, `contacts`, `documents`, and several legacy qualification tables. **We do not know whether it has been applied** to any environment.

This story creates a **version-controlled migration** that:
- Uses `DROP POLICY IF EXISTS` before `CREATE POLICY` — idempotent whether or not the legacy script was previously applied.
- Covers `users` and `tenants` only (SEC-003A scope). Remaining tables are covered by SEC-003B.

After SEC-003A and SEC-003B are both complete, the legacy `rls-policies.sql` script should be marked as superseded.

---

## Acceptance Criteria

### AC 1: RLS Enabled on `users` Table

1. A version-controlled migration enables RLS on the `users` table: `ALTER TABLE users ENABLE ROW LEVEL SECURITY`.
2. A tenant-isolation SELECT policy for the `authenticated` role ensures browser queries return only rows where `tenant_id` matches the JWT `app_metadata.tenant_id` claim.
3. The policy uses `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` as the claim path — consistent with the standardized path from SEC-001.
4. No permissive policies for INSERT, UPDATE, or DELETE are granted to `authenticated` or `anon`. All write operations go through the API server (`service_role`, which bypasses RLS by design). Roles without a matching permissive policy are denied by default.

### AC 2: RLS Enabled on `tenants` Table

5. The same migration enables RLS on the `tenants` table.
6. A tenant-isolation SELECT policy for the `authenticated` role ensures queries return only the row where `id` matches the JWT `app_metadata.tenant_id` claim.

### AC 3: Storage RLS Policy Claim Path Fixed

7. A migration drops and recreates the storage `SELECT` policy on `storage.objects` to use `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` instead of `current_setting('request.jwt.claims', true)::json->>'tenant_id'`.
8. The `storage-bucket-setup.sql` manual script is updated to reflect the corrected claim path (documentation alignment).

### AC 4: Browser Auth Flow Unbroken

9. The `AuthProvider.tsx` query `supabase.from("users").select("*, tenant:tenants(*)").eq("id", user.id).single()` continues to return the authenticated user's record and their tenant.
10. The `session.server.ts` queries `supabase.from("users").select("*").eq("id", user.id).single()` continue to work — these run server-side with the user's session token, so RLS applies and the tenant filter is enforced via JWT claims.
11. The `useAuth.ts` queries for user record and admin contact info continue to work.

### AC 5: No API Server Regressions

12. The API server uses `service_role` (bypasses RLS by design). All API routes continue to function identically. No explicit `service_role` bypass policy is needed.
13. All existing tests pass. Tests that insert/query `users` and `tenants` via the direct database connection (Drizzle + `service_role`) are unaffected.

---

## Tasks / Subtasks

### Task 1: Create RLS Migration for `users` and `tenants` (AC: 1, 2, 5)

- [x] **1.1** Create migration file `packages/db/migrations/0037_rls_users_tenants.sql`.
- [x] **1.2** Enable RLS on both tables:
  ```sql
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
  ```
- [x] **1.3** Add tenant-isolation policies for `users` (for `authenticated` role):
  ```sql
  -- Drop legacy policies if they exist (from rls-policies.sql)
  DROP POLICY IF EXISTS "tenant_isolation_users" ON users;

  -- Users: authenticated users can SELECT only their tenant's rows
  CREATE POLICY "tenant_select_users" ON users
    FOR SELECT
    TO authenticated
    USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

  -- Users: no INSERT/UPDATE/DELETE via browser — these operations go through the API server (service_role)
  -- If browser-side writes are ever needed, add explicit policies. For now, deny by default.
  ```
- [x] **1.4** Add tenant-isolation policies for `tenants` (for `authenticated` role):
  ```sql
  DROP POLICY IF EXISTS "tenant_isolation_tenants" ON tenants;

  -- Tenants: authenticated users can SELECT only their own tenant
  CREATE POLICY "tenant_select_tenants" ON tenants
    FOR SELECT
    TO authenticated
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
  ```
- [x] **1.5** Add a commented emergency rollback section at the end of the migration:
  ```sql
  -- ============================================================================
  -- EMERGENCY ROLLBACK — uncomment and run if browser auth flow breaks
  -- ============================================================================
  -- DROP POLICY IF EXISTS "tenant_select_users" ON users;
  -- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
  --
  -- DROP POLICY IF EXISTS "tenant_select_tenants" ON tenants;
  -- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
  ```

### Task 2: Fix Storage RLS Policy Claim Path (AC: 3)

- [x] **2.1** Create migration file `packages/db/migrations/0038_fix_storage_rls_claim_path.sql`:
  ```sql
  -- Drop the old policy with incorrect claim path
  DROP POLICY IF EXISTS "Tenant scoped read for supplier-documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can access their tenant's documents" ON storage.objects;

  -- Recreate with correct claim path (app_metadata)
  CREATE POLICY "Tenant scoped read for supplier-documents"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'supplier-documents'
      AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );
  ```
- [x] **2.2** Update `packages/db/storage-bucket-setup.sql` to use the corrected claim path (documentation alignment — this file may be used for new environment setup).

### Task 3: Verify Browser Auth Flow (AC: 4)

- [ ] **3.1** After applying the migration in dev, log in to the application and verify:
  - `AuthProvider.tsx` fetch succeeds (user record + tenant returned)
  - `session.server.ts` fetch succeeds (user record returned for server-side loaders)
  - No 403 or empty results from the `users` / `tenants` queries
  - **Note: Manual operator step — cannot be automated by dev agent.**
- [ ] **3.2** Verify the admin contact lookup in `useAuth.ts` (lines 104-110) still works. This query fetches another user in the same tenant (filtered by `tenant_id`, `role = "admin"`, and `is_active = true` with `limit(1)`) — it must still return a result under the tenant-isolation SELECT policy.
  - **Note: Manual operator step — cannot be automated by dev agent.**

### Task 4: Verify Storage Access (AC: 3)

- [ ] **4.1** After applying the storage migration, verify that document download (signed URLs) still works. The API server uses `service_role` for generating signed URLs, so this should be unaffected.
  - **Note: Manual operator step — cannot be automated by dev agent.**
- [ ] **4.2** Verify that the storage policy correctly scopes direct browser access (if any) to the tenant's folder path.
  - **Note: Manual operator step — cannot be automated by dev agent.**

### Task 5: Add Verification Queries to Migration (AC: 1, 2)

- [x] **5.1** Add commented verification queries at the end of the migration for the operator to run manually:
  ```sql
  -- Verify RLS is enabled
  -- SELECT tablename, rowsecurity FROM pg_tables
  --   WHERE schemaname = 'public' AND tablename IN ('users', 'tenants');

  -- Verify policies exist
  -- SELECT tablename, policyname, roles, cmd FROM pg_policies
  --   WHERE schemaname = 'public' AND tablename IN ('users', 'tenants')
  --   ORDER BY tablename, policyname;
  ```

### Task 6: Update Legacy Script Documentation

- [x] **6.1** Add a comment at the top of `packages/db/rls-policies.sql`:
  ```sql
  -- ============================================================================
  -- LEGACY SCRIPT — DO NOT USE FOR NEW DEPLOYMENTS
  -- The `users` and `tenants` policies are now managed by migration 0037.
  -- Remaining tables will be migrated in SEC-003B.
  -- This file is retained for reference only.
  -- ============================================================================
  ```

---

## Dev Notes

### Browser-Accessed Tables Inventory

The browser client (using the anon key via PostgREST) queries these tables:

| Table | Query Location | Query Pattern |
|-------|---------------|---------------|
| `users` | `AuthProvider.tsx` (lines 76-88, 116-120) | `supabase.from("users").select("*, tenant:tenants(*)").eq("id", user.id).single()` |
| `users` | `session.server.ts` (lines 226-230, 281-285) | `supabase.from("users").select("*").eq("id", user.id).single()` |
| `users` | `useAuth.ts` (lines 89-92, 104-107, 328-331) | `supabase.from("users").select("*").eq("id", user.id)` and admin contact lookup |
| `tenants` | `AuthProvider.tsx` (via join) | Accessed through `tenant:tenants(*)` join on the `users` query |

**Important**: The `session.server.ts` queries run server-side in Remix loaders. They use the user's Supabase session (not `service_role`), so RLS still applies to these queries.

### Supabase RLS + PostgREST Role Model

| Client | Supabase Key Used | PostgREST Role | RLS Applies? |
|--------|-------------------|----------------|-------------|
| Browser JS SDK | `anon` key | `anon` (before login) / `authenticated` (after login) | **Yes** |
| Remix SSR loaders | User's session token | `authenticated` | **Yes** |
| API server (Elysia) | `service_role` key | `service_role` | **No** (bypasses RLS) |

### Why No Explicit `service_role` or `anon` Policies?

- **`service_role` bypasses RLS by design** in Supabase. The API server connects with `service_role` and is unaffected by RLS policies. Adding explicit `TO service_role USING (true)` bypass policies is unnecessary, clutters the policy list, and teaches the wrong pattern for future RLS work. If `FORCE ROW LEVEL SECURITY` is ever applied to table owners, that decision should be addressed in a dedicated story — not preemptively worked around.
- **`anon` is denied by default** once RLS is enabled and no permissive policy grants `anon` access. Adding explicit `USING (false)` deny-all policies for `anon` is redundant with standard PostgreSQL RLS behavior. Relying on default deny keeps the policy set minimal and idiomatic.

### Storage RLS Claim Path Issue (F4)

**Current** (migration 0033 and `storage-bucket-setup.sql`):
```sql
(current_setting('request.jwt.claims', true)::json->>'tenant_id')
```
This reads `tenant_id` from the **top level** of the JWT claims object. Supabase does not put custom claims at the top level — `tenant_id` lives inside `user_metadata` (before SEC-001) or `app_metadata` (after SEC-001). The result is always `NULL`, causing the policy to deny all direct browser access. This is a safe-fail, but the policy is non-functional.

**Fixed** (this story):
```sql
(auth.jwt() -> 'app_metadata' ->> 'tenant_id')
```
This correctly reads from `app_metadata`, matching the standardized claim path from SEC-001. After this fix, the storage policy is fully functional for direct browser access.

### Policy Design Decisions

1. **SELECT-only for `authenticated` role on `users` and `tenants`.** The browser never needs to INSERT, UPDATE, or DELETE rows in these tables — all mutations go through the Elysia API server (which uses `service_role`). Granting only SELECT to `authenticated` follows the principle of least privilege. Roles without a matching permissive policy (including `anon` and `authenticated` for non-SELECT operations) are denied by default.
2. **Tenant-wide user visibility.** The `users` SELECT policy allows authenticated users to read all `users` rows within their own tenant. This is intentional: the current frontend queries (e.g., the admin contact lookup in `useAuth.ts`) require tenant-scoped visibility. This is a current-application compatibility decision. Finer-grained intra-tenant least-privilege on `users` (e.g., restricting to own row only) is a separate concern to evaluate later if needed.
3. **No explicit `service_role` or `anon` policies.** `service_role` bypasses RLS by design; `anon` is denied by default when no permissive policy exists. See the "Why No Explicit `service_role` or `anon` Policies?" section above.
4. **`DROP POLICY IF EXISTS` before `CREATE POLICY`.** Makes the migration idempotent. If the legacy `rls-policies.sql` was already applied, the old policies are cleanly replaced.

### Implementation Guardrails

1. **Do not enable RLS on business tables** (workflow engine, forms, templates) in this story. Those are in SEC-003B scope.
2. **Do not modify any application code.** This story is SQL-only. The browser queries already include correct client-side filters; RLS adds server-side enforcement.
3. **Do not change the `service_role` key usage** in the API server. It must continue to bypass RLS.
4. **RLS correctness must be verified via SQL-level policy testing, not just browser behavior.** The primary proof is the `SET ROLE authenticated` + `set_config` verification in Step 6. Browser login (Step 7) is a supplementary sanity check. Drizzle/Bun tests use `service_role` and cannot verify RLS behavior.
5. **The storage policy fix must use `auth.jwt()` not `current_setting()`.** The `auth.jwt()` function is the Supabase-standard way to access JWT claims in RLS policies. The `current_setting('request.jwt.claims')` approach is an older pattern that requires specific PostgREST configuration.
6. **Verify actual storage policy names before applying migration 0038.** The `DROP POLICY` statements reference specific policy names derived from the current codebase (`storage-bucket-setup.sql` and migration 0033). If the target environment has different policy names (e.g., policies were created manually or modified), the migration must be adjusted to match. The operator should run `SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';` before applying and confirm the names match those being dropped.

### Testing [Source: architecture/testing-strategy.md]

- **Unit/integration tests** (Bun test) use `service_role` and bypass RLS — they cannot verify RLS behavior directly. Existing tests should pass without changes.
- **Manual verification** is required for RLS correctness — see Operator Manual Steps.
- **Key verification scenarios:**
  - Authenticated browser user sees their own record in `users`
  - Authenticated browser user sees their tenant in `tenants`
  - Authenticated browser user does NOT see other tenants' users
  - Unauthenticated (anon) user sees nothing
  - API server (service_role) continues to see all data

### Coding Standards [Source: architecture/coding-standards.md]

- RLS policies must be version-controlled in migrations [Source: auth-architecture-analysis-final.md, Section C.2]
- Migration files use sequential numbering starting from current highest (0036 from SEC-001, so this is 0037/0038)
- All database queries must include tenant filter (already met — this adds database-level enforcement)

---

## Operator Manual Steps

These steps must be performed by the operator at specific points during deployment.

### Prerequisites

- **SEC-001 must be complete and verified.** The RLS policies reference `app_metadata.tenant_id`. If SEC-001's backfill has not been applied, the policies will deny all access (safe-fail but broken UX).

### Before Deployment

**Step 1: Check current RLS state (Supabase SQL Editor)**

```sql
-- Check if RLS is already enabled on users/tenants (from legacy script)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tenants');

-- Check if legacy policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tenants');
```

This tells you whether the legacy `rls-policies.sql` was previously applied. The migration handles both cases (applied or not) via `DROP POLICY IF EXISTS`.

### During Deployment

**Step 2: Apply the migrations**

Run migrations 0037 and 0038 via the normal migration process. If applying manually:

1. Apply `0037_rls_users_tenants.sql` in the Supabase SQL Editor.
2. Apply `0038_fix_storage_rls_claim_path.sql` in the Supabase SQL Editor.

### After Deployment

**Step 3: Verify RLS is enabled (Supabase SQL Editor)**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tenants');
-- Expected: rowsecurity = true for both
```

**Step 4: Verify policies exist (Supabase SQL Editor)**

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tenants')
ORDER BY tablename, policyname;
-- Expected exactly two policies:
--   tenant_select_users   (roles: {authenticated}, cmd: SELECT)
--   tenant_select_tenants (roles: {authenticated}, cmd: SELECT)
-- No service_role or anon policies should be present.
-- If additional legacy policies appear, they may have come from
-- the old rls-policies.sql and can be dropped if they conflict.
```

**Step 5: Verify storage policy (Supabase SQL Editor)**

```sql
SELECT policyname, qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%supplier-documents%';
-- Expected: qual contains 'app_metadata' (not 'request.jwt.claims')
```

**Step 6: Verify tenant isolation via SQL (primary proof)**

Use the Supabase SQL Editor to simulate an authenticated user's view and confirm that RLS policies enforce tenant boundaries. This is the primary proof of RLS correctness — it verifies policy behavior independently of application code.

Replace `<TENANT_A_UUID>` with a real tenant ID:

```sql
-- Simulate authenticated user from Tenant A
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","app_metadata":{"tenant_id":"<TENANT_A_UUID>"}}',
  true);
SET ROLE authenticated;

-- Should return only Tenant A users
SELECT id, email, tenant_id FROM users;

-- Should return only Tenant A's row
SELECT id, name FROM tenants;

-- Reset
RESET ROLE;
```

Repeat with a different `tenant_id` and verify each query returns only that tenant's data. Also verify with `SET ROLE anon;` that no rows are returned at all (default deny, no permissive `anon` policy).

**Step 7: Verify browser auth flow (sanity check)**

This step is a supplementary sanity check — it confirms the application works end-to-end, but is not the primary proof of RLS correctness (Step 6 is).

1. Log in to the application as any user.
2. Verify the dashboard loads (user record + tenant loaded successfully).
3. Open browser DevTools → Network → look for any failed Supabase requests.
4. If everything loads correctly, RLS is working for the authenticated user.

Optionally, if you have access to two browser sessions:
1. Log in as Tenant A user in one browser.
2. Log in as Tenant B user in another browser (or incognito).
3. Compare the dashboard data — each user should see only their own tenant's users.

**Emergency Rollback**

If the browser auth flow is broken after migration 0037 (users cannot log in, dashboard fails to load), disable RLS immediately in the Supabase SQL Editor:

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
```

This restores pre-migration behavior. Investigate the claim path mismatch before re-enabling. The migration file includes a full commented rollback section.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-05 | 1.0 | Story created from auth architecture analysis report (SEC-003A: P1 RLS for Exposed Tables) | Bob (SM) |
| 2026-04-05 | 1.1 | PO refinement: fixed tenant-isolation verification approach (SQL Editor instead of browser global), added emergency rollback procedure to migration and operator notes, corrected admin contact query reference | Sarah (PO) |
| 2026-04-05 | 1.2 | PO refinement: removed unnecessary explicit `service_role` bypass and `anon` deny policies (rely on Supabase defaults), clarified tenant-wide user visibility as intentional compatibility decision, added storage policy name verification guardrail, reframed browser check as secondary to SQL-level policy verification | Sarah (PO) |
| 2026-04-06 | 1.3 | Implementation complete: migrations 0037 + 0038 created, storage-bucket-setup.sql updated, legacy script marked. Tasks 3/4 (browser/storage verification) are manual operator steps. | James (Dev Agent) |

---

## Dev Agent Record

### Agent Model Used
Claude claude-4.6-opus (via Cursor)

### Debug Log References
No debug log entries required — all tasks completed without blocking issues. This is a SQL-only story with no application code changes.

### Completion Notes
All automatable tasks completed (Tasks 1, 2, 5, 6). Tasks 3 and 4 are manual operator verification steps that require running the migrations in Supabase SQL Editor and testing browser login — these cannot be automated by the dev agent and are left as unchecked operator steps.

**Task 1 (RLS migration 0037):**
- Created `0037_rls_users_tenants.sql` with `ENABLE ROW LEVEL SECURITY` on both tables
- Drops legacy policies (`tenant_isolation_users`, `tenant_isolation_tenants`) before creating new ones — idempotent
- SELECT-only policies for `authenticated` role with `app_metadata.tenant_id` claim path
- No INSERT/UPDATE/DELETE policies — rely on default deny
- Emergency rollback section included (commented)
- Verification queries included (commented)

**Task 2 (Storage RLS migration 0038):**
- Created `0038_fix_storage_rls_claim_path.sql` replacing `current_setting('request.jwt.claims')` with `auth.jwt() -> 'app_metadata'`
- Drops both naming variants (`"Tenant scoped read for supplier-documents"` from migration 0033 and `"Users can access their tenant's documents"` from `storage-bucket-setup.sql`)
- Updated `storage-bucket-setup.sql` to match corrected claim path and policy name

**Task 5 (Verification queries):** Included in migration 0037 as commented SQL.

**Task 6 (Legacy script):** Added `LEGACY SCRIPT — DO NOT USE` header to `rls-policies.sql`.

**Existing tests:** 10/10 pass (sanity check). SQL migrations don't affect tests since they use `service_role` which bypasses RLS.

### File List

| File | Change |
|------|--------|
| `packages/db/migrations/0037_rls_users_tenants.sql` | **New file** — RLS + tenant-isolation SELECT policies for `users` and `tenants` |
| `packages/db/migrations/0038_fix_storage_rls_claim_path.sql` | **New file** — fixes storage policy claim path from `current_setting` to `auth.jwt() -> 'app_metadata'` |
| `packages/db/storage-bucket-setup.sql` | Updated SELECT policy to use `auth.jwt() -> 'app_metadata'` claim path and aligned policy name |
| `packages/db/rls-policies.sql` | Added legacy deprecation header |

---

## QA Results
_TBD_
