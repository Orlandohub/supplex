# Bug Story: Team Members Settings Page Shows Empty List

<!-- Powered by BMAD™ Core -->

## Status

**Approved**

Date Created: December 16, 2025  
Identified By: Manual Testing (User Acceptance Testing)  
Severity: **Critical** (Core user management functionality completely broken)  
Story Type: Bug Fix  
Priority: 🔴 **Blocker** - Must fix before new development continues

---

## Bug Description

**As an** admin user,  
**I want** to see all team members in my tenant on the Settings > Team Members page,  
**so that** I can manage users, assign roles, and perform user administration tasks.

---

## Current Behavior (Bug)

1. Admin user logs in successfully
2. Admin belongs to a tenant with multiple users (verified in database)
3. Admin navigates to Settings > Team Members page
4. **Result:** User list is completely empty - no users are displayed
5. Admin cannot manage users, change roles, or perform any user administration

**Verification:**
- Database confirmed: Admin and other users exist in same tenant
- Login works: Admin can authenticate successfully
- Other pages load: Problem is specific to Team Members page
- No error messages: Page loads but shows empty state

---

## Expected Behavior

When admin navigates to Settings > Team Members:
1. Page loads successfully
2. All users in admin's tenant are displayed in a table/list
3. User information shown: Name, Email, Role, Status
4. Admin can perform actions: Change Role, Deactivate User, Invite New User
5. User count matches actual tenant members in database

---

## Root Cause Analysis (Investigation Needed)

**Potential Causes:**

**Frontend Issue (Most Likely):**
- File: `apps/web/app/routes/_app.settings.users.tsx` (line 374)
- Loader may not be correctly fetching users from API
- API response may not match expected data structure
- Component may be filtering users incorrectly (tenant/role filtering)
- Empty state may be shown prematurely

**Backend Issue:**
- API endpoint may not be returning users correctly
- Tenant filtering in backend may be broken
- SQL query may have incorrect JOIN or WHERE clause
- RLS (Row Level Security) policy may be blocking results

**Data Issue:**
- Users exist but have incorrect tenant_id
- User records missing required fields causing filter-out
- Session tenant_id doesn't match user records tenant_id

**Files to Investigate:**
- `apps/web/app/routes/_app.settings.users.tsx` - Settings page loader and component
- `apps/web/app/components/users/` - User list components (if separated)
- `apps/api/src/routes/users/` - User API endpoints
- Database: `users` table, `tenants` table, RLS policies

---

## Acceptance Criteria

1. **Data Loading:** Users page successfully fetches all users in admin's tenant from API
2. **Display:** All tenant users are displayed in the users table/list
3. **Filtering:** Only users from admin's tenant are shown (no cross-tenant leakage)
4. **User Information:** Each user shows: name, email, role, status (active/inactive)
5. **Actions:** Admin can click actions for each user (Change Role, Deactivate, etc.)
6. **Empty State:** Empty state only shown when tenant genuinely has no other users
7. **Error Handling:** If API call fails, user sees meaningful error (not empty list)
8. **Testing:** Verified with database that displayed users match actual tenant members

---

## Investigation & Analysis Tasks

- [ ] **Task 1: Verify Database State** (AC: 8)
  - [ ] Query database directly to confirm users exist in admin's tenant
  - [ ] Check tenant_id values match between admin and other users
  - [ ] Verify no missing required fields that could cause filtering
  - [ ] Document actual user count vs. displayed count

- [ ] **Task 2: Test API Endpoint Directly** (AC: 1)
  - [ ] Identify users API endpoint (e.g., GET `/api/users` or `/api/users/tenant`)
  - [ ] Test API endpoint directly with admin's auth token using Postman/curl
  - [ ] Verify API returns all tenant users in response
  - [ ] Check response structure matches frontend expectations
  - [ ] Document API response for comparison with frontend

- [ ] **Task 3: Inspect Frontend Loader** (AC: 1, 3)
  - [ ] Read `apps/web/app/routes/_app.settings.users.tsx` loader function
  - [ ] Add console logging to loader to inspect API response
  - [ ] Check if loader is correctly parsing response data
  - [ ] Verify tenant filtering logic (if any in frontend)
  - [ ] Check error handling in loader

