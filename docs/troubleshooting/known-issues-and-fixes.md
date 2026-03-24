# Known Issues and Fixes

This document captures issues encountered during development, their root causes, and solutions to prevent recurrence.

---

## Issue 9: Remix Route Nesting - Edit Route Not Rendering (Child Route Without Outlet)

**Date**: December 17, 2025  
**Affected Files**: `apps/web/app/routes/_app.suppliers.$id.edit.tsx` → renamed to `_app.suppliers.$id_.edit.tsx`

### Problem
When clicking the Edit button on supplier detail page, the URL changed to `/suppliers/:id/edit` but the page still showed the detail view (tabs and read-only content) instead of the editable form. No form fields were visible on the edit page.

### Root Cause
**Remix v2 Flat File Routing Nesting Convention:**
- File named `_app.suppliers.$id.edit.tsx` creates a **child route** nested under `_app.suppliers.$id.tsx`
- Child routes require the parent to render an `<Outlet />` component for the child to display
- The parent route (`_app.suppliers.$id.tsx`) had no `<Outlet />`, so the child route (edit form) never rendered
- When navigating to `/suppliers/123/edit`, Remix matched both parent and child, rendered parent component, but had nowhere to render the child

**Route Hierarchy Created:**
```
/suppliers/:id (parent)
  └─ /suppliers/:id/edit (child) ← Never renders without Outlet
```

### Symptoms
- ✅ Edit button navigation works (URL changes correctly)
- ❌ Edit page shows detail view instead of form
- ❌ No input fields visible
- ❌ No JavaScript errors in console
- ❌ Same component renders as detail page

### Solution
**Rename route file to use trailing underscore to create sibling routes:**

**OLD (child route):**
```
_app.suppliers.$id.edit.tsx
```

**NEW (sibling route):**
```
_app.suppliers.$id_.edit.tsx
```

The **trailing underscore after `$id_`** tells Remix to create a sibling route instead of a nested child route.

**Corrected Route Hierarchy:**
```
/suppliers/:id       ← Sibling (detail page)
/suppliers/:id/edit  ← Sibling (edit page, independent)
```

### Prevention Guidelines

#### 1. **Understand Remix Flat File Routing Conventions:**
- **Dots (.)** create segments and nesting
- **`$param.segment`** creates a child route under `$param`
- **`$param_.segment`** (trailing underscore) creates a sibling route at the same level
- **Child routes REQUIRE parent to have `<Outlet />`**

#### 2. **Use Sibling Routes for Independent Pages:**
For routes that should render completely different content (like detail vs. edit), use sibling routes:
```
✅ _app.resource.$id.tsx        → /resource/:id (detail)
✅ _app.resource.$id_.edit.tsx  → /resource/:id/edit (sibling edit page)

❌ _app.resource.$id.tsx        → /resource/:id (detail)
❌ _app.resource.$id.edit.tsx   → /resource/:id/edit (child, needs Outlet)
```

#### 3. **Use Child Routes Only When Sharing Layout:**
Use child routes (without trailing underscore) only when the child should render within the parent's layout:
```typescript
// Parent with shared layout
export default function ResourceLayout() {
  return (
    <div>
      <Header />
      <Outlet /> {/* ← REQUIRED for child routes */}
      <Footer />
    </div>
  );
}
```

#### 4. **Route Naming Checklist:**
Before creating a new route file, ask:
- **Q:** Should this page share the parent's layout?
  - **Yes** → Use child route (`$id.segment.tsx`) + add `<Outlet />` to parent
  - **No** → Use sibling route (`$id_.segment.tsx`)

#### 5. **Testing Edit Routes:**
When implementing edit functionality:
1. ✅ Click edit button → URL should change
2. ✅ Edit page should show DIFFERENT content than detail page
3. ✅ Check for form input fields (not just display text)
4. ✅ If you see the same content as detail page → check for child route without Outlet

