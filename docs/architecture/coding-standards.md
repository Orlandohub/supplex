# Coding Standards

> 📚 **See Also:**  
> - [Remix Patterns](./remix-patterns.md) - Standard patterns for Remix routes (**REQUIRED READING**)
> - [Known Issues & Fixes](../troubleshooting/known-issues-and-fixes.md) - Common pitfalls and solutions

## Critical Fullstack Rules

- **Type Sharing:** Always define types in `packages/types` and import from there
- **API Calls:** Never make direct HTTP calls - use Eden Treaty client
- **Environment Variables:** 
  - CRITICAL: See `apps/web/ENV-CONFIG.md` for Supabase env var configuration
  - Never use `process.env` directly in isomorphic code (breaks SSR)
  - Web app uses multi-source pattern: `window.ENV` → `import.meta.env` → `process.env`
  - DO NOT modify `apps/web/vite.config.ts` envPrefix without reading ENV-CONFIG.md
  - DO NOT remove `window.ENV` injection from `apps/web/app/root.tsx`
- **Error Handling:** All API routes must use standard error handler
- **State Updates:** Never mutate state directly
- **Tenant Isolation:** All database queries must include tenant filter
- **Authentication Middleware:** 
  - Use `authenticate` middleware directly on routes, not nested in wrappers
  - Perform role checks inside handlers with null checks: `if (!user?.role || ...)`
  - See [Issue 1](../troubleshooting/known-issues-and-fixes.md#issue-1-authentication-middleware---userrole-is-undefined)
- **Database Schema:** 
  - Always verify field names against actual schema files before writing queries
  - Add null checks for joined data: `joinedTable?.field`
  - See [Issue 2](../troubleshooting/known-issues-and-fixes.md#issue-2-schema-mismatch---user-fields-dont-exist)
- **ElysiaJS Validation:** 
  - Use TypeBox (`t.*`) exclusively for route validation, never Zod (`z.*`)
  - For enums, use `t.Union([t.Literal(...), ...])` not Zod schemas
  - See [Issue 5](../troubleshooting/known-issues-and-fixes.md#issue-5-mixing-zod-and-typebox-schemas-in-elysiajs)
- **ElysiaJS Route Organization:** (**CRITICAL**)
  - ONLY parent aggregator (`index.ts`) should have a prefix
  - Child routes must NOT have prefixes - parent provides them
  - Use consistent parameter names across routes (e.g., all use `:workflowId`)
  - Follow pattern: `{resourceName}Id` for IDs (e.g., `workflowId`, `supplierId`)
  - See [Route Module Template](../templates/elysia-route-module-template.ts)
  - See [Issue 8](../troubleshooting/known-issues-and-fixes.md#issue-8-elysiajs-route-prefix-duplication---parameter-name-conflicts)
- **Environment Variables (Frontend):**
  - Always use centralized `config.apiUrl` - never access env vars directly
  - Follow 3-source pattern: `window.ENV`, `import.meta.env`, `process.env`
  - See [Issue 4](../troubleshooting/known-issues-and-fixes.md#issue-4-missing-importmetaenv-in-config--wrong-api-url-variable)
- **Remix Data Loading:** (**CRITICAL** - See [Remix Patterns](./remix-patterns.md))
  - ALL data fetching must be in loaders (server-side), never in useEffect
  - Use `Promise.all` for parallel data fetching
  - Pass data to components via props, not by fetching in components
  - Add `shouldRevalidate` for routes with URL state (tabs, filters, sorting)
  - Use `useRevalidator()` for mutations, never manual state updates
  - Each route needs its own loader if using `useLoaderData()` - it doesn't access parent data
  - Use `useRouteLoaderData(routeId)` to explicitly access parent loader data if needed
  - See [Issue 7](../troubleshooting/known-issues-and-fixes.md#issue-7-child-route-cannot-access-parent-loader-data)
- **Remix Layout Routes:**
  - Clean up old routes when migrating to new layout patterns
  - Prefix all authenticated routes with layout prefix (e.g., `_app.*`)
  - Delete obsolete routes completely - don't leave them commented out
  - See [Issue 6](../troubleshooting/known-issues-and-fixes.md#issue-6-route-path-collision---old-and-new-index-routes)

## Naming Conventions

| Element         | Convention             | Example                     |
| --------------- | ---------------------- | --------------------------- |
| Components      | PascalCase             | `SupplierCard.tsx`          |
| Hooks           | camelCase with 'use'   | `useAuth.ts`                |
| Services        | PascalCase + 'Service' | `SupplierService.ts`        |
| API Routes      | kebab-case             | `/api/supplier-evaluations` |
| Database Tables | snake_case             | `supplier_evaluations`      |

---
