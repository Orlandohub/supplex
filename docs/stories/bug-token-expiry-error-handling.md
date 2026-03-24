# Bug Story: Token Expiry Error Handling

<!-- Powered by BMAD™ Core -->

## Status

**Ready for Manual Testing** (Implementation Complete - Pending Browser Validation)

Date Created: December 16, 2025  
Date Validated: December 16, 2025  
Identified By: Manual Testing (User Acceptance Testing)  
Severity: **High** (Poor UX - Users see cryptic error instead of being prompted to login)  
Story Type: Bug Fix  
Priority: 🔴 **Blocker** - Must fix before new development continues  
Validation Status: ✅ **Passed** - All critical issues resolved, file paths verified, tasks aligned with existing architecture

---

## Story

**As a** logged-in user,  
**I want** to be automatically redirected to login when my session expires,  
**so that** I understand why I can't access data and can quickly re-authenticate without seeing confusing error messages.

---

## Current Behavior (Bug)

1. User is logged in and working in the application
2. JWT token expires (natural session timeout)
3. User attempts to load data (e.g., navigating to a page that fetches records)
4. Application makes API request with expired token
5. **Result:** User sees generic error message "Failed to load records" instead of being prompted to login
6. User is confused and doesn't understand they need to refresh/login again

**Terminal Evidence:**
```
[AUTH MIDDLEWARE] Supabase response - Error: 
invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired
AuthApiError: invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired
  __isAuthError: true,
  status: 403,
  code: "bad_jwt"
```

---

## Expected Behavior

When a user's token expires:
1. API middleware detects expired token (403 with "bad_jwt" code)
2. API returns proper 401 Unauthorized response
3. Frontend intercepts 401 response
4. User is automatically redirected to login page
5. (Optional) Friendly message shown: "Your session has expired. Please log in again."
6. After re-login, user is redirected back to the page they were trying to access

---

## Root Cause Analysis

**Backend (API):**
- File: `apps/api/src/lib/rbac/middleware.ts` (line ~77-80)
- When Supabase returns token validation error with `bad_jwt` code, middleware throws 401
- Error response format needs to be consistent with existing `createErrorResponse` pattern
- Should return structured error object with specific code for expired tokens

**Frontend (Web App):**
- API client (Eden Treaty) in `apps/web/app/lib/api-client.ts` receives error response
- Error handling in loaders/actions shows generic "Failed to load records" toast
- No global error interceptor to detect 401 responses with expired token
- **EXISTING:** Login redirect with return URL already implemented in `session.server.ts` (line 135-138)
- **MISSING:** 401 detection in API client to trigger existing redirect mechanism

**Gap:** 
- Backend needs to return 401 with specific error code for expired tokens (matching existing error format)
- Frontend needs global error handling in API client to detect 401 responses
- 401 detection should trigger **existing** login redirect mechanism in session.server.ts
- Session expiry should trigger redirect, not generic error message

---

## Acceptance Criteria

1. **Backend:** When JWT token is expired, API returns 401 status with structured error code `TOKEN_EXPIRED` (matching existing `createErrorResponse` format)
2. **Backend:** Auth middleware distinguishes expired tokens from other auth failures
3. **Frontend:** API client detects 401 responses with `TOKEN_EXPIRED` error code
4. **Frontend:** User is automatically redirected to login page when token expires (using existing redirect logic)
5. **Frontend:** Login redirect preserves intended destination via existing `redirectTo` parameter
6. **UX:** User sees friendly message explaining session expired (not "Failed to load records")
7. **Testing:** Existing authenticated requests continue to work normally with valid tokens

---

## Proposed Solution

### Backend Changes (API)

**File:** `apps/api/src/lib/rbac/middleware.ts`

1. Update auth middleware to detect specific Supabase token expiry errors (check for `bad_jwt` code)
2. Use existing `createErrorResponse` utility to return structured error:
   ```typescript
   // Using existing pattern from middleware.ts
   set.status = 401;
   throw new Error(JSON.stringify({
     error: {
       code: "TOKEN_EXPIRED",
       message: "Your session has expired. Please log in again.",
       timestamp: new Date().toISOString()
     }
   }));
   ```
3. Ensure consistent 401 status for all authentication failures

### Frontend Changes (Web App)

**File:** `apps/web/app/lib/api-client.ts` (Eden Treaty client setup)

1. Add response error handler to Eden Treaty client factory functions
2. Check for 401 status with `TOKEN_EXPIRED` error code in response
3. When detected, redirect to `/login` (browser-side redirect via `window.location.href`)
4. **Note:** Return URL preservation already handled by existing `requireAuth()` in `session.server.ts`

**File:** `apps/web/app/lib/auth/session.server.ts` (Existing - No Changes Needed)

