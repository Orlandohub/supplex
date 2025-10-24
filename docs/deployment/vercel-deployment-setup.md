# Vercel Deployment Setup

This guide covers setting up automated deployments for the Supplex frontend (Remix) to Vercel.

## Prerequisites

- GitHub repository with Supplex code
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Supabase project configured
- Backend API deployed (see [Fly.io Deployment Setup](./flyio-deployment-setup.md))

## Quick Start

### 1. Install Vercel CLI (Optional)

```bash
# Install globally
pnpm add -g vercel

# Or add as dev dependency
pnpm add -D vercel
```

### 2. Link Project to Vercel (via Dashboard)

#### Option A: Import via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Project**
3. Select your GitHub repository
4. Configure project settings:
   - **Framework Preset:** Remix
   - **Root Directory:** `./` (monorepo root)
   - **Build Command:** `pnpm --filter @supplex/web build`
   - **Output Directory:** `apps/web/build/client`
   - **Install Command:** `pnpm install --frozen-lockfile`

#### Option B: Link via CLI

```bash
# Run from project root
vercel link

# Follow prompts:
# Set up and deploy "~/supplex"? [Y/n] Y
# Which scope? Select your account/team
# Link to existing project? [Y/n] n
# What's your project's name? supplex
# In which directory is your code located? ./
```

### 3. Configure Environment Variables

#### Via Vercel Dashboard

1. Go to Project → Settings → Environment Variables
2. Add the following variables for each environment:

**Production Environment:**
- `SUPABASE_URL`: Your production Supabase URL
- `SUPABASE_ANON_KEY`: Your production Supabase anon key
- `API_URL`: Your production API URL (e.g., `https://supplex-api.fly.dev`)
- `SENTRY_DSN`: (Optional) Your Sentry DSN for frontend error tracking
- `NODE_ENV`: `production`

**Preview Environment:**
- Same variables as Production, but pointing to staging resources
- `API_URL`: Staging API URL (e.g., `https://supplex-api-staging.fly.dev`)

**Development Environment:**
- Same variables as local development
- `API_URL`: `http://localhost:3001`

#### Via CLI

```bash
# Set production secrets
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add API_URL production
vercel env add SENTRY_DSN production

# Set preview secrets
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_ANON_KEY preview
vercel env add API_URL preview

# Set development secrets
vercel env add SUPABASE_URL development
vercel env add SUPABASE_ANON_KEY development
vercel env add API_URL development
```

**Note:** The `@` prefix in `vercel.json` (e.g., `@supabase-url`) references these environment variables.

### 4. Configure Automatic Deployments

#### Enable GitHub Integration

1. Go to Project → Settings → Git
2. Verify GitHub repository is connected
3. Configure deployment branches:
   - **Production Branch:** `main`
   - **Preview Branches:** All branches (automatic preview deployments)

#### Configure Build Settings

1. Go to Project → Settings → Build & Development Settings
2. Verify settings match `vercel.json`:
   - **Framework Preset:** Remix
   - **Build Command:** `pnpm --filter @supplex/web build`
   - **Output Directory:** `apps/web/build/client`
   - **Install Command:** `pnpm install --frozen-lockfile`

### 5. Deploy to Production

#### Automatic Deployment (Recommended)

Push to `main` branch:
```bash
git add .
git commit -m "Configure Vercel deployment"
git push origin main
```

Vercel will automatically:
1. Detect the push to `main`
2. Run the build command
3. Deploy to production
4. Assign production domain

#### Manual Deployment via CLI

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

### 6. Verify Deployment

1. Check deployment status in Vercel dashboard
2. Visit production URL (e.g., `https://supplex.vercel.app`)
3. Test health check: `https://your-domain.vercel.app/health`
4. Verify environment variables are loaded correctly

## Configuration Files

### vercel.json

The project includes a `vercel.json` configuration file in the root directory:

```json
{
  "version": 2,
  "buildCommand": "pnpm --filter @supplex/web build",
  "devCommand": "pnpm --filter @supplex/web dev",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "remix",
  "outputDirectory": "apps/web/build/client",
  "regions": ["fra1"],
  "env": {
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key",
    "API_URL": "@api-url"
  }
}
```

**Key Settings:**
- `regions: ["fra1"]` - Deploy to Frankfurt (EU) for GDPR compliance
- `env` - Environment variables injected during build
- `@variable-name` - References Vercel environment variables

## Preview Deployments

### How Preview Deployments Work

1. Create a pull request
2. Vercel automatically deploys a preview
3. Preview URL is unique per PR: `https://supplex-git-<branch>-<team>.vercel.app`
4. Preview environment uses Preview environment variables
5. Preview deployments are updated on every push to PR branch

