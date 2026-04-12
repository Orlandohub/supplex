# Authentication & Authorization Architecture Analysis — Final Report

**Date**: 2026-04-05
**Scope**: Full-stack auth/authz implementation review
**Status**: Analysis only — no changes implemented
**Revision**: Final — strict Supabase-aligned review for Scrum Master handoff
**Standard**: If the current implementation does not follow Supabase best practices, it must be refactored. "Works technically" is not an acceptable conclusion.

---

## A. Final Executive Judgment

**The current authentication and authorization implementation requires substantial refactor before it can be considered production-ready for a Supabase-aligned, enterprise-grade SaaS system.**

The application has a working auth pipeline, but it is built on patterns that Supabase has explicitly deprecated or warns against. Three structural problems disqualify the current implementation from enterprise-grade status:

1. **Authorization claims (`role`, `tenant_id`) are stored in `user_metadata`**, which Supabase allows any authenticated user to self-modify from the client SDK. This is a privilege-escalation and tenant-switching vulnerability. Supabase documentation explicitly warns against using `user_metadata` for authorization. This pattern must be removed.

2. **Row Level Security is not enabled on core application tables.** The browser client has the Supabase anon key and directly queries PostgREST for `users` and `tenants`. Without RLS, any JavaScript running in the browser can construct arbitrary queries against unprotected tables. Supabase documentation states RLS is non-negotiable for public-schema tables. This must be fixed.

3. **JWT verification uses the legacy HMAC shared secret**, which Supabase labels as "no longer recommended" and "not recommended for production applications." The project must migrate to asymmetric signing keys (ES256).

Beyond these structural issues, authorization enforcement is inconsistent across routes (~25+ routes have no role or permission check), entity-level access checks are partially applied, error response shapes vary across 3+ patterns, and the frontend uses polling-heavy session management that contradicts Supabase guidance.

**What is solid**: The two-tier auth cache, the correlation ID system, the permission matrix, the file validation pipeline, and the entity authorization helpers (where applied) are well-implemented. These can be retained and built upon.

**Required action**: A multi-story refactor program addressing the claims model, RLS, JWT signing, authorization consistency, and frontend auth patterns. The scope breakdown in Section D provides the story planning basis.

---

## B. Final Findings Review

### B.1 Critical Security — Must Fix Before Any Production Exposure

| ID | Finding | Verdict | Evidence |
|---|---|---|---|
| C1 | **JWT secret hardcoded fallback** — server starts with known secret `"dev-secret-key-change-in-production-min-32-chars"` if env vars are not set | **Must fix** | `config.ts` line 74. Zod validation passes because the fallback meets `min(32)`. No production guard exists. |
| C2 | **`workflow-health.ts` queries across all tenants** — a tenant admin sees every tenant's data | **Must fix** | Route queries `processInstance`, `taskInstance`, `stepInstance` with no `tenantId` filter. |
| C3 | **Role and tenant_id stored in `user_metadata`** — users can self-modify authorization claims | **Must fix — most critical finding** | `middleware.ts` line 171: `extractRoleFromMetadata(jwtPayload.user_metadata)`. Line 173: `jwtPayload.user_metadata?.tenant_id`. Supabase default behavior allows any authenticated user to call `auth.updateUser({ data: { role: "admin", tenant_id: "..." } })`. The `data` parameter maps to `user_metadata`. On the next token refresh, the modified claims appear in the JWT. All write paths (`register.ts`, `invite.ts`, `update-role.ts`, `suppliers/create.ts`, `suppliers/add-contact.ts`) write to `user_metadata`. **This pattern must be removed.** Authorization claims must be moved to `app_metadata` (minimum) or injected via a Custom Access Token Auth Hook (recommended by Supabase). |

**Note on C3 "Requires validation"**: The V2 report noted that a server-side hook could prevent `user_metadata` modification. However, Supabase's default behavior (without such a hook) allows it. The code does not show any such hook configured. **The fix must not be deferred pending validation** — the default-unsafe pattern must be replaced regardless. If a hook is found to exist, it reduces the immediate exploitability but does not change the architectural verdict: `user_metadata` is not the correct location for authorization claims.

### B.2 Supabase Misalignment — Must Refactor

These findings are not immediate exploits but represent architectural patterns that directly contradict Supabase's documented best practices. Under the project standard ("if it doesn't follow Supabase best practices, it should not remain in the app"), each must be refactored.

