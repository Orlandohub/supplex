# Coding Standards

## Critical Fullstack Rules

- **Type Sharing:** Always define types in `packages/types` and import from there
- **API Calls:** Never make direct HTTP calls - use Eden Treaty client
- **Environment Variables:** Access only through config objects, never `process.env` directly
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
