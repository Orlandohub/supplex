# ADR 0001: Monorepo And Application Boundaries

## Status

Accepted — 2026-04-13

## Context

Supplex is developed as a fullstack product with a web application, an API application, and shared schema/types/config concerns. The team needs a structure that supports cross-stack changes, shared contracts, and contributor clarity without the coordination overhead of multiple repositories.

Alternatives existed:

- separate repositories for frontend and backend
- a single app without clear package boundaries
- a larger monorepo toolchain such as Turborepo or Nx

## Decision

Supplex uses a pnpm workspace monorepo with these primary boundaries:

- `apps/web` for the React Router v7 (Framework mode) frontend (originally Remix; see [ADR 0007](./0007-react-router-v7.md))
- `apps/api` for the ElysiaJS backend
- `packages/db` for Drizzle schema and migrations
- `packages/types` for shared types
- `packages/ui` for a lightweight shared UI surface
- `packages/config` for shared tooling configuration

Shared contracts and schema-backed logic should live in packages when they are consumed by more than one app.

## Consequences

### Positive

- Cross-stack changes can be made atomically
- Shared schema and types reduce contract drift
- Contributor onboarding is simpler because the codebase is in one place
- Shared tooling can be standardized centrally

### Negative

- The repository can accumulate documentation and process clutter if boundaries are not maintained
- Build and test commands can become slower as the repo grows

### Neutral

- The monorepo is intentionally lightweight and relies on pnpm workspaces rather than a heavier orchestration layer

## Alternatives Considered

### Polyrepo

Clear repo separation, but higher coordination overhead and more chances for API/type drift.

### Single unstructured app

Simpler at first, but weaker long-term separation between frontend, backend, and shared concerns.

### Monorepo with heavier orchestration

Could improve caching and task orchestration, but was not justified for the current scale of the project.