**Existing functionality to leverage:**
- `requireAuth()` already captures `redirectTo` from URL (line 136-137)
- Login redirect with return URL already implemented (line 135-138)
- Login page already handles `redirectTo` parameter (verified in `routes/login.tsx`)

---

## Tasks / Subtasks

### Backend Tasks

- [x] **Task 1: Update Auth Middleware Error Handling** (AC: 1, 2)
  - [x] Locate token validation logic in `apps/api/src/lib/rbac/middleware.ts` (line 66-81)
  - [x] Add specific check for Supabase `bad_jwt` code or token expiry error message
  - [x] Return structured 401 response with `TOKEN_EXPIRED` error code using existing error pattern
  - [x] Match existing `createErrorResponse` format with `error.code`, `error.message`, `error.timestamp`
  - [x] Ensure other auth errors (missing token, no tenant) return different error codes
  - [x] Add logging for token expiry events (for monitoring)

- [x] **Task 2: Test Backend Token Expiry Response** (AC: 1, 2, 7)
  - [x] Create expired token manually (or use test utility)
  - [x] Send request with expired token to protected endpoint
  - [x] Verify 401 response with correct error structure
  - [x] Verify valid tokens still work normally

### Frontend Tasks

- [x] **Task 3: Add Token Expiry Detection to API Client** (AC: 3, 4, 6)
  - [x] Locate Eden Treaty client setup in `apps/web/app/lib/api-client.ts`
  - [x] Research Eden Treaty error handling capabilities (check Eden Treaty docs for response interceptors)
  - [x] Add error response handler to detect 401 status responses
  - [x] Parse error response body to check for `TOKEN_EXPIRED` code
  - [x] When detected, perform client-side redirect: `window.location.href = '/login'`
  - [x] **Note:** Return URL preservation is already handled by server-side `requireAuth()` on next request

- [x] **Task 4: Improve Error Messages** (AC: 6)
  - [x] In API client error handler, show user-friendly toast before redirect
  - [x] Message: "Your session has expired. Redirecting to login..."
  - [x] Use brief timeout (1-2 seconds) before redirect to allow message to be seen

- [ ] **Task 5: Test Frontend Token Expiry Handling** (AC: 3, 4, 5, 6, 7)
  - [ ] Simulate expired token scenario (manually expire token or wait for timeout)
  - [ ] Navigate to protected page that loads data
  - [ ] Verify user sees friendly message (not generic error)
  - [ ] Verify automatic redirect to login page
  - [ ] Login successfully and verify redirect back to intended page (existing `redirectTo` mechanism)
  - [ ] Test with valid token to ensure normal flow still works
  - [ ] Verify existing `requireAuth()` functionality still works for other routes

---

## Dev Notes

### Relevant Source Tree

```
apps/
├── api/
│   └── src/
│       └── lib/
│           └── rbac/
│               └── middleware.ts          # Auth middleware (line 46-108)
│                   - authenticate (line 46): JWT validation
│                   - createErrorResponse (line 195): Error formatter
└── web/
    └── app/
        ├── lib/
        │   ├── api-client.ts              # Eden Treaty client setup
        │   │   - createEdenTreatyClient (line 16)
        │   │   - createClientEdenTreatyClient (line 28)
        │   └── auth/
        │       └── session.server.ts      # Session management
        │           - requireAuth (line 126): Handles login redirect
        │           - getSession (line 85): Validates session
        └── routes/
            └── login.tsx                   # Login page (handles redirectTo param)
```

### Auth Architecture

**API Authentication Flow:**
- Middleware: `apps/api/src/lib/rbac/middleware.ts`
- `authenticate` middleware (line 46-108) validates JWT with Supabase
- Errors from Supabase currently show generic messages
- Existing `createErrorResponse` utility (line 195) provides standard error format

**Frontend Authentication:**
- Supabase client manages session in browser
- Eden Treaty client (`apps/web/app/lib/api-client.ts`) sends JWT in Authorization header
- **Existing:** `requireAuth()` in `session.server.ts` handles login redirect with return URL (line 126-142)
- **Missing:** Eden Treaty client lacks 401 error detection to trigger redirect
- Loaders/actions handle API responses but no global error handling for auth failures

### Supabase Error Response (Current)

When token expires, Supabase returns:
```typescript
{
  __isAuthError: true,
  status: 403,
  code: "bad_jwt",
  message: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired"
}
```

### Error Handling Pattern

**Current Pattern (Loaders):**
```typescript
try {
  const data = await api.endpoint.get();
  return json({ data });
} catch (error) {
  // Generic error handling - no auth-specific logic
  return json({ error: "Failed to load records" }, { status: 500 });
}
```

**Needed Pattern:**
```typescript
// Global interceptor should handle 401 before loader sees it
// Loader only handles business logic errors
```

### Tech Stack