| ID | Finding | Verdict | Evidence |
|---|---|---|---|
| S1 | **Legacy HMAC (HS256) JWT verification** — Supabase labels this "no longer recommended" and "not recommended for production applications" | **Must migrate to asymmetric signing keys (ES256)** | `jwt-verifier.ts`: `jose.jwtVerify(token, secret)` with HMAC shared secret. Supabase docs: "There is almost no benefit from using a JWT signed with a shared secret." Migration to ES256 via JWKS endpoint (`/.well-known/jwks.json`) is the required direction. |
| S2 | **Session monitor polls `getUser()` every 30 seconds** — contradicts Supabase-recommended `onAuthStateChange` pattern | **Must remove polling; rely on `onAuthStateChange`** | `session-monitor.ts`: `setInterval(this.checkAndRefreshSession, 30000)` calls `supabase.auth.getUser()`. `AuthProvider.tsx` already registers `onAuthStateChange` for all relevant events. The polling is redundant and contradicts Supabase guidance. |
| S3 | **Double `getUser()` on initial page load** — unnecessary Supabase Auth round trips | **Must eliminate duplication** | `root.tsx` loader calls `getSession()` → `supabase.auth.getUser()`. `_app.tsx` loader calls `requireAuthSecure()` → `getAuthenticatedUser()` → `requireAuth()` → `supabase.auth.getUser()`. Two remote calls per initial page load. Supabase SSR guidance prescribes a single-pass validation. |
| S4 | **No RLS on public-schema application tables** — Supabase states "enable RLS on every table" | **Must enable RLS on all public-schema tables** | No `ENABLE ROW LEVEL SECURITY` in any migration for: `process_instance`, `step_instance`, `task_instance`, `workflow_step_document`, `comment_thread`, `workflow_event`, `form_submission`, `form_answer`, `form_template`, `form_section`, `form_field`, `workflow_template`, `workflow_step_template`, `email_notifications`, `user_invitations`, `user_notification_preferences`. The `rls-policies.sql` manual script covers only legacy tables and has never been converted to migrations. |
| S5 | **Three different JWT claim paths for `tenant_id`** across the codebase | **Must standardize to a single path** | API middleware: `jwtPayload.user_metadata?.tenant_id`. RLS policies script: `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`. Storage RLS: `current_setting('request.jwt.claims', true)::json->>'tenant_id'`. At most one of these can be correct at any given time. After the claims model fix (C3/S1), all paths must reference the same location. |

**Why S1 (HMAC migration) is "must" not "plan"**: The V2 report described this as "not urgent" and "should be on the roadmap." Under the strict standard, this assessment was too cautious. Supabase documentation states explicitly: "There is almost no benefit from using a JWT signed with a shared secret. [...] Using this approach can expose your project's data to significant security vulnerabilities or weaknesses." It further states that HMAC makes SOC2/PCI-DSS/ISO27000/HIPAA compliance "difficult." A "works technically" HMAC approach is not acceptable when the project goal is enterprise-grade Supabase alignment. Migration is required, though it is not the most urgent item.

### B.3 Authorization Coverage Gaps — Must Fix

All findings are code-verified and retained from V1/V2 without revision.

| ID | Finding | Routes Affected |
|---|---|---|
| A1 | `workflows/supplier-processes.ts` — no `verifyProcessAccess` | Supplier_user can view any supplier's processes |
| A2 | `workflows/processes/events.ts` — no entity authorization | Supplier_user can read any process's audit events |
| A3 | `workflows/comments/create.ts` — no `verifyProcessAccess` | Supplier_user can post comments on any process |
| A4 | `workflows/comments/get-by-step.ts` — no entity check | Supplier_user can read comments for any step |
| A5 | `workflows/steps/documents/upload.ts` — no `verifyStepProcessAccess` | Supplier_user can upload to any active step |
| A6 | `form-submissions/create-draft.ts` — no process access verification | Supplier_user can link drafts to arbitrary processes |
| A7 | `form-submissions/by-supplier.ts` — no role enforcement | Any user can list any supplier's submissions |
| A8 | Workflow template CRUD — no role restriction | Any authenticated user can create/edit/delete/publish workflow templates |
| A9 | Form template CRUD — no role restriction | Any authenticated user can create/edit/delete/publish form templates |
| A10 | Principle-of-least-privilege violation on templates | `viewer` and `supplier_user` roles can modify templates — these roles should have no write access to configuration data |

