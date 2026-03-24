# Sprint Change Proposal: Development Quick Login Helper

**Proposal ID**: SCP-2026-03-18-002  
**Date**: March 18, 2026  
**Type**: New Development Tool / Infrastructure Enhancement  
**Priority**: HIGH (Blocking next stories)

---

## Executive Summary

### Identified Issue

Manual testing in development environment is significantly slowed by the need to repeatedly enter credentials for different user types (tenant users vs supplier users) across multiple tenants. This creates friction in the development workflow and delays testing of new features.

### Recommended Solution

Implement a development-only "Quick Login" feature that provides dropdown selectors for tenants and users, allowing one-click login without password entry. This feature will be strictly environment-gated (`NODE_ENV === 'development'`) with zero exposure in production.

### Impact Assessment

- **Epic Impact**: None (cross-cutting dev tool, not part of any business epic)
- **Story Classification**: `DEV-001` (Development Infrastructure)
- **Risk Level**: Low (additive, dev-only, well-understood pattern)
- **Effort**: 5-7 hours
- **Value**: Permanent productivity improvement for all future testing

---

## Analysis Summary

### Change Context

**Trigger**: Developer productivity requirement  
**Type**: New requirement (not a bug or failed story)  
**Urgency**: High - blocking efficient testing of upcoming stories

**User Request**:
> "Need on the login screen to be able to select from existing users and log in without having to insert email and/or password. Should have a dropdown with tenants, then a dropdown with their users and another one with supplier users, and on click log in."

### Requirements Clarification

Through discussion, the following scope was confirmed:
- ✅ Show user roles in dropdowns
- ❌ No need to remember last selected user
- ❌ No search/filter needed (manageable user lists assumed)
- ✅ Priority: HIGH - must implement before proceeding with next stories
- ✅ Implementation: Standalone (not integrated with existing story work)

---

## Epic Impact Summary

### Current Epic Status
- Epic 2.2 (Dynamic Workflows): Substantially complete (Stories 2.2.14, 2.2.15 done)
- Next planned work: Stories from other epics or bug fixes

### Impact Analysis

**On Current Epic**: ❌ No impact  
- This is not part of Epic 2.2 or any business epic

**On Future Epics**: ✅ Positive impact  
- Will accelerate testing for Epic 3 (Performance Evaluation)
- Will accelerate testing for Epic 4 (Complaints & CAPA)
- Will accelerate testing for Epic 5 (Analytics & Reporting)

**Epic Assignment**: None (Development Infrastructure)
- Recommendation: Track as `DEV-001` or similar non-epic designation
- This is a cross-cutting development tool, not a product feature

---

## Artifact Impact & Required Updates

### 1. Architecture Documentation (MUST UPDATE)

#### A. `docs/architecture/authentication.md`

**Change Required**: Add new section documenting dev-only login bypass

**Proposed Addition** (after line 510, before document end):

```markdown
---

## Development Quick Login (Dev Environment Only)

### Overview

For development and testing efficiency, a quick login feature is available that bypasses password authentication. This feature is **strictly gated** to `NODE_ENV === 'development'` and has zero exposure in production builds.

### Architecture

**Frontend Component**: `LoginForm.tsx`
- Conditionally renders dev login UI when `isDevelopment === true`
- Provides dropdowns for:
  - Tenant selection
  - Tenant users (filtered by selected tenant)
  - Supplier users (filtered by selected tenant's suppliers)
- Shows user roles in dropdown labels

**Backend Endpoints**: 
- `GET /auth/dev/users` - List all users grouped by tenant (dev-only)
- `POST /auth/dev/login` - Generate JWT for selected user (dev-only)

### Security Guarantees

**Environment Gating** (Multiple Layers):
1. Backend routes check `config.nodeEnv === 'development'`
2. Frontend UI only renders when `process.env.NODE_ENV === 'development'`
3. Production builds strip dev code via tree-shaking

**Production Safety**:
- ✅ Dev routes return 404 in production
- ✅ Dev UI never renders in production
- ✅ Zero performance impact in production

**JWT Generation**:
- Dev login generates standard JWT tokens (same as normal auth)
- Token includes correct user_metadata (role, tenant_id)
- Token respects same TTL and validation rules
- Cache and auth middleware work identically

### Usage

**Development Workflow**:
1. Navigate to login page
2. See "🚀 Dev Quick Login" section (dev environment only)
3. Select tenant from dropdown
4. Select user (tenant user or supplier user)
5. Click "Quick Login" button
6. Redirected to app with valid session

**User Dropdown Format**:
```
John Doe (admin) - john@acme.com
Jane Smith (procurement_manager) - jane@acme.com
Bob Wilson (supplier_user) - bob@supplier.com
```

### Implementation Notes

**Backend** (`apps/api/src/routes/auth/dev-*.ts`):
- Environment check at route level
- Returns 404 in non-dev environments
- No database schema changes needed
- Uses existing user/tenant tables

**Frontend** (`apps/web/app/components/auth/LoginForm.tsx`):
- Conditional rendering based on `isDevelopment`
- Cascading dropdowns (tenant → users)
- Minimal UI changes to existing login form

---
```

