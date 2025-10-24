# Staging Environment Setup

This guide covers setting up a staging environment for testing changes before production deployment.

## Overview

Staging environment provides:
- Production-like environment for testing
- Separate database to avoid affecting production data
- Preview deployments for pull requests
- Safe testing of migrations and configuration changes

## Architecture

```
┌─────────────────────────────────────────────┐
│               Development                    │
│  Local: localhost:3001 (API)                │
│  Local: localhost:5173 (Web)                │
└─────────────────────────────────────────────┘
                    ↓ Push to PR
┌─────────────────────────────────────────────┐
│                Staging                       │
│  API: supplex-api-staging.fly.dev           │
│  Web: supplex-staging.vercel.app            │
│  DB: Supabase staging project               │
└─────────────────────────────────────────────┘
                    ↓ Merge to main
┌─────────────────────────────────────────────┐
│               Production                     │
│  API: supplex-api.fly.dev                   │
│  Web: supplex.vercel.app                    │
│  DB: Supabase production project            │
└─────────────────────────────────────────────┘
```

## Prerequisites

- Production environment configured
- Supabase account
- Fly.io account
- Vercel account

## Setup Steps

### 1. Create Staging Database (Supabase)

#### Option A: Separate Supabase Project (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Configure:
   - **Name:** Supplex Staging
   - **Database Password:** Generate strong password
   - **Region:** Europe West (Ireland) - Same as production
   - **Pricing Plan:** Free (for staging)

4. Wait for project creation (~2 minutes)

5. Get connection details:
   - **Database URL:** Settings → Database → Connection string
   - **Supabase URL:** Settings → API → Project URL
   - **Anon Key:** Settings → API → Project API keys → anon public
   - **Service Role Key:** Settings → API → Project API keys → service_role

#### Option B: Separate Schema in Same Database (Not Recommended)

Less isolation, but possible for cost savings. Not recommended for production systems.

### 2. Create Staging API on Fly.io

```bash
# Navigate to API directory
cd apps/api

# Create staging app
flyctl apps create supplex-api-staging

# Copy fly.toml to fly.staging.toml
cp fly.toml fly.staging.toml

# Edit fly.staging.toml
# Change: app = "supplex-api-staging"

# Set staging secrets
flyctl secrets set \
  DATABASE_URL="postgresql://postgres:[STAGING_PASSWORD]@[STAGING_HOST]:5432/postgres" \
  SUPABASE_URL="https://[STAGING_PROJECT].supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="[STAGING_SERVICE_ROLE_KEY]" \
  JWT_SECRET="[DIFFERENT_JWT_SECRET_FOR_STAGING]" \
  SENTRY_DSN="https://yyy@yyy.ingest.sentry.io/yyy" \
  NODE_ENV="staging" \
  -a supplex-api-staging

# Deploy staging
flyctl deploy --config fly.staging.toml -a supplex-api-staging

# Verify deployment
flyctl status -a supplex-api-staging
curl https://supplex-api-staging.fly.dev/api/health
```

### 3. Create Staging Frontend on Vercel

#### Option A: Separate Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Import same GitHub repository
4. Configure:
   - **Project Name:** supplex-staging
   - **Framework Preset:** Remix
   - **Build Command:** `pnpm --filter @supplex/web build`
   - **Output Directory:** `apps/web/build/client`
   - **Install Command:** `pnpm install --frozen-lockfile`

5. Set Environment Variables:
   ```
   SUPABASE_URL=[STAGING_SUPABASE_URL]
   SUPABASE_ANON_KEY=[STAGING_ANON_KEY]
   API_URL=https://supplex-api-staging.fly.dev
   SENTRY_DSN=[STAGING_SENTRY_DSN]
   NODE_ENV=staging
   ```

6. **Important:** Configure Git Branch for staging:
   - Settings → Git → Production Branch → Change to `staging`
   - Or use `main` branch but mark as Preview environment

#### Option B: Use Vercel Preview Deployments

Simpler: Use PR preview deployments as staging.

1. Configure environment variables for Preview environment
2. Every PR automatically gets a preview deployment
3. No separate project needed

**Recommended for small teams.**

### 4. Configure GitHub Actions for Staging Deployment

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - staging
  workflow_dispatch:

jobs:
  deploy-api-staging:
    name: Deploy API to Staging
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Fly.io CLI
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io Staging
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          cd apps/api
          flyctl deploy --config fly.staging.toml -a supplex-api-staging

      - name: Verify deployment
        run: |
          sleep 10
          curl -f https://supplex-api-staging.fly.dev/api/health
```

### 5. Run Database Migrations on Staging

```bash
# Set DATABASE_URL to staging
export DATABASE_URL="postgresql://..."

# Run migrations
cd packages/db
pnpm db:migrate

# Or SSH into Fly.io staging machine
flyctl ssh console -a supplex-api-staging
cd /app
bun run db:migrate
```

### 6. Seed Staging Database with Test Data

```bash
# Set DATABASE_URL to staging
export DATABASE_URL="postgresql://..."

# Run seed script
cd packages/db
pnpm db:seed

# This creates:
# - Test tenants
# - Test users
# - Sample suppliers
# - Sample documents
```

## Environment Variables Summary

### Staging API (Fly.io)

```bash
DATABASE_URL=postgresql://postgres:[STAGING_PASSWORD]@[STAGING_HOST]:5432/postgres
SUPABASE_URL=https://[STAGING_PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[STAGING_SERVICE_ROLE_KEY]
JWT_SECRET=[DIFFERENT_JWT_SECRET_FOR_STAGING]
SENTRY_DSN=https://yyy@yyy.ingest.sentry.io/yyy
NODE_ENV=staging
PORT=8080
```

### Staging Frontend (Vercel)

```bash
SUPABASE_URL=https://[STAGING_PROJECT].supabase.co
SUPABASE_ANON_KEY=[STAGING_ANON_KEY]
API_URL=https://supplex-api-staging.fly.dev
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NODE_ENV=staging
```

## Git Workflow with Staging

### Option 1: Staging Branch

```bash
# Feature branch
git checkout -b feature/new-feature