### Accessing Preview Deployments

- **From GitHub PR:** Check Vercel bot comment for preview URL
- **From Vercel Dashboard:** Deployments → Select deployment → Visit URL
- **From CLI:** `vercel inspect <deployment-url>`

## Custom Domain Setup (Optional)

### 1. Add Custom Domain

1. Go to Project → Settings → Domains
2. Click **Add Domain**
3. Enter your domain (e.g., `app.supplex.com`)
4. Follow DNS configuration instructions

### 2. Configure DNS

Add DNS records provided by Vercel:

**For subdomain (app.supplex.com):**
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

**For root domain (supplex.com):**
```
Type: A
Name: @
Value: 76.76.21.21
```

### 3. Enable HTTPS

Vercel automatically provisions SSL certificates via Let's Encrypt.

### 4. Update Environment Variables

Update `API_URL` if needed to match custom domain:
```bash
API_URL=https://api.supplex.com
```

## Troubleshooting

### Build Fails: "Command not found: pnpm"

**Cause:** pnpm not installed in build environment

**Fix:**
1. Verify `installCommand` in `vercel.json` is set to `pnpm install --frozen-lockfile`
2. Or use `.npmrc` to specify package manager:
   ```
   # .npmrc
   engine-strict=true
   ```

### Build Fails: "Module not found"

**Cause:** Monorepo dependencies not resolved correctly

**Fix:**
1. Ensure `pnpm-workspace.yaml` exists in root
2. Verify build command filters correctly: `pnpm --filter @supplex/web build`
3. Check `package.json` dependencies reference workspace packages correctly

### Environment Variables Not Available

**Cause:** Variables not set in Vercel dashboard or wrong environment

**Fix:**
1. Verify variables are set for correct environment (Production/Preview/Development)
2. Check `vercel.json` references variables with `@` prefix
3. Redeploy after adding variables: `vercel --prod --force`

### Preview Deployment Uses Production Data

**Cause:** Preview environment variables point to production resources

**Fix:**
1. Set separate Preview environment variables
2. Point Preview `API_URL` to staging API
3. Use staging Supabase project for Preview environment

### Deployment Succeeds but Site is Broken

**Cause:** Build succeeded but runtime errors

**Fix:**
1. Check Vercel logs: Project → Deployments → Select deployment → View Logs
2. Test health endpoint: `https://your-domain.vercel.app/health`
3. Verify environment variables are exposed correctly (check Network tab in browser)
4. Check Sentry for runtime errors

## GitHub Actions Integration

### Deployment Workflow

The project includes a GitHub Actions workflow that runs on deployment:

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]
```

This ensures:
1. CI tests pass before deployment
2. Coverage is maintained
3. Type checking passes
4. Linting passes

### Blocking Deployments on Failed CI

Vercel automatically respects GitHub branch protection rules. If CI fails, the deployment is queued until CI passes.

## Rollback Procedure

### Via Vercel Dashboard

1. Go to Project → Deployments
2. Find the previous successful deployment
3. Click **⋯** menu → **Promote to Production**
4. Confirm rollback
5. Verify site is working: `https://your-domain.vercel.app/health`

### Via CLI

```bash
# List recent deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>

# Or alias a previous deployment to production
vercel alias <deployment-url> <production-domain>
```

**Rollback Time:** Typically < 30 seconds

## Monitoring & Alerts

### Vercel Analytics

Enable Vercel Analytics for performance monitoring:

1. Go to Project → Analytics
2. Enable **Web Analytics**
3. View Core Web Vitals, page load times, etc.

### Integration with Sentry

Vercel deployments include commit SHA in environment:
- `VERCEL_GIT_COMMIT_SHA` - Used for Sentry release tracking
- Configure in `apps/web/app/entry.client.tsx`

### Health Check Monitoring

Set up external monitoring (e.g., UptimeRobot):
- Monitor: `https://your-domain.vercel.app/health`
- Interval: 5 minutes
- Alert on: Status code !== 200

## Best Practices

1. **Always use Preview Deployments:** Test changes before merging to `main`
2. **Protect main branch:** Enable branch protection with required status checks
3. **Monitor deployments:** Check Vercel dashboard for failed deployments
4. **Test after deployment:** Verify health endpoint and critical user flows
5. **Use separate Supabase projects:** Don't point staging to production database
6. **Review environment variables:** Ensure no production secrets leak to Preview
7. **Enable Vercel Analytics:** Track performance and user behavior

## Next Steps

- [Fly.io Deployment Setup](./flyio-deployment-setup.md) (Backend API)
- [Database Migration Automation](./database-migration-automation.md)
- [Rollback Procedures](./rollback-procedure.md)
- [Environment Variables Configuration](./environment-variables.md)

