# Deployment

This document captures the durable deployment and release guidance for Supplex.

Use `docs/README.md` for the full documentation map. Keep this file focused on deployment and release behavior, not general app setup.

## Deployment Topology

- Web app: Vercel
- API app: Fly.io
- Database, auth, and storage: Supabase
- Cache and queue: Redis + BullMQ where enabled
- Monitoring: Sentry and Vercel Analytics

## Environment And Secrets

### Local environment files

- `apps/web/.env.example` -> `apps/web/.env`
- `apps/api/.env.example` -> `apps/api/.env`

For application-specific environment behavior and variable semantics, use:

- `apps/web/README.md`
- `apps/api/README.md`

### Hosted secrets

Keep deployment secrets in the platform that owns them:

- GitHub Actions secrets for CI/CD tokens
- Vercel environment variables for the web app
- Fly.io secrets for the API
- Supabase-managed credentials for database/auth/storage access

Common deployment secrets include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- `SENTRY_DSN`
- `FLY_API_TOKEN`
- `VERCEL_TOKEN`

## Release Flow

### CI expectations

- changes should pass linting, type-checking, and tests before release
- browser-critical paths should be covered by `tests/e2e/`
- database schema changes should be reviewed as code, not only as generated SQL

### Deployment responsibilities

- Vercel deploys the web app
- Fly.io deploys the API
- database migrations must run safely as part of backend release flow

### Health verification

Use the API health endpoint after backend deploys:

```bash
curl https://supplex-api.fly.dev/api/health
```

Local health check:

```bash
curl http://localhost:3001/api/health
```

## Migrations

- Treat `packages/db/src/schema/` as the schema source of truth
- Generate and review migrations before release
- Test migrations locally before they are allowed into a production deployment path
- Avoid assuming rollback is trivial when schema/data changes are destructive

## Rollback Principles

- Web rollback should restore the last known good Vercel deployment
- API rollback should restore the last known good Fly.io release
- Database rollback should prefer safe forward fixes or carefully planned recovery over impulsive destructive rollback

Rollback is justified when:

- the application does not start
- auth or critical business flows break
- tenant safety is at risk
- data integrity is threatened

## Staging And Preview

- Preview or staging environments should use separate non-production configuration
- If staging exists, it should mirror production topology closely enough to test deploy and migration behavior
- Preview environments are useful, but they do not replace production-safe migration review

## Contributor Guidance

When changing deployment-related behavior:

1. update this file if the durable release model changes
2. update app README files if environment expectations change
3. update ADRs if the deployment topology itself changes