### Related Files
- ✅ `apps/web/app/routes/_app.suppliers.$id_.edit.tsx` - Edit route (now sibling)
- ✅ `apps/web/app/routes/_app.suppliers.$id.tsx` - Detail route (no Outlet needed)
- ✅ `apps/web/app/components/suppliers/SupplierForm.tsx` - Edit form component
- ✅ `apps/web/app/components/suppliers/SupplierDetailTabs.tsx` - Detail view component (Edit button)

### Additional Notes
- This same pattern applies to any resource with detail/edit pages (workflows, evaluations, etc.)
- Always test navigation to edit pages during development
- Document route hierarchies in complex features

---

## Issue 1: Authentication Middleware - `user.role` is Undefined

**Date**: October 23, 2025  
**Affected Files**: `apps/api/src/routes/suppliers/create.ts`, `apps/api/src/routes/suppliers/update.ts`, `apps/api/src/routes/documents/upload.ts`, `apps/api/src/routes/documents/delete.ts`

### Problem
Routes using `requireRole` middleware reported `undefined is not an object (evaluating 'user.role')` errors. The authenticated `user` context was not being passed to nested route handlers.

### Root Cause
ElysiaJS middleware using `derive({ as: "scoped" })` does not correctly propagate derived context when the middleware returns a new Elysia instance. The `requireRole` middleware pattern:

```typescript
export const requireRole = (allowedRoles: UserRole[]) => {
  return new Elysia()
    .use(authenticate)
    .derive({ as: "scoped" }, async ({ user, set }) => {
      // Checking roles...
      return { user }; // This doesn't propagate correctly
    });
};
```

### Solution
**Use `authenticate` middleware directly and perform role checks inside the handler:**

```typescript
export const myRoute = new Elysia({ prefix: "/api" })
  .use(authenticate)  // ✅ Direct middleware use
  .post("/endpoint", async ({ user, set, body }) => {
    // ✅ Role check inside handler
    if (!user?.role || ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(user.role as UserRole)) {
      set.status = 403;
      return { success: false, error: { /* ... */ } };
    }
    
    // Handler logic...
  });
```

### Prevention Guidelines
1. **Never nest middleware that derive context** - use them directly on the route
2. **Always validate `user` and `user.role` exist** before accessing properties
3. **Test authentication middleware logging** - if auth logs don't appear for a route, the middleware isn't being applied correctly
4. **Prefer in-handler role checks** over custom middleware wrappers for role-based authorization

---

## Issue 2: Schema Mismatch - User Fields Don't Exist

**Date**: October 23, 2025  
**Affected Files**: `apps/api/src/routes/suppliers/detail.ts`

### Problem
Route crashed with `TypeError: Object.entries requires that input parameter not be null or undefined` when fetching supplier details with user information.

### Root Cause
The `users` table schema has a `fullName` field, but the query was trying to select non-existent `firstName` and `lastName` fields:

```typescript
// ❌ WRONG - these fields don't exist
createdByUser: {
  id: users.id,
  email: users.email,
  firstName: users.firstName,  // Doesn't exist!
  lastName: users.lastName,    // Doesn't exist!
}
```

When Drizzle couldn't find these fields, it returned undefined, causing Object.entries to crash.

### Solution
**Use the actual schema fields:**

```typescript
// ✅ CORRECT - use fullName
createdByUser: {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
}

// In response formatting:
createdByName: createdByUser?.fullName || "Unknown",  // ✅ Direct use
// Instead of:
createdByName: `${createdByUser.firstName} ${createdByUser.lastName}`.trim()  // ❌ Wrong
```

### Prevention Guidelines
1. **Always reference the source schema** when writing Drizzle queries
2. **Check schema files** in `packages/db/schema/` before assuming field names
3. **Use TypeScript auto-complete** to catch non-existent fields at development time
4. **Add null checks** when working with joined data: `createdByUser?.fullName`
5. **Test with actual data** - schema mismatches only appear at runtime

---

## Issue 3: `process is not defined` in Browser

**Date**: October 23, 2025  
**Affected Files**: `apps/web/app/lib/config.ts`, `apps/web/app/types/env.d.ts`

### Problem
Clicking on supplier rows to navigate to detail pages caused the error:
```
ReferenceError: process is not defined at getConfig (app/lib/config.ts:2:18)
```