**Rationale**: Documents the dev-only authentication bypass for future developers and maintains architecture doc completeness.

---

#### B. `docs/architecture/security-and-performance.md`

**Change Required**: Add dev tools security guidelines

**Proposed Addition** (after line 50, in "Backend Security" section):

```markdown
**Development-Only Features:**

When implementing development-only features (e.g., quick login, debug endpoints):

- MUST check `config.nodeEnv === 'development'` at route level
- MUST return 404 or 403 in non-development environments
- MUST document in architecture/authentication.md
- MUST include clear code comments explaining environment gating
- SHOULD log warnings if accessed in non-dev environments

Example:
```typescript
// DEV-ONLY ENDPOINT - Returns 404 in production
if (config.nodeEnv !== 'development') {
  return res.status(404).json({ error: 'Not found' });
}
```

Development features must never compromise production security. When in doubt, prefer explicit environment checks over implicit assumptions.

---
```

**Rationale**: Establishes pattern for future dev tools and ensures security best practices.

---

### 2. Code Changes (Implementation Required)

#### Backend API

**A. New File**: `apps/api/src/routes/auth/dev-list-users.ts`

Purpose: List all users (tenant and supplier) for dev login dropdowns

Key Requirements:
- Environment check first (return 404 if not dev)
- Query all tenants with their users
- Query all supplier users
- Group by tenant
- Include user role in response
- No pagination (dev tool, manageable dataset)

Response Format:
```typescript
{
  tenants: [
    {
      id: "tenant-1",
      name: "ACME Corp",
      users: [
        { id: "u1", email: "john@acme.com", role: "admin", fullName: "John Doe", type: "tenant" }
      ],
      supplierUsers: [
        { id: "u5", email: "bob@supplier.com", role: "supplier_user", fullName: "Bob Wilson", supplierId: "s1" }
      ]
    }
  ]
}
```

---

**B. New File**: `apps/api/src/routes/auth/dev-login.ts`

Purpose: Generate JWT token for selected user without password

Key Requirements:
- Environment check first (return 404 if not dev)
- Accept userId in request body
- Fetch user from database (validate exists and is active)
- Generate JWT using Supabase admin client (`.auth.admin.createUser()` or sign custom JWT)
- Return same response format as normal login
- Cache user data (same as normal auth flow)

Request Format:
```typescript
{ userId: "user-123" }
```

Response Format:
```typescript
{
  success: true,
  user: { id, email, role, tenantId, fullName },
  accessToken: "eyJhbGci...",
  expiresIn: 3600
}
```

---

**C. Modified File**: `apps/api/src/routes/auth/index.ts`

Change: Register dev routes conditionally

```typescript
// Existing routes...
router.post('/signin', ...);
router.post('/signout', ...);

// DEV-ONLY ROUTES
if (config.nodeEnv === 'development') {
  router.get('/dev/users', devListUsersHandler);
  router.post('/dev/login', devLoginHandler);
  console.log('⚠️  Development quick login enabled');
}
```

---

#### Frontend Web

