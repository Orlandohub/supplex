# Known Issues and Fixes

This document captures issues encountered during development, their root causes, and solutions to prevent recurrence.

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

### Frontend (Web) Code
- [ ] Never access `process.env` directly - use `window.ENV` or loader data
- [ ] Make shared utilities isomorphic (work in both server and browser)
- [ ] Test client-side navigation, not just initial page loads
- [ ] Use TypeScript to catch type errors at development time
- [ ] Handle optional/undefined values gracefully

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

**Last Updated**: October 23, 2025