The page would refresh instead of navigating.

### Root Cause
The `config.ts` file was accessing `process.env` at the module level:

```typescript
// ❌ WRONG - process only exists in Node.js, not in browsers
function getConfig(): AppConfig {
  const apiUrl = process.env.API_URL || "http://localhost:3001";
  const nodeEnv = process.env.NODE_ENV || "development";
  // ...
}
```

When Remix tried to load this module in the browser (for client-side navigation), it crashed because `process` is a Node.js global that doesn't exist in browsers.

### Solution
**Make config isomorphic - detect environment and use appropriate source:**

```typescript
// ✅ CORRECT - works in both server and browser
function getConfig(): AppConfig {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== "undefined";
  
  // In browser, use window.ENV or fallback to defaults
  // In server, use process.env
  const apiUrl = isBrowser 
    ? (window.ENV?.API_URL || "http://localhost:3001")
    : (process.env.API_URL || "http://localhost:3001");
    
  const nodeEnv = isBrowser
    ? (window.ENV?.NODE_ENV || "development")
    : (process.env.NODE_ENV || "development");

  return {
    apiUrl,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}
```

**Update TypeScript definitions:**

```typescript
// apps/web/app/types/env.d.ts
declare global {
  interface Window {
    ENV?: {  // ✅ Optional - won't crash if undefined
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
      API_URL?: string;
      NODE_ENV?: string;  // ✅ Added
    };
  }
}
```

### Prevention Guidelines
1. **Never access `process.env` directly in frontend code** - it won't exist in the browser
2. **Use isomorphic patterns** - check `typeof window !== "undefined"` to detect environment
3. **Prefer loader data** - pass environment config from server loaders to components
4. **Use Remix's env system** - inject env vars into `window.ENV` via `root.tsx`
5. **Test client-side navigation** - issues with browser-incompatible code only appear during navigation, not initial page loads
6. **Remember**: Remix runs code on BOTH server and client - always write isomorphic code

### Remix Environment Best Practices

**In `root.tsx` loader:**
```typescript
export async function loader() {
  return json({
    ENV: {
      API_URL: process.env.API_URL,
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
```

**In `root.tsx` component:**
```tsx
export default function App() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <html>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
      </head>
      {/* ... */}
    </html>
  );
}
```

---

## Development Checklist

Use this checklist when implementing new features:

### Backend (API) Routes
- [ ] Use `authenticate` middleware directly, not nested in custom wrappers
- [ ] Perform role checks inside handlers with proper null checks: `if (!user?.role || ...)`
- [ ] Verify all schema field names against actual schema files in `packages/db/schema/`
- [ ] Add null checks for joined data: `joinedTable?.field`
- [ ] Test with authentication logs appearing in console
- [ ] Test with real data to catch schema mismatches
- [ ] Only set prefix on parent aggregator route, NOT on child routes (Issue 8)
- [ ] Use consistent parameter names across routes for the same resource (Issue 8)
- [ ] Test server startup after adding routes - prefix errors appear immediately (Issue 8)

### Frontend (Web) Code
- [ ] Never access `process.env` directly - use `window.ENV` or loader data
- [ ] Make shared utilities isomorphic (work in both server and browser)
- [ ] Test client-side navigation, not just initial page loads
- [ ] Use TypeScript to catch type errors at development time
- [ ] Handle optional/undefined values gracefully
- [ ] Each route needs its own loader if using `useLoaderData()` (Issue 7)
- [ ] Use `useRouteLoaderData(routeId)` to access parent route data if needed (Issue 7)
- [ ] Clean up old routes when migrating to new layout patterns (Issue 6)
- [ ] Check for route path collisions in dev server warnings (Issue 6)

### Testing
- [ ] Test authenticated routes with different user roles
- [ ] Test client-side navigation between pages
- [ ] Check browser console for `process is not defined` errors
- [ ] Verify authentication middleware logs appear for protected routes
- [ ] Test with actual database data, not just mock data

---

## Quick Reference: Common Patterns