# Push to feature branch (creates PR preview)
git push origin feature/new-feature

# Create PR to staging branch
# Title: "Test: New Feature"
# Base: staging
# Head: feature/new-feature

# Merge to staging (triggers staging deployment)
git checkout staging
git merge feature/new-feature
git push origin staging

# Test in staging environment

# If tests pass, create PR to main
# Base: main
# Head: staging

# Merge to main (triggers production deployment)
```

### Option 2: Direct to Main with PR Previews (Simpler)

```bash
# Feature branch
git checkout -b feature/new-feature

# Push to feature branch (creates PR preview)
git push origin feature/new-feature

# Create PR to main
# Vercel creates preview deployment automatically

# Review preview deployment

# If tests pass, merge to main
# Triggers production deployment
```

**Recommended: Option 2** for smaller teams.

## Testing in Staging

### Pre-Production Checklist

Before promoting staging to production:

- [ ] All CI tests pass
- [ ] Health check returns 200 OK
- [ ] Database migrations successful
- [ ] Critical user flows work:
  - [ ] User login/logout
  - [ ] Create supplier
  - [ ] Upload document
  - [ ] View supplier details
- [ ] No console errors in browser
- [ ] No Sentry errors in staging
- [ ] Performance acceptable (< 1s page loads)
- [ ] Mobile responsiveness verified
- [ ] Security headers present

### Staging Test Credentials

Create test users in staging:

```bash
# SSH into staging API
flyctl ssh console -a supplex-api-staging

# Create test users
cd /app/packages/db
bun run create-auth-users.ts

# Test credentials:
# Admin: admin@staging.supplex.com / [password]
# Procurement: procurement@staging.supplex.com / [password]
# Quality: quality@staging.supplex.com / [password]
```

### Load Testing (Optional)

```bash
# Install k6
brew install k6  # macOS
# or: curl https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz | tar -xz

# Run load test against staging
k6 run --vus 10 --duration 30s load-test.js

# load-test.js
import http from 'k6/http';
export default function () {
  http.get('https://supplex-api-staging.fly.dev/api/health');
}
```

## Monitoring Staging

### Sentry Staging Environment

Sentry automatically separates staging and production errors using environment tags.

View staging errors:
1. Go to Sentry Dashboard
2. Filter by Environment: `staging`
3. Review errors before they hit production

### Fly.io Metrics

```bash
# View staging metrics
flyctl dashboard metrics -a supplex-api-staging

# View staging logs
flyctl logs -a supplex-api-staging
```

### Vercel Staging Analytics

View staging deployment analytics in Vercel Dashboard → Project → Analytics → Filter by deployment.

## Cost Optimization

### Staging Environment Costs

- **Supabase Staging:** Free tier (500MB database, 1GB file storage)
- **Fly.io Staging:** ~$5/month (shared CPU, 512MB RAM)
- **Vercel Staging:** Free (included in Pro plan, or use Preview deployments)
- **Total:** ~$5/month (or $0 if using Preview deployments only)

### Cost Reduction Tips

1. **Use Preview Deployments:** Instead of separate staging environment
2. **Auto-stop staging machines:** Configure in `fly.staging.toml`:
   ```toml
   [[services]]
     auto_stop_machines = true
     auto_start_machines = true
   ```
3. **Reduce staging resources:** Use smaller VM size for staging
4. **Limit staging data:** Keep database small, delete test data regularly

## Troubleshooting

### Staging and Production Data Mismatch

**Issue:** Staging using production database accidentally

**Fix:**
```bash
# Verify DATABASE_URL
flyctl secrets list -a supplex-api-staging

# Should point to staging Supabase project
# If wrong, update:
flyctl secrets set DATABASE_URL="[STAGING_URL]" -a supplex-api-staging
```

### Staging Deployment Fails, Production Works

**Issue:** Environment-specific configuration issue

**Fix:**
1. Compare environment variables:
   ```bash
   flyctl secrets list -a supplex-api-staging
   flyctl secrets list -a supplex-api
   ```
2. Check logs for errors:
   ```bash
   flyctl logs -a supplex-api-staging
   ```
3. Test locally with staging environment variables

### Staging Database Out of Sync with Production Schema

**Issue:** Migrations not run on staging

**Fix:**
```bash
# SSH into staging
flyctl ssh console -a supplex-api-staging

# Run migrations
cd /app
bun run db:migrate

# Verify schema
psql $DATABASE_URL -c "\d suppliers"
```

## Best Practices

1. **Keep staging in sync:** Deploy to staging before production
2. **Use realistic test data:** Mirror production data structure
3. **Test migrations:** Always test migrations on staging first
4. **Monitor staging:** Set up Sentry alerts for staging errors
5. **Limit access:** Don't expose staging to public internet (optional: use VPN)
6. **Regular cleanup:** Delete old test data to keep database small
7. **Document staging:** Keep staging credentials in password manager

## Next Steps

- [Rollback Procedures](./rollback-procedure.md)
- [Vercel Deployment Setup](./vercel-deployment-setup.md)
- [Fly.io Deployment Setup](./flyio-deployment-setup.md)