**D. Modified File**: `apps/web/app/components/auth/LoginForm.tsx`

Changes Required:
1. Add environment detection at top of file
2. Add state for dev login UI (selected tenant, selected user)
3. Add dev login section (conditional render)
4. Add dev login API calls
5. Maintain existing login form unchanged

Proposed Structure:
```tsx
const isDevelopment = process.env.NODE_ENV === 'development';

export function LoginForm({ ... }) {
  // Existing state...
  
  // Dev login state (only in dev)
  const [devUsers, setDevUsers] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Existing header */}
      
      {/* DEV QUICK LOGIN SECTION - Only visible in development */}
      {isDevelopment && (
        <div className="mb-8 p-4 border-2 border-yellow-400 rounded-lg bg-yellow-50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🚀</span>
            <h3 className="font-semibold text-yellow-900">Dev Quick Login</h3>
          </div>
          
          {/* Tenant Dropdown */}
          <select className="..." onChange={handleTenantChange}>
            <option value="">Select Tenant...</option>
            {/* Tenant options */}
          </select>
          
          {/* User Dropdown (tenant + supplier users) */}
          {selectedTenant && (
            <select className="..." onChange={handleUserChange}>
              <option value="">Select User...</option>
              <optgroup label="Tenant Users">
                {/* Tenant user options with role */}
              </optgroup>
              <optgroup label="Supplier Users">
                {/* Supplier user options with role */}
              </optgroup>
            </select>
          )}
          
          {/* Quick Login Button */}
          <button onClick={handleDevLogin} className="...">
            Quick Login
          </button>
        </div>
      )}
      
      {/* Existing login form (unchanged) */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ... existing form fields ... */}
      </form>
    </div>
  );
}
```

Visual Design:
- Yellow border and background to clearly indicate "dev-only"
- Rocket emoji for visual distinction
- Placed above normal login form
- Clear labels showing user roles
- Grouped dropdowns (tenant users vs supplier users)

---

### 3. Documentation (Optional Updates)

**Optional**: Update API specification (`docs/architecture/api-specification.md`) to document dev endpoints (marked as dev-only).

**Optional**: Update components documentation (`docs/architecture/components.md`) to note LoginForm dev mode.

**Decision**: Recommend skipping optional updates for this change (minimal value, high maintenance).

---

## Recommended Path Forward

### Selected Approach: Direct Integration ✅

**Implementation Strategy**: Backend-first, then frontend

**Phases**:
1. **Phase 1 - Backend (2-3 hours)**
   - Create `dev-list-users.ts` endpoint
   - Create `dev-login.ts` endpoint  
   - Register routes in `auth/index.ts`
   - Test with curl/Postman

2. **Phase 2 - Frontend (1-2 hours)**
   - Modify `LoginForm.tsx` with dev UI
   - Add cascading dropdown logic
   - Add dev login API integration
   - Test in browser

3. **Phase 3 - Documentation (30 min)**
   - Update `authentication.md`
   - Update `security-and-performance.md`

4. **Phase 4 - Testing (1 hour)**
   - Verify dev environment works
   - Verify production environment shows no dev UI
   - Test with multiple tenants and user types
   - Verify role display in dropdowns

**Total Effort**: 5-7 hours

---

## PRD/MVP Impact

**Impact on MVP Scope**: None

This is a development tool that does not affect any product features or MVP deliverables. It is purely an internal productivity enhancement.

**Impact on Business Requirements**: None

No changes to business functionality, user-facing features, or product capabilities.

---

## High-Level Action Plan

### Immediate Next Steps

1. **Create Story Document**: `DEV-001.story.md`
   - Full technical specification
   - Acceptance criteria
   - Implementation guide
   - Security requirements

2. **Assign to Developer**: Implement according to story spec

3. **Update Architecture Docs**: After implementation is complete

### Story Structure

The story should follow the standard Supplex story format:

**Story Title**: DEV-001: Development Quick Login Helper

**As a** developer  
**I want** a quick login feature in development mode  
**so that** I can efficiently test with different user types without repeatedly entering credentials