### B.4 Tenant Isolation / RLS Gaps — Must Fix

| ID | Finding | Verdict | Evidence |
|---|---|---|---|
| T1 | **No RLS on ~15+ workflow engine tables** | **Must enable RLS** — same as S4 | See S4 evidence. The browser has the anon key (`window.ENV.SUPABASE_ANON_KEY` in `root.tsx`). Any table without RLS is directly queryable via PostgREST. |
| T2 | **`workflow-health.ts` cross-tenant queries** | **Must add tenant filter** — same as C2 | See C2 evidence. |
| T3 | **RLS policy JWT claim path mismatch** | **Must standardize** — same as S5 | See S5 evidence. |
| T4 | **Browser client queries `users` and `tenants` directly via PostgREST** | **Must have functional RLS on these tables** | `AuthProvider.tsx`: `supabase.from("users").select("*, tenant:tenants(*)").eq("id", user.id).single()`. The `.eq("id", user.id)` is a client-side filter — PostgREST does not enforce it server-side unless RLS is enabled. With the anon key exposed in the browser, any JavaScript can query these tables if RLS is absent. |

**Critical clarification on the "backend-enforced" model**: The V2 report described the backend-enforced auth model (where the Elysia API server is the sole enforcement point and RLS is absent) as "a valid architectural choice." **This assessment is withdrawn.** The application uses the Supabase browser client to query PostgREST directly in `AuthProvider.tsx`. The anon key is exposed to the browser. Under these conditions, the backend-enforced-only model is insufficient. RLS must be enabled on all public-schema tables. This is not optional defense-in-depth — it is a Supabase requirement for any table accessible via PostgREST with the anon key.

### B.5 Storage / File Access Issues

| ID | Finding | Verdict |
|---|---|---|
| F1 | `steps/documents/upload.ts` missing entity auth | **Must add `verifyStepProcessAccess`** |
| F2 | No virus scanning on uploads | Retained as accepted Phase 2 item |
| F3 | Signed URLs are bearer links (5min TTL) | Retained as accepted risk — standard Supabase pattern |
| F4 | **Storage RLS `tenant_id` path does not match JWT claim location** | **Must fix as part of S5 (claim path standardization)** — the storage RLS policy references `current_setting('request.jwt.claims', true)::json->>'tenant_id'` which reads from the top level of JWT claims. If `tenant_id` is only in `user_metadata`, this policy evaluates to NULL. The result is a safe-fail (denies all direct access), but the policy is non-functional as written and must be corrected to reference the correct claim path after the claims model fix. |

### B.6 Frontend Auth & UX Issues

| ID | Finding | Verdict |
|---|---|---|
| U1 | Inconsistent 403 handling — some routes show "Access Denied", others generic error | **Must standardize** — add global 403 handler |
| U2 | Only `TOKEN_EXPIRED` 401s trigger redirect; other 401 types unhandled | **Must standardize** — add global 401 handler |
| U3 | `withTokenRefresh` middleware exists but unused | **Must remove** — dead code |
| U4 | Session monitor polling contradicts Supabase guidance | **Must remove** — same as S2 |
| U5 | Zustand store persists stale `userRecord` to `localStorage` | **Must address** — stale role/permissions can persist across sessions. Either clear on auth state change or re-validate on hydration. |

### B.7 Auth Performance Issues

These are not security vulnerabilities but they are architectural defects under the project's quality standard. Each creates unnecessary Supabase Auth load, degrades user experience, and contradicts Supabase-recommended patterns.

| ID | Finding | Verdict |
|---|---|---|
| P1 | **Double `getUser()` on every initial page load** (~100-400ms wasted) | **Must eliminate** — same as S3 |
| P2 | **Session monitor polls `getUser()` every 30s per active tab** | **Must remove** — same as S2. Creates `N_users * M_tabs * 2` Supabase Auth calls per minute. Supabase Auth has rate limits. |
| P3 | **API server calls `supabaseAdmin.auth.getUser(token)` on every cache miss** stacking with frontend calls | **Must optimize** — on a cache miss (every 5 min per user), the API server calls Supabase Auth. Combined with frontend calls, a single page load can trigger 3+ Supabase Auth round trips. After fixing P1/P2, the remaining API-side call is acceptable (once every 5 min is reasonable). |

