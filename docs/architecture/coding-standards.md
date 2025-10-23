# Coding Standards

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

## Naming Conventions

| Element         | Convention             | Example                     |
| --------------- | ---------------------- | --------------------------- |
| Components      | PascalCase             | `SupplierCard.tsx`          |
| Hooks           | camelCase with 'use'   | `useAuth.ts`                |
| Services        | PascalCase + 'Service' | `SupplierService.ts`        |
| API Routes      | kebab-case             | `/api/supplier-evaluations` |
| Database Tables | snake_case             | `supplier_evaluations`      |

---