### ✅ Correct ElysiaJS Route with Auth
```typescript
export const myRoute = new Elysia({ prefix: "/api" })
  .use(authenticate)
  .post("/endpoint", async ({ user, set, body }) => {
    if (!user?.role || !allowedRoles.includes(user.role as UserRole)) {
      set.status = 403;
      return { success: false, error: { message: "Forbidden" } };
    }
    // Handler logic
  });
```

### ✅ Correct Drizzle Query with Joins
```typescript
const result = await db
  .select({
    mainTable: myTable,
    joinedData: {
      id: otherTable.id,
      name: otherTable.name,  // Verify these fields exist!
    },
  })
  .from(myTable)
  .leftJoin(otherTable, eq(myTable.foreignKey, otherTable.id));

// Always null-check joined data
const enrichedData = {
  ...result[0].mainTable,
  joinedName: result[0].joinedData?.name || "Unknown",
};
```

### ✅ Correct Isomorphic Config
```typescript
const isBrowser = typeof window !== "undefined";
const config = isBrowser ? window.ENV?.CONFIG : process.env.CONFIG;
```

---

## Issue 4: Missing import.meta.env in Config + Wrong API URL Variable

**Date**: October 23, 2025  
**Affected Files**: `apps/web/app/lib/config.ts`, `apps/web/app/components/suppliers/DocumentUploadModal.tsx`

### Problem
Document upload failed with error:
```
POST request to "/suppliers/undefined/api/suppliers/{id}/documents"
```

The URL was malformed with "undefined" in the path, causing Remix to treat it as a relative URL.

### Root Cause
Two related issues:

1. **Wrong environment variable name in DocumentUploadModal**:
   ```typescript
   `${import.meta.env.VITE_API_URL}/api/suppliers/...`  // ❌ VITE_API_URL doesn't exist
   ```
   - Should be `import.meta.env.API_URL` (exposed by `vite.config.ts` envPrefix: `['API_']`)
   - `VITE_API_URL` is undefined, causing malformed URL

2. **Incomplete config.ts implementation**:
   ```typescript
   // ❌ Missing import.meta.env source
   const apiUrl = isBrowser
     ? window.ENV?.API_URL
     : process.env.API_URL;
   ```
   - According to `ENV-CONFIG.md`, should have 3 sources: `window.ENV`, `import.meta.env`, `process.env`
   - Missing `import.meta.env` breaks build-time configuration

### Solution
**1. Fix config.ts to include all 3 sources (matches supabase-client.ts pattern):**

```typescript
function getConfig(): AppConfig {
  const isBrowser = typeof window !== "undefined";

  // Multi-source environment variable loading (matches supabase-client.ts pattern)
  // 1. Browser: window.ENV (from server via root.tsx)
  // 2. Server/Build: import.meta.env (Vite) or process.env (Node.js)
  const apiUrl = isBrowser
    ? window.ENV?.API_URL || "http://localhost:3001"
    : import.meta.env.API_URL || process.env.API_URL || "http://localhost:3001";  // ✅ Added import.meta.env

  return { apiUrl, /* ... */ };
}
```

**2. Fix DocumentUploadModal to use centralized config:**

```typescript
import { config } from "~/lib/config";

// Then use:
const response = await fetch(
  `${config.apiUrl}/api/suppliers/${supplierId}/documents`,  // ✅ Uses centralized config
  // ...
);
```

### Prevention Guidelines
1. **Always use centralized `config.apiUrl`** - never access env vars directly in components
2. **Follow the 3-source pattern** documented in `supabase-client.ts`:
   - Browser: `window.ENV`
   - Build-time: `import.meta.env`
   - Server: `process.env`
3. **Check `vite.config.ts` envPrefix** - only variables with these prefixes are exposed to `import.meta.env`
4. **Never use `VITE_*` prefixed vars** unless explicitly added to envPrefix
5. **Reference `ENV-CONFIG.md`** when working with environment variables

---

## Issue 5: Mixing Zod and TypeBox Schemas in ElysiaJS

**Date**: October 23, 2025  
**Affected Files**: `apps/api/src/routes/documents/upload.ts`