### B.8 Consistency / Maintainability / Architecture Debt

| ID | Finding | Verdict |
|---|---|---|
| M1 | Admin enforcement split between `requireRole([ADMIN])` middleware and inline `if (user.role !== ADMIN)` checks | **Must standardize** — all admin routes must use middleware, never inline checks |
| M2 | 3+ different error response shapes across routes (`throw new Error(JSON.stringify(...))`, `return { success: false, error: {...} }`, `return { success: false, error: "string" }`, some return 200 with `success: false`) | **Must standardize** — single error shape, proper HTTP status codes |
| M3 | `admin/index.ts` comment says "All routes require Admin" but enforcement is per-child, inconsistent | **Must fix** — either enforce at the group level or correct the comment and enforce per-route via middleware |
| M4 | `admin/workflow-statuses.ts` implemented but not registered in `admin/index.ts` | **Must remove** — dead code |
| M5 | `extractRoleFromMetadata` silently defaults to `VIEWER` on missing/invalid role | **Must change to reject** — after claims model fix, a missing role should be an authentication failure, not a silent downgrade |
| M6 | `ProtectedRoute.tsx` component exists but is unused | **Must remove** — dead code |
| M7 | No compile-time or startup-time verification that all routes have appropriate auth | **Architecture debt** — a reusable foundation needs declarative route auth that can be audited. Should be addressed when implementing the mandatory-auth base plugin. |
| M8 | Legacy HMAC JWT verification | **Must migrate** — same as S1 |
| M9 | Three different JWT claim paths for `tenant_id` | **Must standardize** — same as S5 |

### B.9 Extractability / Foundation Concerns

| ID | Finding | Assessment |
|---|---|---|
| R1 | Auth primitives are coupled to `user_metadata` claim path | **Not extractable until claims model is fixed.** The `authenticate` middleware, `jwt-verifier.ts`, and `extractRoleFromMetadata` are all built around the `user_metadata` path. After migration to `app_metadata` or Auth Hook, these become extractable. |
| R2 | Permission matrix (`packages/types/src/models/permissions.ts`) | **Ready for extraction.** Business-agnostic, well-structured, no domain logic in check functions. |
| R3 | Entity authorization helpers are domain-specific | **Not extractable as-is.** A reusable foundation needs a generic entity-access interface that domain code implements. |
| R4 | Error response shapes are not standardized | **Not extractable until standardized.** A reusable foundation needs a single error contract. |
| R5 | Auth cache (`auth-cache.ts`) | **Ready for extraction** after replacing `console.error` with structured logger. |
| R6 | Route auth declaration is implicit | **Not extractable.** A reusable foundation needs a declarative auth-per-route pattern that can be audited and enforced. |

---

## C. Final Required Architecture Direction

This section states the required end-state architecture. These are not options or suggestions — they are the mandatory target for a Supabase-aligned, enterprise-grade implementation.

### C.1 Claims Model (addresses C3, T3, S5, M9, R1)

**Required**: Authorization claims (`role`, `tenant_id`) must not be in `user_metadata`.

**Immediate fix**: Move to `app_metadata` in all write paths. Update `authenticate` middleware to read from `app_metadata`. `app_metadata` is only writable by admin/service_role API calls, not by client SDK.

**Target state**: Implement a Custom Access Token Auth Hook — a PostgreSQL function that runs before each JWT is issued, reads the user's current role and tenant_id from the `users` table, and injects them as custom claims. This eliminates manual metadata sync, provides a single source of truth, and is the Supabase-recommended pattern.

**All RLS policies, storage policies, and API middleware must reference the same JWT claim path** after this change.

### C.2 Row Level Security (addresses S4, T1, T4)

**Required**: RLS must be enabled on every public-schema table.

At minimum, policies must enforce tenant isolation (`tenant_id` matches the JWT claim). For tables accessed by the browser client (`users`, `tenants`), policies must be functional and use the correct JWT claim path.

For tables only accessed via the API server (which uses service_role and bypasses RLS), RLS serves as defense-in-depth. It must still be enabled — a missing WHERE clause in application code should not result in cross-tenant data exposure.

**RLS policies must be version-controlled in migrations**, not manual SQL scripts.

### C.3 JWT Signing Keys (addresses S1, C1, M8)

**Required**: Migrate from legacy HMAC (HS256) shared secret to asymmetric signing keys (ES256).