- **Backend:** Elysia.js + Supabase Auth
- **Frontend:** Remix + Eden Treaty (type-safe API client)
- **Auth:** Supabase JWT tokens

### Existing Auth Utilities (Verified)

**Server-side (No changes needed):**
- `apps/web/app/lib/auth/session.server.ts` - Session management
  - `requireAuth()` (line 126-142): **Already handles login redirect with return URL**
  - `getSession()` (line 85-121): Validates session with Supabase
  - Return URL logic: Line 136-137 captures `pathname + search` for redirect

**Client-side API (Needs update):**
- `apps/web/app/lib/api-client.ts` - Eden Treaty client setup
  - `createEdenTreatyClient()`: Server-side API calls
  - `createClientEdenTreatyClient()`: Client-side API calls
  - **Missing:** Error response handling for 401 detection

**Login Page (No changes needed):**
- `apps/web/app/routes/login.tsx` 
  - Already accepts `redirectTo` query parameter (line 24-29)
  - Already redirects after login (line 28)

### Related Code Files (Verified Paths)

**Backend:**
- `apps/api/src/lib/rbac/middleware.ts` - Auth middleware
  - authenticate (line 46-108): JWT validation
  - createErrorResponse (line 195-211): Error formatter utility
- `apps/api/src/lib/supabase/client.ts` - Supabase admin client

**Frontend:**
- `apps/web/app/lib/api-client.ts` - Eden Treaty client (needs update)
- `apps/web/app/lib/auth/session.server.ts` - Session management (existing redirect logic)
- `apps/web/app/routes/login.tsx` - Login page (handles redirectTo param)

## Testing

### Testing Standards

Per architecture testing strategy:
- **Manual Testing:** Required for UX flows (token expiry is a critical UX scenario)
- **Integration Testing:** Consider adding tests for API client error handling
- **Error Handling:** Verify user-friendly messages, not technical errors

### Manual Testing Checklist

**Option 1: Using Browser DevTools (Recommended for Testing)**
- [ ] Login as any user
- [ ] Open Browser DevTools (F12) → Application/Storage → Local Storage
- [ ] Find and note the Supabase auth token (usually under `sb-<project-ref>-auth-token`)
- [ ] Modify the token to an invalid value (e.g., change last few characters)
- [ ] Navigate to a protected page that loads data (e.g., `/suppliers` or `/workflows`)
- [ ] Verify toast message appears: "Your session has expired. Redirecting to login..."
- [ ] Verify automatic redirect to `/login` page after ~1.5 seconds
- [ ] Login again with valid credentials
- [ ] Verify redirect back to the intended page (existing `redirectTo` mechanism)

**Option 2: Natural Token Expiry (Time-consuming)**
- [ ] Login as any user
- [ ] Wait for token to expire naturally (check Supabase JWT expiry time)
- [ ] Navigate to page that loads data (e.g., `/suppliers`)
- [ ] Verify friendly "Session expired" message appears
- [ ] Verify automatic redirect to login page
- [ ] Login again
- [ ] Verify redirect back to intended page

**Regression Testing:**
- [ ] With valid token, verify normal data loading works correctly
- [ ] Verify existing `requireAuth()` functionality still works for server-side redirects
- [ ] Test multiple protected routes to ensure consistent behavior

**Integration Test Considerations:**
- Mock expired token scenario in API client tests
- Test global error interceptor behavior
- Test redirect logic with various URLs

### Security Considerations

- Don't log sensitive token data (only log "token exists" or "token missing")
- Clear all auth state on token expiry (handled by Supabase client)
- Ensure redirect doesn't leak sensitive info in URL params
- **Validated:** Existing `requireAuth()` only captures same-origin pathname+search, inherently safe from open redirect attacks (line 136 in session.server.ts)
- **No changes needed:** Current redirect implementation is already secure

---

## Implementation Priority

**Priority:** 🔴 **Blocker - Critical**

**Impact:** High - Affects all users when sessions expire, causes confusion and poor UX

**Estimated Effort:** 1.5-2 hours
- Backend: 30-45 minutes (error handling update with specific error code)
- Frontend: 45-60 minutes (API client error detection + redirect trigger)
- Testing: 30-45 minutes

**Effort Reduced:** Original estimate included building redirect logic that already exists

**Dependencies:** None - can be implemented immediately

**Recommendation:** Fix immediately before any new feature development

---

## Notes

**User Impact:**
- Every user will experience token expiry at some point (natural session timeout)
- Current behavior is confusing and unprofessional
- Users may think the application is broken

**Technical Debt:**
- Lack of global error handling for auth failures
- No standardized error codes for auth errors
- Session management could be improved overall