### Problem
Document upload failed during OPTIONS preflight with error:
```
error: Preflight validation check failed to guard for the given schema
```

ElysiaJS couldn't compile the route schema, causing the API endpoint to crash.

### Root Cause
Mixed Zod schema with TypeBox schemas in ElysiaJS route body validation:

```typescript
import { DocumentTypeSchema } from "@supplex/types";  // ❌ Zod schema

body: t.Object({
  file: t.File({ /* ... */ }),              // ✅ TypeBox
  documentType: DocumentTypeSchema,         // ❌ Zod schema - doesn't work!
  description: t.Optional(t.String()),      // ✅ TypeBox
})
```

**ElysiaJS uses TypeBox (`t.*`) for validation, not Zod (`z.*`).**

When ElysiaJS tried to compile the schema, it failed because `DocumentTypeSchema` is a Zod schema (`z.nativeEnum(DocumentType)`), which TypeBox cannot process.

### Solution
**Replace Zod schema with TypeBox union of literals:**

```typescript
// ❌ WRONG - Remove Zod import
// import { UserRole, DocumentTypeSchema } from "@supplex/types";

// ✅ CORRECT - Only import types, not Zod schemas
import { UserRole } from "@supplex/types";

body: t.Object({
  file: t.File({
    type: ALLOWED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE,
  }),
  // ✅ Use TypeBox union instead of Zod enum
  documentType: t.Union([
    t.Literal("certificate"),
    t.Literal("contract"),
    t.Literal("insurance"),
    t.Literal("audit_report"),
    t.Literal("other"),
  ]),
  description: t.Optional(t.String()),
  expiryDate: t.Optional(t.String({ format: "date" })),
})
```

### Prevention Guidelines
1. **Never mix Zod and TypeBox** - ElysiaJS routes must use TypeBox (`t.*`) exclusively
2. **@supplex/types can export Zod schemas** for frontend validation, but API routes must use TypeBox
3. **For enums in ElysiaJS routes**, use `t.Union([t.Literal(...), ...])` not Zod's `z.nativeEnum()`
4. **Check imports** - if you see `z.*` in an ElysiaJS route file, it's wrong
5. **Runtime validation** - ElysiaJS compiles schemas at startup; errors appear during server startup, not at request time

### Correct Pattern for Enums in ElysiaJS

```typescript
// ✅ TypeBox union of literals
documentType: t.Union([
  t.Literal("value1"),
  t.Literal("value2"),
  t.Literal("value3"),
])

// Or with TypeBox enum (if you want to define it separately)
const DocumentTypeEnum = t.Union([
  t.Literal("certificate"),
  t.Literal("contract"),
  // ...
]);

body: t.Object({
  documentType: DocumentTypeEnum,
})
```

---

## Issue 6: Route Path Collision - Old and New Index Routes

**Date**: October 24, 2025  
**Affected Files**: `apps/web/app/routes/_index.tsx`, `apps/web/app/routes/_app._index.tsx`

### Problem
Remix dev server showed warning:
```
⚠️ Route Path Collision: "/"

The following routes all define the same URL, only the first one will be used

🟢 routes/_app._index.tsx
⭕️️ routes/_index.tsx
```

Only the first route (`_app._index.tsx`) was being used, but the old standalone route (`_index.tsx`) remained in the codebase causing confusion.

### Root Cause
During the migration to the new AppShell layout (Story 1.10), a new `_app._index.tsx` route was created to work within the persistent layout wrapper (`_app.tsx`). However, the old standalone `_index.tsx` route (which had its own navigation and header) was not deleted.

Both routes matched the root path `"/"`, causing a collision.

### Solution
**Delete the obsolete standalone route:**

```bash
# Remove the old file
rm apps/web/app/routes/_index.tsx
```

**Keep only the new layout-aware route:** `apps/web/app/routes/_app._index.tsx`

The new architecture uses:
- `_app.tsx` - Persistent layout wrapper (AppShell with sidebar, top nav, mobile nav)
- `_app._index.tsx` - Dashboard content inside the layout
- `_app.suppliers._index.tsx`, `_app.suppliers.$id.tsx`, etc. - All authenticated routes inside the layout

