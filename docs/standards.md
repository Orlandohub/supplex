# Standards

This document captures the contributor-facing implementation standards for Supplex.

Use it for:

- coding rules
- Remix route and data-loading patterns
- routing conventions
- stack choices that are still actively enforced
- logging expectations

When standards and code differ, prefer the live implementation and update this document if the rule still reflects intentional practice.

## Core Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | Remix + React + TypeScript | SSR web application |
| Backend | Bun + ElysiaJS + TypeScript | API and business logic |
| Database | PostgreSQL on Supabase | Relational data, auth, storage |
| ORM | Drizzle | Type-safe schema and queries |
| Styling | Tailwind CSS + shadcn/ui patterns | UI implementation |
| Forms | React Hook Form + Zod | Form handling and validation |
| State | Zustand | Lightweight client-side state |
| Queue | Redis + BullMQ | Background jobs where enabled |
| Monitoring | Sentry + Vercel Analytics | Error tracking and performance monitoring |
| Testing | Vitest, Bun Test, Playwright | Component, API, and browser testing |

## Repo Shape

- `apps/web` - Remix app
- `apps/api` - Elysia API
- `packages/db` - schema and migrations
- `packages/types` - shared types
- `packages/ui` - lightweight shared UI surface
- `packages/config` - shared tooling config

## Critical Fullstack Rules

- Define shared types in `packages/types` and import from there
- Do not make ad hoc direct HTTP calls when a typed client pattern already exists
- Keep tenant filtering and tenant isolation explicit in backend data access
- Use standard error handling shapes in API routes
- Do not mutate state directly

## UI Component Rules

- Use shadcn/ui-style primitives as the default base for new UI
- Prefer extending existing app patterns before building bespoke components
- Reuse existing forms, tables, badges, dialogs, toasts, and navigation behavior where possible
- Keep new UI aligned with the current Midday-inspired interaction style
- Introduce custom components only when the existing primitives and patterns do not fit the product need cleanly

## Environment Variables

- See `apps/web/README.md` for frontend environment behavior
- Never use `process.env` directly in isomorphic code
- The web app uses the `window.ENV` -> `import.meta.env` -> `process.env` pattern
- Do not modify `apps/web/vite.config.ts` env handling casually
- Do not remove `window.ENV` injection from `apps/web/app/root.tsx`

## Authentication And Authorization

- Use `authenticate` directly on routes instead of wrapping it in fragile custom middleware chains
- Perform role checks inside handlers with null safety
- Keep access-control behavior consistent across UI and API

## Database And Schema

- Verify field names against `packages/db/src/schema/` before writing queries
- Null-check joined data before using it
- Treat the schema package as the database source of truth

## Elysia Validation

- Use TypeBox for route validation
- Do not mix Zod schemas into Elysia route schema definitions

## Remix Patterns

- Fetch route data in loaders, not `useEffect`
- Load related data in parallel where possible
- Return route data together and pass it into child components
- Route components own data loading
- Child components receive route-owned data via props
- Use `shouldRevalidate` for URL-state changes like tabs and filters when a full reload is unnecessary
- Use `useRevalidator()` after mutations instead of manual client-side state repair

## Routing Conventions

- Authenticated app routes use the `_app.*` layout pattern
- Dots create URL segments and nesting
- A trailing underscore on a parameter segment creates a sibling route rather than a child route
- Use sibling routes when pages should render independently
- Use child routes only when they intentionally render inside a parent `<Outlet />`
- Parent Elysia route aggregators own the prefix
- Child Elysia routes should not redefine parent prefixes
- Use consistent parameter naming like `workflowId`, `supplierId`, and `processId`
- Remove obsolete routes instead of leaving old path variants behind

## Logging

- Prefer structured logs over ad hoc `console.log`
- Avoid logging secrets, tokens, or sensitive personal data
- Keep production logging lower-noise than development logging
- Use targeted logs while diagnosing issues and remove temporary logs before shipping
- Prefer the existing backend logger instead of introducing new logging styles

## Contributor Checklist

Before pushing code, verify:

- data loading follows Remix route patterns
- schema field names were verified
- auth and role checks include null safety
- TypeBox is used for route validation
- environment access is handled safely
- TypeScript builds pass
- relevant tests pass

## Naming Conventions

| Element | Convention | Example |
| --- | --- | --- |
| Components | PascalCase | `SupplierCard.tsx` |
| Hooks | camelCase with `use` | `useAuth.ts` |
| Services | PascalCase + `Service` | `SupplierService.ts` |
| API Routes | kebab-case | `/api/supplier-evaluations` |
| Database Tables | snake_case | `supplier_evaluations` |

## Related Docs

- `docs/README.md`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/frontend.md`
- `docs/troubleshooting.md`