- [ ] **Task 4: Inspect Frontend Component Rendering** (AC: 2, 4, 5)
  - [ ] Read component code in `_app.settings.users.tsx`
  - [ ] Check how `useLoaderData()` is used
  - [ ] Verify data mapping to table/list component
  - [ ] Check for client-side filtering that could hide users
  - [ ] Inspect empty state condition logic

- [ ] **Task 5: Check for Console Errors** (AC: 7)
  - [ ] Open browser DevTools console
  - [ ] Navigate to Team Members page
  - [ ] Look for JavaScript errors or API errors
  - [ ] Check Network tab for failed API requests
  - [ ] Document any errors found

---

## Debugging / Fix Tasks (After Root Cause Found)

### If Backend API Issue:

- [ ] **Task 6: Fix API User Query** (AC: 1, 3)
  - [ ] Update SQL query to correctly filter by tenant_id
  - [ ] Ensure JOIN clauses are correct
  - [ ] Test query directly in database client
  - [ ] Verify RLS policies allow admin to read tenant users
  - [ ] Update API endpoint to return correct data structure

### If Frontend Loader Issue:

- [ ] **Task 7: Fix Loader Data Fetching** (AC: 1, 2)
  - [ ] Correct API call in loader (check endpoint URL, parameters)
  - [ ] Fix response parsing if structure mismatch
  - [ ] Add error handling for API failures
  - [ ] Ensure loader returns data in expected format for component

### If Frontend Component Issue:

- [ ] **Task 8: Fix Component Rendering** (AC: 2, 4, 5, 6)
  - [ ] Fix data mapping from loader to component
  - [ ] Remove incorrect client-side filtering
  - [ ] Update empty state condition to check correctly
  - [ ] Ensure table/list renders all users from data

### Testing & Verification:

- [ ] **Task 9: Verify Fix with Real Data** (AC: 1-8)
  - [ ] Login as admin user
  - [ ] Navigate to Settings > Team Members
  - [ ] Verify all tenant users are displayed
  - [ ] Cross-check displayed users with database query
  - [ ] Verify user information is correct (name, email, role, status)
  - [ ] Test all user actions (Change Role, Deactivate, Invite)
  - [ ] Test with multiple tenants to ensure no cross-tenant data leakage
  - [ ] Test empty state: Create new tenant with single admin, verify message shown

---

## Dev Notes

### User Management Components

**Main Route File:**
- `apps/web/app/routes/_app.settings.users.tsx` (374 lines)
- Contains loader, component, and user management logic

**Related Components:**
- `apps/web/app/components/users/InviteUserModal.tsx` (157 lines)
- `apps/web/app/components/users/ChangeRoleModal.tsx` (142 lines)
- `apps/web/app/components/users/DeactivateUserModal.tsx` (133 lines)

### Expected Loader Pattern

```typescript
// File: apps/web/app/routes/_app.settings.users.tsx

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, api } = await requireRole(request, [UserRole.ADMIN]);
  
  // Fetch users for admin's tenant
  const response = await api.users.tenant.get(); // or similar endpoint
  
  return json({
    users: response.data, // Array of user objects
    currentUser: session.user,
  });
}
```

### Expected Data Structure

```typescript
interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string;
}
```

### API Endpoint Investigation

**Possible Endpoint Patterns:**
- GET `/api/users` - All users (should be tenant-filtered)
- GET `/api/users/tenant/:tenantId` - Specific tenant users
- GET `/api/tenants/:tenantId/users` - RESTful pattern

**Backend Files to Check:**
- `apps/api/src/routes/users/` - User route handlers
- `apps/api/src/lib/rbac/middleware.ts` - Tenant filtering middleware
- `packages/db/src/schema/` - User schema and relationships

### Database Schema

**Tables:**
- `users` - User records with `tenant_id` foreign key
- `tenants` - Tenant records
- `user_roles` - Role assignments (if separate)

**Query to Verify Data:**
```sql
-- Check users in specific tenant
SELECT id, email, full_name, role, tenant_id, is_active
FROM users
WHERE tenant_id = '<admin_tenant_id>';

-- Check admin's tenant_id
SELECT tenant_id FROM users WHERE id = '<admin_user_id>';
```

### Common Issues & Patterns

**Issue 1: Wrong API Endpoint**
- Loader calling wrong endpoint that doesn't filter by tenant
- Fix: Use correct endpoint with tenant context

**Issue 2: Response Structure Mismatch**
- API returns `{ data: { users: [...] } }` but frontend expects `{ data: [...] }`
- Fix: Correct data extraction in loader