### Prevention Guidelines
1. **Clean up old routes** when migrating to new layout patterns
2. **Check for route collisions** in dev server warnings
3. **Use layout routes consistently** - prefix all authenticated routes with the layout prefix (e.g., `_app.*`)
4. **Delete, don't comment out** - Remove obsolete route files completely to avoid confusion
5. **Follow Remix file-based routing conventions** - understand how file names map to URL paths

### Remix Layout Route Pattern

```
routes/
  _app.tsx                    → Layout wrapper (no URL segment)
  _app._index.tsx            → "/" (inside layout)
  _app.suppliers._index.tsx  → "/suppliers" (inside layout)
  _app.suppliers.$id.tsx     → "/suppliers/:id" (inside layout)
  login.tsx                  → "/login" (standalone, no layout)
```

---

## Issue 7: Child Route Cannot Access Parent Loader Data

**Date**: October 24, 2025  
**Affected Files**: `apps/web/app/routes/_app._index.tsx`

### Problem
After fixing the route collision, the dashboard page crashed with:
```
TypeError: Cannot destructure property 'user' of '__vite_ssr_import_1__.useLoaderData(...)' as it is null.
    at Dashboard (apps/web/app/routes/_app._index.tsx:21:11)
```

The child route was trying to access parent loader data, but received `null`.

### Root Cause
The `_app._index.tsx` route was attempting to use the parent route's loader data:

```typescript
// ❌ WRONG - trying to access parent loader via useLoaderData()
import type { loader as appLoader } from './_app';

export default function Dashboard() {
  const { user, userRecord } = useLoaderData<typeof appLoader>();  // Returns null!
  // ...
}
```

**In Remix, `useLoaderData()` only returns data from the current route's loader, not parent loaders.**

While the parent `_app.tsx` had a loader that returned `user` and `userRecord`, the child route `_app._index.tsx` had no loader of its own. When a route has no loader, `useLoaderData()` returns `null`.

### Solution
**Add a loader to the child route:**

```typescript
// ✅ CORRECT - child route has its own loader
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireAuth } from '~/lib/auth/require-auth';

export async function loader(args: LoaderFunctionArgs) {
  // Require authentication for dashboard
  const { user, userRecord } = await requireAuth(args);

  return json({
    user,
    userRecord,
  });
}

export default function Dashboard() {
  const { user, userRecord } = useLoaderData<typeof loader>();  // ✅ Works!
  // ...
}
```

**Alternative: Use `useRouteLoaderData()` to access parent data:**

```typescript
// ✅ ALTERNATIVE - explicitly access parent loader data
import { useRouteLoaderData } from '@remix-run/react';
import type { loader as appLoader } from './_app';

export default function Dashboard() {
  const data = useRouteLoaderData<typeof appLoader>('routes/_app');  // ✅ Access parent by route ID
  const { user, userRecord } = data || {};
  // ...
}
```

### Prevention Guidelines
1. **Each route needs its own loader** if it wants to use `useLoaderData()`
2. **`useLoaderData()` only returns current route data** - not parent route data
3. **Use `useRouteLoaderData(routeId)` to access parent loaders** - requires knowing the route ID
4. **Prefer child loaders for simplicity** - easier to type and doesn't require route IDs
5. **Parent loaders run before child loaders** - auth checks in both is fine (double protection)
6. **Test with actual data** - null loader data only appears at runtime

### Remix Data Loading Hierarchy

```typescript
// Parent Layout Route: _app.tsx
export async function loader(args: LoaderFunctionArgs) {
  const { user } = await requireAuth(args);
  return json({ user });  // Available to useRouteLoaderData('routes/_app')
}

// Child Route: _app._index.tsx
export async function loader(args: LoaderFunctionArgs) {
  const { stats } = await fetchDashboardStats();
  return json({ stats });  // Available to useLoaderData()
}

export default function Dashboard() {
  // ✅ Current route data
  const { stats } = useLoaderData<typeof loader>();
  
  // ✅ Parent route data (if needed)
  const parentData = useRouteLoaderData<typeof parentLoader>('routes/_app');
  
  // ❌ WRONG - useLoaderData() doesn't return parent data
  const { user } = useLoaderData<typeof parentLoader>();  // Returns null!
}
```

