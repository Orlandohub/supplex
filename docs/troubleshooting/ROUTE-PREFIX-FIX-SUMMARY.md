# ElysiaJS Route Prefix Fix - Summary & Prevention

**Date**: October 24, 2025  
**Issue**: ElysiaJS route prefix duplication causing server crash  
**Status**: ✅ Fixed and Documented

---

## The Problem

API server crashed on startup with:
```
error: Cannot create route "/workflows/workflows/:workflowId/documents" with parameter "workflowId" because a route already exists with a different parameter name ("id") in the same location
```

### Root Cause
Two compounding issues:
1. **Double prefix**: Both parent and child routes defined `prefix: "/workflows"`
2. **Parameter name conflict**: Different routes used `:id` vs `:workflowId` at same path position

This resulted in malformed routes like:
- `/workflows/workflows/:id` instead of `/workflows/:id`
- `/workflows/workflows/:workflowId/documents` instead of `/workflows/:workflowId/documents`

---

## The Fix

### 1. Removed Redundant Prefixes
**Files Modified:**
- `apps/api/src/routes/workflows/detail.ts`
- `apps/api/src/routes/workflows/documents.ts`
- `apps/api/src/routes/workflows/upload-document.ts`
- `apps/api/src/routes/workflows/remove-document.ts`

**Change:**
```typescript
// ❌ BEFORE (Incorrect)
export const workflowDetailRoute = new Elysia({ prefix: "/workflows" })
  .use(authenticate)
  .get("/:id", handler);

// ✅ AFTER (Correct)
export const workflowDetailRoute = new Elysia()  // No prefix!
  .use(authenticate)
  .get("/:workflowId", handler);
```

### 2. Standardized Parameter Names
All workflow routes now use consistent parameter name: `:workflowId`

**Routes:**
```
GET    /api/workflows/:workflowId                    - Get workflow detail
GET    /api/workflows/:workflowId/documents          - Get workflow documents
POST   /api/workflows/:workflowId/documents          - Upload document
DELETE /api/workflows/:workflowId/documents/:documentId - Remove document
```

### 3. Updated Documentation
- Updated route comments in `index.ts`
- Updated test suite comments in `detail.test.ts`

---

## Prevention Measures Implemented

### 1. Documentation Added
**File**: `docs/troubleshooting/known-issues-and-fixes.md`
- Added as Issue #8 with full explanation
- Includes root cause analysis
- Provides correct patterns and anti-patterns
- Added quick reference checklist

### 2. Template Created
**File**: `docs/templates/elysia-route-module-template.ts`
- Comprehensive template for new route modules
- Shows correct parent/child route organization
- Includes inline comments with critical rules
- Provides examples for nested resources

### 3. Coding Standards Updated
**File**: `docs/architecture/coding-standards.md`
- Added ElysiaJS Route Organization section
- Links to template and troubleshooting guide
- Marked as CRITICAL requirement

### 4. Development Checklist Updated
Added to backend checklist:
- [ ] Only set prefix on parent aggregator route, NOT on child routes
- [ ] Use consistent parameter names across routes for the same resource
- [ ] Test server startup after adding routes - prefix errors appear immediately

---

## Critical Rules Going Forward

### ✅ DO
1. **Only parent aggregator has prefix**
   ```typescript
   // Parent: apps/api/src/routes/workflows/index.ts
   export const workflowsRoutes = new Elysia({ prefix: "/workflows" })
     .use(childRoute1)
     .use(childRoute2);
   ```

2. **Child routes have NO prefix**
   ```typescript
   // Child: apps/api/src/routes/workflows/detail.ts
   export const workflowDetailRoute = new Elysia()  // No prefix!
     .get("/:workflowId", handler);
   ```

3. **Use consistent parameter names**
   ```typescript
   // All routes use :workflowId
   "/:workflowId"
   "/:workflowId/documents"
   "/:workflowId/documents/:documentId"
   ```

4. **Follow naming pattern: {resourceName}Id**
   - `workflowId` not `id`
   - `supplierId` not `supplier`
   - `documentId` not `docId`

### ❌ DON'T
1. **Don't add prefix to child routes**
   ```typescript
   // ❌ WRONG
   export const childRoute = new Elysia({ prefix: "/workflows" })
   ```

2. **Don't mix parameter names**
   ```typescript
   // ❌ WRONG - conflicts at same position
   "/:id"              // Route 1
   "/:workflowId/..."  // Route 2
   ```

3. **Don't use generic :id when context needs clarity**
   ```typescript
   // ❌ WRONG - ambiguous
   "/:id/documents/:id"
   
   // ✅ CORRECT - clear
   "/:workflowId/documents/:documentId"
   ```

---

## Testing Verification

### Server Startup
✅ API server now starts without route registration errors
```bash
cd apps/api
bun run dev
# Should start successfully without route conflicts
```

### Route Registration
Routes now correctly registered as:
```
GET    /api/workflows/:workflowId
GET    /api/workflows/:workflowId/documents
POST   /api/workflows/:workflowId/documents
DELETE /api/workflows/:workflowId/documents/:documentId
```

### Frontend Compatibility
✅ Eden Treaty client automatically adapts to new route structure
- No frontend changes needed
- Type-safe API calls maintained

---

## Quick Reference

### When Creating New Route Module

1. **Check parent has prefix, children don't**
   ```typescript
   // Parent (index.ts)
   new Elysia({ prefix: "/resource" })
   
   // Children (*.ts)
   new Elysia()  // No prefix!
   ```

2. **Standardize parameter names**
   ```typescript
   // All routes use same name
   "/:resourceId"
   "/:resourceId/subresource"
   "/:resourceId/subresource/:subresourceId"
   ```

3. **Document routes in parent**
   ```typescript
   /**
    * Routes:
    * - GET /api/resource/:resourceId
    * - POST /api/resource/:resourceId/action
    */
   ```

4. **Test server startup**
   ```bash
   cd apps/api && bun run src/index.ts
   # Watch for route registration errors
   ```

---

## Related Documentation

- [Issue 8 Details](./known-issues-and-fixes.md#issue-8-elysiajs-route-prefix-duplication---parameter-name-conflicts)
- [Route Module Template](../templates/elysia-route-module-template.ts)
- [Coding Standards](../architecture/coding-standards.md)
- [Development Checklist](./known-issues-and-fixes.md#development-checklist)

---

## Summary

This fix ensures:
1. ✅ Server starts without route conflicts
2. ✅ Routes have clear, consistent structure
3. ✅ Future developers have templates and guidelines
4. ✅ Error patterns are documented for prevention
5. ✅ Development checklist includes route organization checks

**Impact**: This pattern should be followed for ALL future ElysiaJS route modules to prevent similar issues.

