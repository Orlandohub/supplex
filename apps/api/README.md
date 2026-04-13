# Supplex API

Backend API for Supplex, built with Bun and ElysiaJS.

Use this README for API-specific local setup, scripts, and environment expectations. Use the shared docs for architecture, standards, deployment, and troubleshooting:

- [`../../docs/README.md`](../../docs/README.md)
- [`../../docs/architecture.md`](../../docs/architecture.md)
- [`../../docs/standards.md`](../../docs/standards.md)
- [`../../docs/deployment.md`](../../docs/deployment.md)
- [`../../docs/troubleshooting.md`](../../docs/troubleshooting.md)

## Quick Start

### Prerequisites

- Bun 1.1+
- pnpm 8.15+
- Supabase-backed PostgreSQL configuration
- Workspace dependencies installed from the repo root

### Local Setup

From the repo root:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @supplex/api dev
```

From `apps/api` directly:

```bash
cp .env.example .env
bun run dev
```

Default local URL: `http://localhost:3001`

Health check: `http://localhost:3001/api/health`

## Available Scripts

Run from `apps/api`:

- `bun run dev` - Start the development server
- `bun run build` - Build the production bundle into `dist/`
- `bun run start` - Start the built server in production mode
- `bun run test` - Run API tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage
- `bun run lint` - Lint source files
- `bun run lint:fix` - Lint and auto-fix source files
- `bun run type-check` - Run TypeScript checks
- `bun run clean` - Remove build artifacts and `node_modules`

## Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env`.

Treat `apps/api/.env.example` as the canonical variable list.

Keep these behavior notes in mind:

- `CORS_ORIGIN` controls which frontend origins can call the API
- `JWT_SECRET` is optional in some flows, but if set it must be at least 32 characters
- `REDIS_URL` enables queue and Redis-backed behavior where configured
- `SENTRY_DSN` enables backend error reporting when configured

Use `../../docs/deployment.md` for hosted-secret ownership and release flow. Keep exact variable names in `.env.example`, not duplicated here.

## Route Surface

The main route modules live in `apps/api/src/routes/`.

Current top-level route groups include:

- `/api/auth/*`
- `/api/users/*`
- `/api/suppliers/*`
- `/api/documents/*`
- `/api/workflows/*`
- `/api/form-templates/*`
- `/api/form-submissions/*`
- `/api/document-templates/*`
- `/api/workflow-templates/*`
- `/api/admin/*`
- `/api/unsubscribe`
- `/api/health`

For the current implementation surface, prefer the live route files over prose summaries.

## Testing

Tests live alongside the route and library code in `src/`.

Common checks:

```bash
bun run test
bun run lint
bun run type-check
```

## Related Files

- `apps/api/src/index.ts` - API entry point
- `apps/api/src/config.ts` - Environment loading and validation
- `apps/api/src/routes/` - Route modules and route tests
- `apps/api/.env.example` - Local environment template

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [ElysiaJS Documentation](https://elysiajs.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Supabase Documentation](https://supabase.com/docs)