### When to Use Which Hook

| Hook | Use Case | Returns |
|------|----------|---------|
| `useLoaderData()` | Access current route's loader data | Current route data only |
| `useRouteLoaderData(routeId)` | Access parent or sibling route data | Specific route's data by ID |
| `useMatches()` | Access all matched route data | Array of all matched routes |

**Best Practice:** Give each route its own loader for the data it needs. Only use `useRouteLoaderData()` when you need to avoid duplicate data fetching.

---

## Issue 8: ElysiaJS Route Prefix Duplication - Parameter Name Conflicts

**Date**: October 24, 2025  
**Affected Files**: `apps/api/src/routes/workflows/index.ts`, `apps/api/src/routes/workflows/detail.ts`, `apps/api/src/routes/workflows/documents.ts`, `apps/api/src/routes/workflows/upload-document.ts`, `apps/api/src/routes/workflows/remove-document.ts`

### Problem
API server crashed on startup with route registration error:
```
error: Cannot create route "/workflows/workflows/:workflowId/documents" with parameter "workflowId" because a route already exists with a different parameter name ("id") in the same location
```

The server could not start because routes had duplicate prefixes and conflicting parameter names.

### Root Cause
**Double Prefix**: Parent index route and child routes both defined the same prefix:

```typescript
// Parent: apps/api/src/routes/workflows/index.ts
export const workflowsRoutes = new Elysia({ prefix: "/workflows" })  // ✅ Parent prefix
  .use(workflowDetailRoute)
  .use(workflowDocumentsRoute)
  // ...

// Child: apps/api/src/routes/workflows/detail.ts
export const workflowDetailRoute = new Elysia({ prefix: "/workflows" })  // ❌ Duplicate prefix!
  .use(authenticate)
  .get("/:id", async ({ params, user, set }) => {
    // ...
  });

// Child: apps/api/src/routes/workflows/documents.ts
export const workflowDocumentsRoute = new Elysia({ prefix: "/workflows" })  // ❌ Duplicate prefix!
  .use(authenticate)
  .get("/:workflowId/documents", async ({ params, user, set }) => {
    // ...
  });
```

This created routes like:
- `/workflows/workflows/:id` (should be `/workflows/:id`)
- `/workflows/workflows/:workflowId/documents` (should be `/workflows/:workflowId/documents`)

**Parameter Name Conflict**: Additionally, different routes used different parameter names (`:id` vs `:workflowId`) at the same path segment position, causing ElysiaJS to reject the routes.

### Solution
**1. Remove redundant prefixes from child routes:**

```typescript
// ✅ CORRECT - No prefix on child routes
export const workflowDetailRoute = new Elysia()  // No prefix - parent provides it
  .use(authenticate)
  .get("/:workflowId", async ({ params, user, set }) => {
    // ...
  });

export const workflowDocumentsRoute = new Elysia()  // No prefix
  .use(authenticate)
  .get("/:workflowId/documents", async ({ params, user, set }) => {
    // ...
  });
```

**2. Standardize parameter names across all routes:**

```typescript
// ✅ All routes use consistent parameter name
"/:workflowId"                           // GET workflow detail
"/:workflowId/documents"                 // GET workflow documents
"/:workflowId/documents"                 // POST upload document
"/:workflowId/documents/:documentId"     // DELETE remove document
```

### Prevention Guidelines
1. **Only set prefix on the parent aggregator route** - child routes should NOT have prefixes
2. **Standardize parameter names** - use consistent names for the same resource across all routes
3. **Pattern**: `{resource}Id` for IDs (e.g., `workflowId`, `supplierId`, `documentId`)
4. **Document route structure** in parent index file comments
5. **Test server startup** after adding new routes - prefix errors appear immediately
6. **Use descriptive parameter names** - prefer `:workflowId` over generic `:id` when route tree has multiple resources

