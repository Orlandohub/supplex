# Supplex Agent Guide

Use this file as the quick-start guide for agents working in this repository.

## Start Here

1. Read `docs/README.md` for the documentation map.
2. Read `docs/architecture.md` for system shape and boundaries.
3. Read `docs/standards.md` for implementation rules.
4. Use app-specific READMEs only for setup and environment behavior:
   - `apps/api/README.md`
   - `apps/web/README.md`

## Source Of Truth

- Prefer live code when docs and implementation differ.
- Treat `packages/db/src/schema/` as the database schema source of truth.
- Treat `apps/api/.env.example` and `apps/web/.env.example` as the canonical environment variable lists.
- Keep durable architecture rationale in `docs/adr/`.
- Keep operational guidance in `docs/deployment.md` and recurring fixes in `docs/troubleshooting.md`.

## Repo Shape

- `apps/web` - React Router v7 (Framework mode) frontend
- `apps/api` - Bun + Elysia API
- `packages/db` - Drizzle schema and migrations
- `packages/types` - shared types
- `packages/ui` - lightweight shared UI surface
- `packages/config` - shared tooling config

## Implementation Guardrails

- Define shared contracts in `packages/types` when used across apps.
- In React Router (Framework mode), load route data in `loader` / `clientLoader`, not `useEffect`.
- Import framework primitives from `react-router` (and server adapters from `@react-router/node`). Do **not** import from `@remix-run/*` or `react-router-dom`.
- Use `shouldRevalidate` intentionally for URL-state changes.
- In Elysia, use TypeBox for route validation.
- Let parent Elysia route aggregators own prefixes; child modules should stay prefix-free.
- Keep tenant filtering and tenant isolation explicit in backend data access.
- Reuse existing UI patterns before introducing bespoke components.

## Frontend Notes

- The web app uses `window.ENV` -> `import.meta.env` -> `process.env` for environment access.
- Do not remove `window.ENV` injection from `apps/web/app/root.tsx`.
- Do not remove `SUPABASE_` or `API_` from `apps/web/vite.config.ts` `envPrefix`.
- Preserve SSR-first, responsive, accessible behavior for user-facing changes.

## Testing And Verification

- Run the smallest relevant checks first.
- Common repo-level checks: `pnpm test`, `pnpm lint`, `pnpm type-check`.
- Browser-level coverage lives in `tests/e2e/` and `apps/web/tests/e2e/`.
- When changing schema or migrations, review generated changes as code and test locally before assuming deploy safety.

## Documentation Rules

- Do not duplicate long setup, env, or architecture content across multiple files.
- Update the nearest source-of-truth doc instead of adding parallel guidance.
- If environment behavior changes, update the relevant app README and `.env.example`.
- If deployment behavior changes, update `docs/deployment.md`.
- If architectural direction changes, update `docs/architecture.md` and the relevant ADRs.