After migration:
- JWT verification uses the JWKS endpoint (`/.well-known/jwks.json`) with public key caching
- No JWT secret needs to be stored as an env var or managed in application code
- Key rotation is zero-downtime via the Supabase dashboard
- The hardcoded secret fallback (C1) becomes irrelevant

**Until migration**: Remove the hardcoded fallback immediately and add a production guard that fails fast if the JWT secret is not configured.

### C.4 Authorization Enforcement (addresses A1-A10, M1, M7)

**Required**: Every API route must declare its auth requirements via middleware composition. Inline role/permission checks in handlers must be eliminated.

Specific requirements:
- A base Elysia plugin must ensure `authenticate` is applied to all API routes. Public routes must be explicitly opted out.
- All admin routes must use `requireRole([ADMIN])` or `requireAdmin` middleware.
- All routes that accept `processInstanceId`, `stepInstanceId`, or `supplierId` parameters for supplier-user-accessible data must include the appropriate entity authorization check.
- Workflow template and form template CRUD must require `requireRole` or `requirePermission` — these are configuration operations that `viewer` and `supplier_user` roles must not perform.

### C.5 Error Handling (addresses M2)

**Required**: A single standardized API error shape used across all routes.

- Auth failures must return proper HTTP status codes (401, 403) with a consistent JSON body (`{ error: { code, message, timestamp } }`)
- Route handlers must not return 200 with `{ success: false }` for error conditions
- The `throw new Error(JSON.stringify(...))` pattern must be replaced

**Required**: A global frontend error interceptor.

- 401 → redirect to login
- 403 → show "Access Denied"
- 500 → show error page
- Per-route error handling duplication must be removed

### C.6 Frontend Auth (addresses S2, S3, U1-U5, P1, P2)

**Required**:
- **Remove session monitor polling** — `onAuthStateChange` already handles all auth state transitions. The 30s `getUser()` poll must be removed.
- **Single-pass server auth** — eliminate the double `getUser()` call. `_app.tsx` is the single server-side validation point. `root.tsx` must use `getSession()` (local parse) only.
- **Global 401/403 handling** — see C.5.
- **Remove dead code** — `withTokenRefresh` middleware, `ProtectedRoute.tsx`.
- **Address stale Zustand state** — ensure `userRecord` in localStorage is cleared or re-validated on auth state change.

### C.7 Observability (addresses L1-L4)

**Required**:
- Replace all `console.error`/`console.log` with the structured Pino logger (especially in `auth-cache.ts` — 4 instances, and scattered across route handlers)
- Log all auth/authz denials at `warn` level with correlation ID, user ID, route, and source IP
- Ensure rate-limit blocks are logged

---

## D. Final Scope Recommendations for Refactor Stories

The Scrum Master should use the following scope breakdown for story planning. Priorities reflect the strict standard: security first, then Supabase alignment, then consistency, then performance, then cleanup.

### P0 — Must complete before any production exposure

| Scope | Complexity | Items | Dependency |
|---|---|---|---|
| **Claims model fix** (`user_metadata` → `app_metadata`) | Medium | C3, S5, T3, M9 — migrate role/tenant_id to `app_metadata` in all write paths; update `authenticate` middleware to read from `app_metadata`; backfill existing users' `app_metadata`; update RLS policies to reference `app_metadata` | None — do this first |
| **Critical security hardening** | Small | C1 (remove JWT secret fallback, add production guard), C2 (add tenant filter to `workflow-health.ts`) | None |

### P1 — Must complete before external-user access

| Scope | Complexity | Items | Dependency |
|---|---|---|---|
| **RLS enablement** | Medium-Large | S4, T1, T4 — enable RLS on all public-schema tables; create version-controlled migration(s); write tenant-isolation policies referencing `app_metadata`; verify browser-accessed tables (`users`, `tenants`) have functional policies; validate/retire the legacy `rls-policies.sql` | Depends on P0 claims model fix (policies must reference the correct claim path) |
| **Supplier-user entity authorization** | Medium | A1-A6, F1 — add `verifyProcessAccess` / `verifyStepProcessAccess` / `verifyDocumentAccess` to the ~7 routes missing entity-level checks | None |
| **Role enforcement and least-privilege** | Medium | A7-A10 — add `requireRole`/`requirePermission` to workflow template CRUD, form template CRUD, and `form-submissions/by-supplier` | None |