**Future Improvements (Out of Scope):**
- Implement token refresh to extend sessions automatically
- Add session timeout warning before expiry
- Persist user work before redirect (autosave)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-12-16 | 1.0 | Bug story created - Token expiry shows generic error instead of login redirect | Sarah (Product Owner) |
| 2025-12-16 | 1.1 | Story validated and corrected: Fixed file paths, removed duplicate Task 4 (redirect exists), aligned error format with existing pattern, added source tree, renamed section to "Story" for template compliance, added Dev Agent Record section | Sarah (Product Owner) |
| 2025-12-16 | 1.2 | Implementation completed: Backend tasks 1-2 complete with all tests passing (18/18). Frontend tasks 3-4 complete with token expiry detection and toast notifications. Manual testing (Task 5) pending user validation. | James (Dev Agent) |

---

## Dev Agent Record

*This section is populated by the development agent during implementation*

### Agent Model Used

Claude Sonnet 4.5 (via Cursor - James Dev Agent)

### Debug Log References

No critical debug issues encountered. All tests passing.

### Completion Notes

**Backend Implementation:**
- Updated `apps/api/src/lib/rbac/middleware.ts` to detect token expiry errors from Supabase
- Implemented structured error responses with specific error codes:
  - `TOKEN_EXPIRED`: For expired JWT tokens (detected via `bad_jwt` code or "token is expired" message)
  - `MISSING_TOKEN`: For requests without authorization header
  - `INVALID_TOKEN`: For malformed or invalid tokens
  - `MISSING_TENANT`: For users without tenant association
- All error responses follow the existing `createErrorResponse` pattern with `code`, `message`, and `timestamp`
- Added comprehensive logging for all auth failure scenarios
- Updated existing tests and added 3 new test cases for token expiry handling
- All 18 tests passing ✅

**Frontend Implementation:**
- Created custom fetch wrapper `fetchWithTokenExpiryHandler` in `apps/web/app/lib/api-client.ts`
- Wrapper intercepts all 401 responses and checks for `TOKEN_EXPIRED` error code
- Integrated `sonner` toast library to display user-friendly message: "Your session has expired. Redirecting to login..."
- Implemented automatic redirect to `/login` after 1.5 second delay (allows toast to be seen)
- Applied custom fetch wrapper to both `createEdenTreatyClient` and `createClientEdenTreatyClient`
- Return URL preservation already handled by existing `requireAuth()` in `session.server.ts` (no changes needed)

**Testing Completed:**
- Backend: All middleware tests passing (18/18) ✅
- Frontend: Code review confirms correct implementation ✅
- Integration: Dev servers running without errors ✅
- Manual testing required: Task 5 pending user validation (see Manual Testing Checklist)

**Ready for Manual Testing:**
The implementation is complete and ready for manual browser testing. Task 5 requires human interaction to:
1. Simulate expired token scenario in browser DevTools
2. Verify toast message and redirect behavior
3. Confirm existing `requireAuth()` functionality still works

**Recommended Testing Approach:**
Use Browser DevTools to modify the Supabase auth token to an invalid value, then navigate to any protected route (e.g., `/suppliers`, `/workflows`) to trigger the token expiry flow. See detailed steps in Manual Testing Checklist above.

**Next Steps:**
1. User/QA performs manual browser testing (Task 5)
2. If tests pass, mark Task 5 checkboxes as complete
3. Run story-dod-checklist
4. Update status to "Ready for Review"

**Implementation Summary:**
- ✅ Backend: Token expiry detection with structured error responses
- ✅ Frontend: Automatic redirect with user-friendly toast message  
- ✅ Tests: All 18 middleware tests passing
- ⏳ Manual Testing: Awaiting browser validation

### File List

*All files created, modified, or affected during story implementation:*

**Backend Files:**
- [x] `apps/api/src/lib/rbac/middleware.ts` - Updated (added TOKEN_EXPIRED, MISSING_TOKEN, INVALID_TOKEN, MISSING_TENANT error codes with structured responses)

**Frontend Files:**
- [x] `apps/web/app/lib/api-client.ts` - Updated (added fetchWithTokenExpiryHandler wrapper and toast notification)

**Test Files:**
- [x] `apps/api/src/lib/rbac/__tests__/middleware.test.ts` - Updated (added 3 new test cases for token expiry scenarios, updated existing test expectations)

---

## QA Results

*To be populated after implementation and QA review*

---

## Additional Resources

**Eden Treaty Documentation:**
- Eden Treaty Overview: https://elysiajs.com/eden/treaty/overview.html
- Error Handling: Research needed for response interceptor patterns

**Supabase Auth Errors:**
- Error code `bad_jwt` indicates expired or invalid JWT
- Error object includes `__isAuthError: true` flag

**Existing Error Format (from middleware.ts):**
```typescript
{
  error: {
    code: "ERROR_CODE",      // e.g., "FORBIDDEN", "TOKEN_EXPIRED"
    message: "Human-readable message",
    timestamp: "ISO 8601 timestamp"
  }
}
```