**Issue 3: Client-Side Over-Filtering**
- Component filters users by incorrect criteria (e.g., by wrong field)
- Fix: Remove incorrect filter or fix filter logic

**Issue 4: RLS Policy Blocking**
- Database RLS prevents admin from reading other users in tenant
- Fix: Update RLS policy to allow admin access

**Issue 5: Empty State Condition Wrong**
- Empty state shown if `users === undefined` instead of `users.length === 0`
- Fix: Correct condition to check array length

### Tech Stack

- **Frontend:** Remix + React + TypeScript
- **API:** Elysia.js + Eden Treaty client
- **Database:** PostgreSQL with Supabase
- **Auth:** Supabase Auth with RLS

### Testing

**Manual Testing Checklist** (Primary for this bug):
- Testing approach documented in "Acceptance Criteria" section (AC 1-8)
- Manual testing checklist provided below (lines 281-291)
- No automated test changes required unless bug was caused by missing tests

**If Adding Regression Tests:**
- **Frontend Tests:** `apps/web/app/routes/__tests__/_app.settings.users.test.tsx`
- **Framework:** Vitest (as per tech-stack.md)
- **Pattern:** Test loader data fetching and component rendering
- **E2E Test:** Consider Playwright test for Settings → Team Members flow to prevent regression

**Backend Tests (if API fix needed):**
- **Location:** `apps/api/src/routes/users/__tests__/`
- **Framework:** Bun Test (native)
- **Pattern:** Test tenant filtering in user queries
- **Focus:** Verify RLS policies and tenant isolation in user listing endpoint

**Testing Standards** (from architecture)

**Manual Testing Checklist:**
- [ ] Login as admin user
- [ ] Navigate to Settings > Team Members
- [ ] Verify all tenant users displayed (count matches database)
- [ ] Verify user information correct (name, email, role, status)
- [ ] Click "Change Role" modal - verify it opens with user data
- [ ] Click "Deactivate" modal - verify it opens with user data
- [ ] Click "Invite User" button - verify modal opens
- [ ] Test with different admin accounts in different tenants
- [ ] Verify no cross-tenant data leakage (tenant isolation)
- [ ] Test empty state: Login as admin in single-user tenant

**Database Verification:**
```sql
-- Run before and after fix
SELECT COUNT(*) FROM users WHERE tenant_id = '<admin_tenant_id>';
```

### Security Considerations

- **Tenant Isolation Critical:** Must not show users from other tenants
- RLS policies must enforce tenant boundaries
- API must filter by session tenant_id, not trust client input
- Test with multiple tenants to ensure complete isolation

---

## Implementation Priority

**Priority:** 🔴 **Blocker - Critical**

**Impact:** Critical - Core admin functionality completely broken, no user management possible

**Estimated Effort:** 1-4 hours (depends on root cause)
- Investigation: 30-60 minutes
- Backend fix (if needed): 30-60 minutes
- Frontend fix (if needed): 30-60 minutes
- Testing: 30 minutes

**Dependencies:** None - can be investigated immediately

**Recommendation:** Investigate and fix IMMEDIATELY - this blocks all user administration tasks

---

## Notes

**User Impact:**
- Admin cannot manage users in their tenant
- Cannot change roles, deactivate users, or invite new users
- Complete loss of user administration functionality
- Blocks onboarding new team members

**Business Impact:**
- High - Prevents tenant growth (can't invite users)
- High - Prevents user management (security risk if can't deactivate)
- Critical for multi-user tenants

**Investigation Priority:**
1. Check database directly (confirm data exists)
2. Test API endpoint (confirm backend works)
3. Check frontend loader (confirm data fetching)
4. Check frontend component (confirm rendering)

**Related Stories:**
- Story 1.5: User Management (likely where this feature was implemented)
- May need to review original implementation for regression

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-12-16 | 1.2 | Status changed to Approved - ready for implementation | Sarah (Product Owner) |
| 2025-12-16 | 1.1 | Added Testing Standards subsection to Dev Notes for full template compliance | Sarah (Product Owner) |
| 2025-12-16 | 1.0 | Bug story created - Team Members page shows empty list despite users existing | Sarah (Product Owner) |

---

## Dev Agent Record

*To be populated during implementation*

---

## QA Results

*To be populated after implementation and QA review*

