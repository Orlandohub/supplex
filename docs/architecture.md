# Supplex Architecture

This is the main architecture overview for contributors.

Use this document to understand the current system shape, module boundaries, runtime flow, and where to look next. When architectural docs and implementation differ, prefer the live code in `apps/` and `packages/` and update the docs accordingly.

## System Overview

Supplex is a multi-tenant supplier management platform for regulated manufacturers. The current implementation is strongest around:

- supplier master data
- qualification and workflow execution
- dynamic forms and workflow templates
- document handling
- user, task, and admin configuration

The broader product scope still includes performance evaluation, complaints/CAPA, dashboards, exports, and API access. Those areas remain part of the intended system shape, but contributors should verify actual implementation depth in code before assuming parity with supplier and workflow features.

## Repository Shape

```text
supplex/
├── apps/
│   ├── web/       React Router v7 (Framework mode) frontend
│   └── api/       ElysiaJS backend
├── packages/
│   ├── db/        Drizzle schema and migrations
│   ├── types/     Shared TypeScript types
│   ├── ui/        Minimal shared UI surface
│   └── config/    Shared tooling config
└── docs/
```

## Runtime Architecture

### Web app

- React Router v7 in Framework mode handles route rendering, loaders, actions, and SSR
- file-system routing lives under `apps/web/app/routes/` and is wired in `apps/web/app/routes.ts` via `@react-router/fs-routes`
- user-facing pages use server-side loading and URL-driven navigation patterns
- some user-facing data access uses Supabase client capabilities where that aligns with current app behavior

### API app

- ElysiaJS on Bun handles domain logic, workflow execution, documents, admin routes, and cross-cutting operations
- Drizzle is used for type-safe queries and schema-backed backend behavior
- background work is handled through Redis/BullMQ where configured
- the API surface is organized around auth, users, suppliers, documents, workflows, templates, forms, and admin operations

### Shared packages

- `packages/db` is the schema source of truth
- `packages/types` keeps shared contracts aligned across apps
- `packages/ui` currently provides a lightweight shared surface, not the full UI layer

## Core Domain Shape

The main runtime entities contributors should understand are:

- `tenant` and `user` for identity, access, and isolation
- `supplier`, `contact`, and `document` for supplier master data and document handling
- `process_instance` and `step_instance` for workflow execution
- `form_template`, `form_submission`, and related form entities for dynamic data capture
- `task_instance` for runtime work assignment
- supporting audit, notification, and template entities around those flows

The source of truth for all of these is `packages/db/src/schema/`, not secondary documentation.

## Key Architectural Characteristics

- Multi-tenant design with tenant isolation as a hard requirement
- React Router (Framework mode) + Elysia split between user experience and backend business logic
- Shared schema and types through the monorepo
- Mobile-first, data-dense UI informed by Midday and shadcn/ui patterns
- Auditability, RBAC, and document traceability as core product constraints

## API And Data-Flow Highlights

- The system uses a practical backend-for-frontend shape: React Router (Framework mode) handles page delivery and user-facing route composition, while the API owns cross-cutting business logic and deeper workflow behavior.
- Tenant isolation is preserved through a mix of database-level and application-level controls, depending on the execution path.
- Workflow execution is centered on runtime process and step instances rather than legacy qualification-only tables.
- Shared types and schema-backed contracts are intended to reduce drift between web and API behavior.

## Infrastructure Shape

Supplex currently deploys the web app to Vercel, the API to Fly.io, and uses Supabase for database, auth, and storage, with Redis/BullMQ and Sentry where enabled.

Use [`docs/deployment.md`](./deployment.md) for operational guidance and [`docs/adr/0005-deployment-topology.md`](./adr/0005-deployment-topology.md) for the architectural rationale behind that topology.

## Cross-Cutting Constraints

- Security expectations: tenant isolation, RBAC consistency, safe document handling, and explicit environment gating for development-only features
- Performance expectations: SSR-first route loading, efficient database access, and selective use of caching/background jobs
- Contributor expectations: standards and patterns live in `docs/standards.md`, while operational setup lives in the root and app-level READMEs

## Delivery And Testing

- Unit and integration testing are split across the web app, API app, and schema package
- Browser-level critical journey coverage belongs in `tests/e2e/`
- Operational setup and local workflow details belong in the root and app-level READMEs, not in secondary architecture notes

## Source Of Truth By Concern

- Docs hub: `docs/README.md`
- Architecture overview: `docs/architecture.md`
- Decision history: `docs/adr/`
- Contributor rules and patterns: `docs/standards.md`
- Database schema: `packages/db/src/schema/`
- Product-critical browser journeys: `tests/e2e/`
- UI behavior and interaction guidance: `docs/frontend.md`

## ADR Index

ADRs belong under `docs/adr/`.

Current accepted ADRs:

- [`0001-monorepo-and-application-boundaries.md`](./adr/0001-monorepo-and-application-boundaries.md)
- [`0002-remix-plus-elysia-application-split.md`](./adr/0002-remix-plus-elysia-application-split.md) (framework portion superseded by ADR 0007)
- [`0003-tenant-isolation-and-data-access-strategy.md`](./adr/0003-tenant-isolation-and-data-access-strategy.md)
- [`0004-workflow-engine-runtime-model.md`](./adr/0004-workflow-engine-runtime-model.md)
- [`0005-deployment-topology.md`](./adr/0005-deployment-topology.md)
- [`0006-documentation-architecture.md`](./adr/0006-documentation-architecture.md)
- [`0007-react-router-v7.md`](./adr/0007-react-router-v7.md)

Supporting ADR docs:

- [`docs/adr/TEMPLATE.md`](./adr/TEMPLATE.md)
- [`docs/adr-guidelines.md`](./adr-guidelines.md)

As new ADRs are accepted, they should be linked from this section.

## Contributor Workflow

When contributing:

1. Read this file for the current system shape.
2. Use `docs/standards.md` for contributor rules and implementation patterns.
3. Use `README.md`, `apps/api/README.md`, and `apps/web/README.md` for setup and operational guidance.
4. Use `packages/db/src/schema/` and live code in `apps/` as the final authority when documentation and implementation differ.