### P2 — Must complete for Supabase alignment and enterprise consistency

| Scope | Complexity | Items | Dependency |
|---|---|---|---|
| **JWT signing key migration** (HMAC → ES256) | Medium | S1, M8 — migrate to asymmetric signing keys via Supabase dashboard; update `jwt-verifier.ts` to use JWKS-based verification; remove `SUPABASE_JWT_SECRET` dependency; remove C1 hardcoded fallback (becomes irrelevant) | Independent — can run in parallel with other P2 work. Coordinate with claims model fix since both affect JWT structure. |
| **Frontend auth refactor** | Small-Medium | S2, S3, P1, P2, U4, U5 — remove session monitor; single-pass `getUser()` in `_app.tsx` only; clear stale Zustand state on auth change | Independent |
| **Standardize admin enforcement** | Small | M1, M3 — convert all inline admin checks to `requireAdmin`/`requireRole` middleware | None |
| **Standardize error responses** | Medium | M2, U1, U2 — create `createApiError` helper; migrate all routes; add global frontend 401/403/500 handler | None |
| **Custom Access Token Auth Hook** | Medium | Follow-up to P0 claims model fix — implement PostgreSQL hook for JWT claim injection from the `users` table; eliminate manual `app_metadata` sync | Depends on P0 claims model fix being stable |

### P3 — Cleanup and observability

| Scope | Complexity | Items | Dependency |
|---|---|---|---|
| **Logging and observability** | Small | L1-L4 — replace `console.error` with structured logger; add source IP to auth failure logs; log all auth denials | None |
| **Dead code removal** | Small | M4 (dead admin route), M6 (`ProtectedRoute.tsx`), U3 (`withTokenRefresh`), LP1-LP3 | None |
| **M5 — reject on missing role** | Small | Change `extractRoleFromMetadata` to throw on missing/invalid role instead of defaulting to VIEWER (do this after claims model fix) | Depends on P0 claims model fix |

### Scope Dependency Summary

```
P0: Claims model fix ──────────────┬──→ P1: RLS enablement
                                    ├──→ P2: Custom Access Token Auth Hook
                                    └──→ P3: M5 (reject on missing role)

P0: Critical security hardening ────→ (independent)

P1: Entity authorization ──────────→ (independent)
P1: Role enforcement ──────────────→ (independent)

P2: JWT signing key migration ─────→ (independent, coordinate with claims fix)
P2: Frontend auth refactor ────────→ (independent)
P2: Standardize admin enforcement ─→ (independent)
P2: Standardize error responses ───→ (independent)

P3: All cleanup items ─────────────→ (independent)
```

---

## Appendix: Evidence Sources

All findings are derived from direct code inspection of the files listed in the V1 report's implementation inventory. Supabase alignment assessments reference:

- [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) — "no longer recommended" for HMAC; "not recommended for production applications" for shared secrets; asymmetric keys (ES256) are the recommended approach
- [Custom Claims & RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) — Custom Access Token Auth Hooks are the recommended pattern for injecting roles into JWTs; `user_metadata` is not suitable for authorization
- [Row Level Security](https://supabase.com/docs/learn/auth-deep-dive/auth-row-level-security) — "enable RLS on every table"; without RLS, "anyone with your anon API key can read or modify all data"
- [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — `getUser()` for server-side validation; `getSession()` for reading local session data
- [onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) — recommended over polling for auth state management
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — service_role bypasses RLS; signed URLs for private buckets

### Items Requiring Runtime Validation

The following cannot be determined from code alone and should be verified via the Supabase dashboard or direct database inspection. **None of these should delay the refactor** — the code evidence is sufficient to mandate the architectural changes regardless of runtime state.

| Item | What to check | Why it matters |
|---|---|---|
| Whether `user_metadata` modification is restricted by a server-side hook | Supabase dashboard → Auth → Hooks | If no hook exists, C3 is immediately exploitable. If a hook exists, C3 is still the wrong architectural pattern. |
| Whether RLS is enabled on `users` and `tenants` tables | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` | If RLS is not enabled, T4 is immediately exploitable via the browser's PostgREST access. |
| Whether `rls-policies.sql` has been applied | Same query as above, plus `SELECT * FROM pg_policies WHERE schemaname = 'public'` | Determines whether legacy tables have any RLS protection and whether policies use the correct JWT claim path. |