### Correct ElysiaJS Route Organization Pattern

**Parent Aggregator (index.ts):**
```typescript
import { Elysia } from "elysia";
import { workflowDetailRoute } from "./detail";
import { workflowDocumentsRoute } from "./documents";

/**
 * Workflow Routes
 * 
 * Routes:
 * - GET /api/workflows/:workflowId - Get workflow details
 * - GET /api/workflows/:workflowId/documents - Get workflow documents
 * - POST /api/workflows/:workflowId/documents - Upload document
 */
export const workflowsRoutes = new Elysia({ prefix: "/workflows" })  // ✅ Only parent has prefix
  .use(workflowDetailRoute)
  .use(workflowDocumentsRoute);
```

**Child Route (detail.ts):**
```typescript
import { Elysia, t } from "elysia";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/:workflowId
 * Get workflow details
 */
export const workflowDetailRoute = new Elysia()  // ✅ No prefix - parent provides "/workflows"
  .use(authenticate)
  .get(
    "/:workflowId",  // ✅ Consistent parameter name
    async ({ params, user, set }) => {
      const workflow = await db.query.qualificationWorkflows.findFirst({
        where: eq(qualificationWorkflows.id, params.workflowId),  // ✅ Use workflowId
        // ...
      });
      // ...
    },
    {
      params: t.Object({
        workflowId: t.String({ format: "uuid" }),  // ✅ Match parameter name
      }),
    }
  );
```

**Child Route (documents.ts):**
```typescript
import { Elysia, t } from "elysia";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/:workflowId/documents
 * Get all workflow documents
 */
export const workflowDocumentsRoute = new Elysia()  // ✅ No prefix
  .use(authenticate)
  .get(
    "/:workflowId/documents",  // ✅ Same parameter name as detail route
    async ({ params, user, set }) => {
      const workflowDocs = await db.query.workflowDocuments.findMany({
        where: eq(workflowDocuments.workflowId, params.workflowId),  // ✅ Consistent
        // ...
      });
      // ...
    },
    {
      params: t.Object({
        workflowId: t.String({ format: "uuid" }),  // ✅ Consistent
      }),
    }
  );
```

### Quick Checklist for ElysiaJS Route Files

**When creating a new route module:**
- [ ] Parent aggregator (`index.ts`) has prefix, child routes do NOT
- [ ] All routes for same resource use consistent parameter names (e.g., all use `:workflowId`)
- [ ] Route structure documented in parent file comments
- [ ] Parameter validation matches parameter names in path
- [ ] Server starts without route registration errors
- [ ] Routes appear correctly in Swagger/OpenAPI docs (if enabled)

### Common Mistakes to Avoid

❌ **Bad - Prefix on both parent and child:**
```typescript
// Parent
export const workflowsRoutes = new Elysia({ prefix: "/workflows" })
  .use(workflowDetailRoute);

// Child - WRONG!
export const workflowDetailRoute = new Elysia({ prefix: "/workflows" })  // Duplicate!
  .get("/:id", handler);
// Results in: /workflows/workflows/:id
```

❌ **Bad - Inconsistent parameter names:**
```typescript
// Route 1 uses :id
export const workflowDetailRoute = new Elysia()
  .get("/:id", handler);

// Route 2 uses :workflowId - CONFLICT!
export const workflowDocumentsRoute = new Elysia()
  .get("/:workflowId/documents", handler);
// ElysiaJS error: parameter name conflict at same position
```

✅ **Good - Clean route organization:**
```typescript
// Parent has prefix
export const workflowsRoutes = new Elysia({ prefix: "/workflows" })
  .use(workflowDetailRoute)
  .use(workflowDocumentsRoute);

// Children have no prefix, consistent parameter names
export const workflowDetailRoute = new Elysia()
  .get("/:workflowId", handler);

export const workflowDocumentsRoute = new Elysia()
  .get("/:workflowId/documents", handler);
// Results in: /workflows/:workflowId and /workflows/:workflowId/documents
```

---

**Last Updated**: October 24, 2025

