# Environment Variables Configuration

This document describes all environment variables required for deploying and running Supplex in different environments.

## Quick Setup

### Frontend (apps/web/.env)

Create `apps/web/.env` with:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# API Configuration
API_URL=http://localhost:3001

# Optional: Monitoring
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Environment
NODE_ENV=development
```

### Backend (apps/api/.env)

Create `apps/api/.env` with:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET=your_32_character_secret_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Optional: Monitoring
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

## Detailed Variable Reference

### Frontend Environment Variables

| Variable | Required | Description | Example | Environment |
|----------|----------|-------------|---------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL | `https://abc.supabase.co` | All |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (public) | `eyJ...` | All |
| `API_URL` | Yes | Backend API base URL | `http://localhost:3001` | All |
| `SENTRY_DSN` | No | Sentry DSN for error tracking | `https://xxx@ingest.sentry.io/xxx` | Production |
| `NODE_ENV` | Yes | Current environment | `development`, `staging`, `production` | All |
| `VERCEL_URL` | Auto | Vercel deployment URL | Auto-populated by Vercel | Vercel only |
| `VERCEL_GIT_COMMIT_SHA` | Auto | Git commit SHA for release tracking | Auto-populated by Vercel | Vercel only |

**Important Notes:**
- See `apps/web/ENV-CONFIG.md` for Supabase SSR configuration details
- Frontend uses multi-source pattern: `window.ENV` → `import.meta.env` → `process.env`
- All `SUPABASE_*` and `API_*` variables are exposed to the client via Vite's `envPrefix`

### Backend Environment Variables

| Variable | Required | Description | Example | Environment |
|----------|----------|-------------|---------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | All |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://abc.supabase.co` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (admin) | `eyJ...` | All |
| `JWT_SECRET` | Yes | Secret for JWT token signing (32+ chars) | Generate with `openssl rand -base64 32` | All |
| `PORT` | No | API server port | `3001` (default) | All |
| `NODE_ENV` | Yes | Current environment | `development`, `staging`, `production` | All |
| `SENTRY_DSN` | No | Sentry DSN for error tracking | `https://xxx@ingest.sentry.io/xxx` | Production |
| `SENTRY_ORG` | No | Sentry organization slug | `supplex` | CI/CD only |
| `SENTRY_PROJECT` | No | Sentry project slug | `supplex-api` | CI/CD only |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token for sourcemap upload | `sntrys_...` | CI/CD only |
| `REDIS_URL` | No | Upstash Redis connection string | `redis://...` | Phase 2 |
| `FLY_APP_NAME` | Auto | Fly.io app name | Auto-populated by Fly.io | Fly.io only |
| `FLY_REGION` | Auto | Fly.io region | Auto-populated by Fly.io | Fly.io only |

**Security Notes:**
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - never expose to client
- `JWT_SECRET` must be 32+ characters - rotate quarterly
- Never commit `.env` files to Git

## Environment-Specific Configurations

### Development Environment

**Frontend:**
```bash
API_URL=http://localhost:3001
NODE_ENV=development
```

**Backend:**
```bash
PORT=3001
NODE_ENV=development
# Use staging Supabase or local PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supplex_dev
```

### Staging Environment

**Frontend (Vercel):**
```bash
API_URL=https://supplex-api-staging.fly.dev
NODE_ENV=staging
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Backend (Fly.io):**
```bash
DATABASE_URL=<staging_supabase_connection_string>
SUPABASE_URL=https://xxx-staging.supabase.co
NODE_ENV=staging
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Production Environment

**Frontend (Vercel):**
```bash
API_URL=https://supplex-api.fly.dev
NODE_ENV=production
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Backend (Fly.io):**
```bash
DATABASE_URL=<production_supabase_connection_string>
SUPABASE_URL=https://xxx.supabase.co
NODE_ENV=production
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

## Secrets Management

### GitHub Repository Secrets

For CI/CD workflows, configure these secrets in GitHub:

1. Go to Repository → Settings → Secrets and variables → Actions
2. Add the following secrets:

| Secret Name | Used For | How to Get |
|-------------|----------|------------|
| `CODECOV_TOKEN` | Coverage reporting | Codecov.io dashboard |
| `VERCEL_TOKEN` | Vercel deployments | Vercel dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel deployments | Run `vercel` locally, check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel deployments | Run `vercel` locally, check `.vercel/project.json` |
| `FLY_API_TOKEN` | Fly.io deployments | Run `flyctl auth token` |
| `SENTRY_AUTH_TOKEN` | Sentry sourcemap upload | Sentry dashboard → Settings → Auth Tokens |

### Vercel Environment Variables

Configure in Vercel Dashboard → Project → Settings → Environment Variables:

For each variable:
1. Set value for Production
2. Set value for Preview (can be same as staging)
3. Set value for Development (can be same as local)

Required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `API_URL`
- `SENTRY_DSN` (optional)

### Fly.io Secrets

Set secrets using Fly.io CLI:

```bash
# Set secrets for production app
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  JWT_SECRET="your_32_char_secret" \
  SENTRY_DSN="https://..." \
  -a supplex-api

# Set secrets for staging app
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  SUPABASE_URL="https://xxx-staging.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  JWT_SECRET="your_32_char_secret_staging" \
  SENTRY_DSN="https://..." \
  -a supplex-api-staging
```

**List current secrets:**
```bash
flyctl secrets list -a supplex-api
```

**Remove a secret:**
```bash
flyctl secrets unset SECRET_NAME -a supplex-api
```

## Secrets Rotation Procedure

### JWT_SECRET Rotation (Quarterly)

1. **Generate new secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Update in all environments:**
   - Fly.io: `flyctl secrets set JWT_SECRET="new_secret" -a supplex-api`
   - Local: Update `.env` files
   - Document rotation date

3. **Test authentication:**
   - Verify users can still log in
   - Check that existing sessions remain valid (or force re-login if desired)

4. **Monitor for errors:**
   - Check Sentry for authentication errors
   - Monitor health check endpoints

### Database Password Rotation (Annually)

1. **Supabase Dashboard:**
   - Settings → Database → Reset Database Password
   - Copy new password

2. **Update DATABASE_URL:**
   - Fly.io: `flyctl secrets set DATABASE_URL="new_url" -a supplex-api`
   - Local: Update `.env` files

3. **Restart services:**
   - Fly.io: `flyctl deploy -a supplex-api` (triggers restart)
   - Local: Restart dev server

4. **Verify connectivity:**
   - Check health endpoint: `curl https://supplex-api.fly.dev/api/health`
   - Verify database status shows "connected"

### API Keys Rotation (As Needed)

For Supabase keys, Sentry DSNs, etc.:

1. Generate new key in service dashboard
2. Update environment variables in all environments
3. Test service connectivity
4. Revoke old key after verification

## Health Check Validation

The backend health check endpoint validates critical environment variables:

```bash
# Check local health
curl http://localhost:3001/api/health

# Check production health
curl https://supplex-api.fly.dev/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T...",
  "version": "1.0.0",
  "service": "api",
  "environment": "production",
  "checks": {
    "database": "connected"
  }
}
```

If any service is unavailable, the endpoint returns 503 Service Unavailable.

## Troubleshooting

### Frontend: "API URL not found" Error

**Cause:** `API_URL` not set or not exposed to client

**Fix:**
1. Verify `API_URL` is set in `.env`
2. Check `vite.config.ts` includes `API_` in `envPrefix`
3. Restart dev server: `pnpm --filter @supplex/web dev`

### Backend: "Database connection failed"

**Cause:** `DATABASE_URL` invalid or database unreachable

**Fix:**
1. Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
2. Test connection: `psql $DATABASE_URL`
3. Check Supabase dashboard for database status
4. Verify network connectivity (firewall, VPN)

### Sentry: "Events not appearing"

**Cause:** `SENTRY_DSN` not set or invalid

**Fix:**
1. Verify DSN in Sentry dashboard → Project Settings → Client Keys
2. Check DSN format: `https://xxx@xxx.ingest.sentry.io/xxx`
3. Trigger test error and check Sentry dashboard
4. Verify environment tag is correct

## Next Steps

- [Vercel Deployment Setup](./vercel-deployment-setup.md)
- [Fly.io Deployment Setup](./flyio-deployment-setup.md)
- [GitHub Branch Protection Setup](./github-branch-protection-setup.md)

