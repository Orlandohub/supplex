# Fly.io Deployment Setup

This guide covers setting up automated deployments for the Supplex backend (ElysiaJS API) to Fly.io.

## Prerequisites

- Fly.io account (sign up at [fly.io](https://fly.io))
- Fly.io CLI installed
- Supabase database configured
- GitHub repository with Supplex code

## Quick Start

### 1. Install Fly.io CLI

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Verify installation:**
```bash
flyctl version
```

### 2. Authenticate with Fly.io

```bash
flyctl auth login
```

This opens a browser to authenticate with your Fly.io account.

### 3. Create Fly.io Application

```bash
# Navigate to API directory
cd apps/api

# Launch app creation wizard
flyctl launch

# Follow prompts:
# App Name: supplex-api
# Region: fra (Frankfurt, Germany - EU compliance)
# PostgreSQL: No (using Supabase)
# Redis: No (Phase 2)
# Deploy now: No (configure secrets first)
```

This creates `fly.toml` configuration file (already included in repo).

### 4. Configure Secrets

Set required environment variables as Fly.io secrets:

```bash
# Database connection string (from Supabase)
flyctl secrets set DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" -a supplex-api

# Supabase configuration
flyctl secrets set SUPABASE_URL="https://[PROJECT_ID].supabase.co" -a supplex-api
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..." -a supplex-api

# JWT secret (generate with: openssl rand -base64 32)
flyctl secrets set JWT_SECRET="your_32_character_secret_here" -a supplex-api

# Sentry error tracking (optional)
flyctl secrets set SENTRY_DSN="https://...@ingest.sentry.io/..." -a supplex-api
```

**List secrets:**
```bash
flyctl secrets list -a supplex-api
```

**Important:** Secrets are encrypted and not visible after setting. Store them securely (e.g., password manager).

### 5. Deploy Manually (First Time)

```bash
# From apps/api directory
flyctl deploy --remote-only

# Or specify app name
flyctl deploy --app supplex-api --remote-only
```

**What happens during deployment:**
1. Uploads application code to Fly.io
2. Builds application using Bun buildpack
3. Runs database migrations (`release_command`)
4. Deploys new version
5. Runs health checks
6. Routes traffic to new version if healthy

### 6. Verify Deployment

```bash
# Check deployment status
flyctl status -a supplex-api

# View logs
flyctl logs -a supplex-api

# Test health endpoint
curl https://supplex-api.fly.dev/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-10-24T...",
#   "version": "1.0.0",
#   "service": "api",
#   "environment": "production",
#   "checks": {
#     "database": "connected"
#   }
# }
```

## GitHub Actions Automated Deployment

### 1. Get Fly.io API Token

```bash
flyctl auth token
```

Copy the token output.

### 2. Add Token to GitHub Secrets

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click **New repository secret**
3. Name: `FLY_API_TOKEN`
4. Value: Paste the token from step 1
5. Click **Add secret**

### 3. Enable Automated Deployments

The repository includes `.github/workflows/deploy-backend.yml` which automatically deploys on push to `main` branch.

**Workflow triggers:**
- Push to `main` branch
- Changes in `apps/api/`, `packages/db/`, or `packages/types/`
- Manual trigger via GitHub Actions UI

**Workflow steps:**
1. Checkout code
2. Setup Fly.io CLI
3. Deploy to Fly.io
4. Verify deployment with health check
5. Notify on failure

### 4. Test Automated Deployment

```bash
# Make a change to API
cd apps/api
echo "# Test deployment" >> README.md

# Commit and push
git add README.md
git commit -m "test: Trigger Fly.io deployment"
git push origin main

# Watch deployment in GitHub Actions
# https://github.com/<owner>/<repo>/actions
```

## Configuration Files

### fly.toml

The `apps/api/fly.toml` file configures the Fly.io deployment:

```toml
app = "supplex-api"
primary_region = "fra"  # Frankfurt (EU)

[build]
  builder = "paketobuildpacks/builder:base"
  buildpacks = ["oven-sh/bun"]

[deploy]
  release_command = "bun run db:migrate"
  strategy = "immediate"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.http_checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/api/health"
```

**Key settings:**
- `primary_region: "fra"` - Frankfurt for GDPR compliance
- `release_command` - Runs migrations before deployment
- `http_checks` - Verifies `/api/health` endpoint

### Dockerfile (Optional)

If you need more control, create a Dockerfile:

```dockerfile
# apps/api/Dockerfile
FROM oven/bun:1.1

WORKDIR /app

# Copy dependency files
COPY package.json bun.lockb ./
COPY ../../packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Build application
RUN bun build src/index.ts --outdir ./dist --target bun --minify

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Run application
CMD ["bun", "run", "dist/index.js"]
```

Then update `fly.toml`:
```toml
[build]
  dockerfile = "Dockerfile"
```

## Preview Deployments (Pull Request Previews)

### Create Staging App

```bash
# Create separate app for staging/preview
flyctl apps create supplex-api-staging

# Copy fly.toml to apps/api/fly.staging.toml
# Change app name to "supplex-api-staging"

# Set secrets for staging
flyctl secrets set DATABASE_URL="..." -a supplex-api-staging
flyctl secrets set SUPABASE_URL="..." -a supplex-api-staging
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="..." -a supplex-api-staging
flyctl secrets set JWT_SECRET="..." -a supplex-api-staging

# Deploy to staging
flyctl deploy --config fly.staging.toml -a supplex-api-staging
```

### Configure PR Preview Workflow

Create `.github/workflows/deploy-pr-preview.yml`:

```yaml
name: Deploy PR Preview

on:
  pull_request:
    branches: [main]
    paths:
      - 'apps/api/**'

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Deploy to staging
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          cd apps/api
          flyctl deploy -a supplex-api-staging
      
      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployment: https://supplex-api-staging.fly.dev'
            })
```

## Scaling & Performance

### Scale Vertically (Increase Resources)

```bash
# View current VM size
flyctl scale show -a supplex-api

# Increase memory
flyctl scale memory 1024 -a supplex-api

# Increase CPUs
flyctl scale vm shared-cpu-2x -a supplex-api
```

### Scale Horizontally (Add Machines)

```bash
# Add more machines (for high availability)
flyctl scale count 2 -a supplex-api

# Scale to specific regions
flyctl regions add ams -a supplex-api  # Add Amsterdam
flyctl scale count 2 -a supplex-api
```

### Auto-scaling

```toml
# fly.toml
[[services]]
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  max_machines_running = 5
```

## Monitoring & Logs

### View Logs

```bash
# Real-time logs
flyctl logs -a supplex-api

# Filter by instance
flyctl logs --instance <instance-id> -a supplex-api

# Download logs
flyctl logs --json > logs.json -a supplex-api
```

### Monitoring Dashboard

```bash
# Open Fly.io dashboard
flyctl dashboard -a supplex-api

# Open monitoring dashboard
flyctl dashboard metrics -a supplex-api
```

### Metrics Endpoint

Fly.io can scrape Prometheus metrics:

```toml
# fly.toml
[metrics]
  port = 9091
  path = "/metrics"
```

## Database Migrations

### Automatic Migrations

Migrations run automatically via `release_command` in `fly.toml`:

```toml
[deploy]
  release_command = "bun run db:migrate"
```

### Manual Migrations

```bash
# SSH into Fly.io machine
flyctl ssh console -a supplex-api

# Run migrations manually
cd /app
bun run db:migrate

# Exit SSH
exit
```

### Migration Rollback

```bash
# If migration fails, Fly.io automatically rolls back deployment
# No action needed - previous version continues running

# To manually rollback migrations, create reverse migration:
cd packages/db
bun run db:generate  # Create new migration that reverses changes

# Then deploy with new migration
flyctl deploy -a supplex-api
```

## Rollback Procedure

### Via Fly.io Dashboard

1. Go to [fly.io/dashboard](https://fly.io/dashboard)
2. Select **supplex-api** app
3. Click **Releases** tab
4. Find previous stable release
5. Click **Rollback to this version**

### Via CLI

```bash
# List recent releases
flyctl releases list -a supplex-api

# Example output:
# VERSION  STATUS     TYPE    REASON        USER          DATE
# v42      successful deploy  pushed        you@email     2025-10-24 10:00
# v41      successful deploy  pushed        you@email     2025-10-23 15:30

# Rollback to specific version
flyctl releases rollback v41 -a supplex-api

# Verify rollback
flyctl status -a supplex-api
curl https://supplex-api.fly.dev/api/health
```

**Rollback time:** ~30-60 seconds

## Troubleshooting

### Deployment Fails: "Error: no such file or directory"

**Cause:** Missing files or incorrect paths in monorepo

**Fix:**
1. Verify `fly.toml` is in `apps/api/` directory
2. Check workspace dependencies are included in build
3. Ensure `packages/` directory is accessible

### Health Check Fails After Deployment

**Cause:** Application not starting or database connection failed

**Fix:**
```bash
# Check logs
flyctl logs -a supplex-api

# Verify secrets are set
flyctl secrets list -a supplex-api

# Test database connection
flyctl ssh console -a supplex-api
curl http://localhost:8080/api/health
```

### "Error: failed to fetch an image or build from source"

**Cause:** Build failed during deployment

**Fix:**
1. Check build logs: `flyctl logs -a supplex-api`
2. Verify Bun buildpack is specified correctly
3. Test build locally: `bun build src/index.ts --outdir ./dist --target bun`

### Database Migrations Fail

**Cause:** Migration syntax error or database connection issue

**Fix:**
```bash
# View migration logs
flyctl logs -a supplex-api

# Test migrations locally
cd packages/db
bun run db:migrate

# If migration is broken, create rollback migration
bun run db:generate  # Create reverse migration
```

### App Crashes on Startup

**Cause:** Missing environment variables or runtime errors

**Fix:**
1. Check required env vars: `flyctl secrets list -a supplex-api`
2. View crash logs: `flyctl logs -a supplex-api`
3. SSH into machine: `flyctl ssh console -a supplex-api`
4. Test locally with same environment

## Cost Optimization

### Pricing Overview

- **Free tier:** 3 shared CPU VMs, 256MB RAM each
- **Hobby plan:** $5/month for 160GB transfer
- **Pay-as-you-go:** $0.02/GB transfer, $0.0000022/second for machines

### Cost Reduction Tips

1. **Use auto-stop/start:**
   ```toml
   [[services]]
     auto_stop_machines = true
     auto_start_machines = true
   ```

2. **Right-size VMs:** Start with 512MB, scale up if needed

3. **Use shared CPU:** Shared VMs are cheaper than dedicated

4. **Monitor transfer:** Use Cloudflare for static assets

5. **Limit staging environment:** Auto-stop staging machines

## Security Best Practices

1. **Use secrets for sensitive data:** Never hardcode credentials
2. **Enable HTTPS only:** Set `force_https = true`
3. **Restrict SSH access:** Use `flyctl ssh` instead of exposing SSH port
4. **Regular security updates:** Keep Bun and dependencies updated
5. **Monitor logs:** Set up alerts for suspicious activity
6. **Use EU region:** For GDPR compliance (Frankfurt)

## Next Steps

- [Database Migration Automation](./database-migration-automation.md)
- [Vercel Deployment Setup](./vercel-deployment-setup.md) (Frontend)
- [Rollback Procedures](./rollback-procedure.md)
- [Environment Variables Configuration](./environment-variables.md)