**Acceptance Criteria**:
- AC1: Dev login UI only visible when `NODE_ENV=development`
- AC2: Tenant dropdown populated with all tenants
- AC3: User dropdown shows tenant users and supplier users with roles
- AC4: Quick login generates valid JWT token
- AC5: Production environment has zero dev code execution
- AC6: Architecture docs updated

---

## Agent Handoff Plan

### Roles Needed

**Primary**: Developer Agent
- Implement backend routes
- Implement frontend UI
- Write tests
- Update documentation

**Secondary**: QA (Manual Testing)
- Verify dev mode works correctly
- Verify production mode shows nothing
- Test with multiple user scenarios

**Tertiary**: None (no PM, Architect, or PO needed for dev tool)

### Handoff Deliverables

1. ✅ This Sprint Change Proposal (complete analysis and specification)
2. 🔄 Story document (`DEV-001.story.md`) - to be created
3. 🔄 Implementation - to be assigned to dev agent

---

## Success Criteria

### Functional Requirements

- ✅ Dev login visible only in development environment
- ✅ Tenant dropdown populated with all tenants
- ✅ User dropdown shows: `{Name} ({role}) - {email}`
- ✅ User dropdown groups tenant users and supplier users
- ✅ One-click login works without password
- ✅ Generated JWT token is valid and fully functional
- ✅ User session persists correctly after dev login

### Security Requirements

- ✅ Production environment: Dev routes return 404
- ✅ Production environment: Dev UI never renders
- ✅ Environment checks at multiple layers (frontend + backend)
- ✅ Clear code comments explaining security gating
- ✅ Documentation updated with security considerations

### Testing Requirements

- ✅ Manual test: Dev login works in development
- ✅ Manual test: Dev UI invisible in production build
- ✅ Manual test: Multiple tenants and user types work
- ✅ Manual test: Role labels display correctly
- ✅ Manual test: JWT token includes correct claims

---

## Appendix: Change Checklist Completion

### Section 1: Understand the Trigger & Context ✅
- [x] Triggering Story: New requirement (dev productivity)
- [x] Issue Definition: Need quick login for testing efficiency
- [x] Initial Impact: Positive, additive, dev-only
- [x] Evidence: Developer workflow improvement request

### Section 2: Epic Impact Assessment ✅
- [x] Current Epic: No impact (Epic 2.2 substantially complete)
- [x] Future Epics: Positive impact (faster testing)
- [x] Epic Assignment: None (dev infrastructure, not business feature)

### Section 3: Artifact Conflict & Impact Analysis ✅
- [x] PRD: No conflicts
- [x] Architecture: Requires updates to authentication.md, security-and-performance.md
- [x] Frontend Spec: Minor LoginForm UI change
- [x] Other Artifacts: Config verification only

### Section 4: Path Forward Evaluation ✅
- [x] Option 1 (Direct Integration): Selected ✅
- [x] Option 2 (Rollback/Defer): Dismissed (no value)
- [x] Option 3 (Alternative Approaches): Evaluated and dismissed

### Section 5: Sprint Change Proposal ✅
- [x] Issue Summary: Dev login needed for testing efficiency
- [x] Epic Impact: None (cross-cutting dev tool)
- [x] Artifact Updates: 2 architecture docs, 3 code files new/modified
- [x] Recommended Path: Direct integration
- [x] Action Plan: 4-phase implementation (5-7 hours)
- [x] Agent Handoff: Developer agent primary

---

## Conclusion

This Sprint Change Proposal recommends implementing a development-only quick login feature to improve testing efficiency. The feature is low-risk, well-understood, and follows industry-standard patterns. Implementation requires ~5-7 hours of effort and will provide permanent productivity improvements for all future testing.

**Recommendation**: APPROVE and proceed with story creation and implementation.

**Next Step**: Create `DEV-001.story.md` and assign to developer agent.

---

**Prepared By**: Scrum Master (Change Navigation Process)  
**Date**: March 18, 2026  
**Status**: ✅ IMPLEMENTED - March 18, 2026  
**Implementation Story**: [DEV-001.story.md](../stories/DEV-001.story.md)
