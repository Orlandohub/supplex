# Coding Standards

> 📚 **See Also:** [Known Issues & Fixes](../troubleshooting/known-issues-and-fixes.md) - Common pitfalls and solutions

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

## Naming Conventions

| Element         | Convention             | Example                     |
| --------------- | ---------------------- | --------------------------- |
| Components      | PascalCase             | `SupplierCard.tsx`          |
| Hooks           | camelCase with 'use'   | `useAuth.ts`                |
| Services        | PascalCase + 'Service' | `SupplierService.ts`        |
| API Routes      | kebab-case             | `/api/supplier-evaluations` |
| Database Tables | snake_case             | `supplier_evaluations`      |

---
