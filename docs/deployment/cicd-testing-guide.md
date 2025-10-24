# CI/CD Testing Guide

This guide provides comprehensive test scenarios for validating the CI/CD pipeline configuration.

## Overview

The CI/CD pipeline includes:
- GitHub Actions for continuous integration
- Automated deployments to Vercel (frontend) and Fly.io (backend)
- Coverage reporting to Codecov
- Health check verification
- Database migration automation

## Prerequisites

Before testing:
- [ ] CI workflow file exists: `.github/workflows/ci.yml`
- [ ] Deploy workflow files exist: `.github/workflows/deploy-backend.yml`
- [ ] GitHub branch protection configured for `main`
- [ ] Codecov token added to GitHub Secrets
- [ ] Fly.io API token added to GitHub Secrets
- [ ] Vercel project linked to repository

## Test Suite

### 1. CI Workflow Tests

#### Test 1.1: CI Runs on Pull Request

**Objective:** Verify CI workflow triggers on PR creation

**Steps:**
```bash
# 1. Create test branch
git checkout -b test/ci-validation
git push origin test/ci-validation

# 2. Create pull request
gh pr create \
  --title "Test: CI Workflow Validation" \
  --body "Testing CI pipeline" \
  --base main

# 3. Wait for CI to start
# Navigate to: https://github.com/<owner>/<repo>/actions

# 4. Verify all jobs run:
# - lint
# - type-check
# - test-frontend
# - test-backend
# - ci-status
```

**Expected Result:**
- ✅ CI workflow triggered automatically
- ✅ All jobs appear in Actions tab
- ✅ Jobs run in parallel (check timestamps)

#### Test 1.2: Lint Job Fails on Linting Errors

**Objective:** Verify CI catches linting errors

**Steps:**
```bash
# 1. Introduce lint error
echo "const unused = 'variable';" >> apps/api/src/index.ts

# 2. Commit and push
git add apps/api/src/index.ts
git commit -m "test: Add unused variable to test lint"
git push origin test/ci-validation

# 3. Monitor CI workflow
# Navigate to: https://github.com/<owner>/<repo>/actions
```

**Expected Result:**
- ❌ Lint job fails
- ❌ CI status shows failure
- ❌ PR is blocked from merging

**Cleanup:**
```bash
# Revert lint error
git revert HEAD
git push origin test/ci-validation
```

#### Test 1.3: Type-Check Job Fails on Type Errors

**Objective:** Verify CI catches TypeScript errors

**Steps:**
```bash
# 1. Introduce type error
cat >> apps/api/src/index.ts << 'EOF'
const test: number = "string"; // Type error
EOF

# 2. Commit and push
git add apps/api/src/index.ts
git commit -m "test: Add type error to test type-check"
git push origin test/ci-validation

# 3. Monitor CI workflow
```

**Expected Result:**
- ❌ Type-check job fails
- ❌ Error message shows type mismatch
- ❌ PR is blocked from merging

**Cleanup:**
```bash
git revert HEAD
git push origin test/ci-validation
```

#### Test 1.4: Test Job Fails on Failing Tests

**Objective:** Verify CI catches failing tests

**Steps:**
```bash
# 1. Create failing test
cat > apps/api/src/routes/__tests__/fail.test.ts << 'EOF'
import { describe, it, expect } from "bun:test";

describe("Failing test", () => {
  it("should fail", () => {
    expect(1).toBe(2); // Intentional failure
  });
});
EOF

# 2. Commit and push
git add apps/api/src/routes/__tests__/fail.test.ts
git commit -m "test: Add failing test"
git push origin test/ci-validation

# 3. Monitor CI workflow
```

**Expected Result:**
- ❌ test-backend job fails
- ❌ Test output shows failure
- ❌ PR is blocked from merging

**Cleanup:**
```bash
rm apps/api/src/routes/__tests__/fail.test.ts
git add apps/api/src/routes/__tests__/fail.test.ts
git commit -m "test: Remove failing test"
git push origin test/ci-validation
```

#### Test 1.5: Coverage Report Posted to PR

**Objective:** Verify Codecov comments on PR

**Prerequisites:** Codecov token set in GitHub Secrets

**Steps:**
```bash
# 1. Ensure tests have coverage
# Coverage already generated in CI

# 2. Check PR for Codecov comment
# Navigate to PR: https://github.com/<owner>/<repo>/pull/<number>

# 3. Look for Codecov bot comment
```

**Expected Result:**
- ✅ Codecov bot posts comment on PR
- ✅ Comment shows coverage %
- ✅ Comment shows coverage diff
- ✅ Links to Codecov dashboard

#### Test 1.6: CI Blocks Merge on Failure

**Objective:** Verify branch protection blocks merge on CI failure

**Prerequisites:** Branch protection configured for `main`

**Steps:**
```bash
# 1. Introduce error (any from above)

# 2. Navigate to PR merge section

# 3. Attempt to merge
```

**Expected Result:**
- ❌ Merge button disabled or shows "Required status checks must pass"
- ❌ Status shows which jobs failed
- ✅ "Merge" becomes enabled only after fixing errors

### 2. Deployment Tests

#### Test 2.1: Backend Deploys on Merge to Main

**Objective:** Verify Fly.io deployment on merge

**Prerequisites:** Fly.io API token configured

**Steps:**
```bash
# 1. Create simple change
echo "# Deployment test" >> apps/api/README.md
git add apps/api/README.md
git commit -m "test: Trigger backend deployment"

# 2. Push to main
git checkout main
git pull origin main
git merge test/ci-validation
git push origin main

# 3. Monitor deployment
# Navigate to: https://github.com/<owner>/<repo>/actions
# Look for "Deploy Backend to Fly.io" workflow

# 4. Verify deployment
flyctl status -a supplex-api
curl https://supplex-api.fly.dev/api/health
```

**Expected Result:**
- ✅ Deploy workflow triggers on push to main
- ✅ Fly.io deployment succeeds
- ✅ Health check returns 200 OK
- ✅ API responds correctly

#### Test 2.2: Frontend Deploys on Merge to Main

**Objective:** Verify Vercel deployment on merge

**Steps:**
```bash
# 1. Create simple change
echo "# Deployment test" >> apps/web/README.md
git add apps/web/README.md
git commit -m "test: Trigger frontend deployment"
git push origin main

# 2. Monitor deployment
# Vercel dashboard: https://vercel.com/dashboard
# Or GitHub: Check PR for Vercel bot comment

# 3. Verify deployment
curl https://supplex.vercel.app/health
```

**Expected Result:**
- ✅ Vercel deploys automatically
- ✅ Deployment completes successfully
- ✅ Frontend health check returns 200 OK
- ✅ Application loads in browser

#### Test 2.3: Preview Deployment Created for PR

**Objective:** Verify PR preview deployments

**Steps:**
```bash
# 1. Create new PR (or use existing test PR)

# 2. Check for Vercel preview URL
# Look for Vercel bot comment on PR

# 3. Visit preview URL
# Example: https://supplex-git-test-ci-validation-team.vercel.app

# 4. Test application works
curl <preview-url>/health
```

**Expected Result:**
- ✅ Vercel creates unique preview URL
- ✅ Preview environment uses Preview env vars
- ✅ Application works in preview
- ✅ Preview URL included in PR comment

#### Test 2.4: Database Migrations Run on Deployment

**Objective:** Verify migrations run automatically

**Prerequisites:** Fly.io deployment configured with `release_command`

**Steps:**
```bash
# 1. Create new migration
cd packages/db

# Add new column to schema
# packages/db/src/schema/suppliers.ts
# Add: testColumn: text("test_column")

# Generate migration
pnpm db:generate

# 2. Commit and push
git add packages/db
git commit -m "test: Add test migration"
git push origin main

# 3. Monitor Fly.io logs during deployment
flyctl logs -a supplex-api

# Look for migration output:
# "Running migrations..."
# "Migration completed"

# 4. Verify migration applied
psql $DATABASE_URL -c "\d suppliers"
# Should show "test_column"

# 5. Cleanup: Create reverse migration
# Remove test_column from schema
pnpm db:generate
git add packages/db
git commit -m "test: Rollback test migration"
git push origin main
```

**Expected Result:**
- ✅ Migrations run before deployment
- ✅ Deployment succeeds if migrations succeed
- ✅ Deployment aborts if migrations fail
- ✅ Migration status visible in logs

#### Test 2.5: Health Check Verifies Deployment Success

**Objective:** Verify health checks in deployment workflow

**Steps:**
```bash
# 1. Check deploy workflow includes health check
cat .github/workflows/deploy-backend.yml
# Should include: curl https://supplex-api.fly.dev/api/health

# 2. Trigger deployment

# 3. Monitor workflow output
# Look for "Verify deployment" step

# 4. Verify step passes
```

**Expected Result:**
- ✅ Health check step runs after deployment
- ✅ Health check succeeds (200 OK)
- ✅ Deployment marked as successful
- ✅ Deployment fails if health check fails

### 3. Rollback Tests

#### Test 3.1: Vercel Rollback Works

**Objective:** Verify Vercel rollback procedure

**Steps:**
```bash
# 1. Note current deployment version
# Vercel dashboard → Deployments → Note latest version

# 2. Deploy new version (add comment to README)
echo "# Test rollback" >> apps/web/README.md
git add apps/web/README.md
git commit -m "test: Deploy version to rollback"
git push origin main

# 3. Wait for deployment to complete

# 4. Perform rollback
# Vercel dashboard → Deployments → Previous deployment → Promote to Production

# 5. Verify rollback
curl https://supplex.vercel.app/health
# Check that README change is reverted
```

**Expected Result:**
- ✅ Rollback completes in < 1 minute
- ✅ Previous version is live
- ✅ Application works correctly

**Time:** ~60 seconds

#### Test 3.2: Fly.io Rollback Works

**Objective:** Verify Fly.io rollback procedure

**Steps:**
```bash
# 1. List current releases
flyctl releases list -a supplex-api

# 2. Deploy new version
echo "# Test rollback" >> apps/api/README.md
git add apps/api/README.md
git commit -m "test: Deploy version to rollback"
git push origin main

# 3. Wait for deployment to complete

# 4. Perform rollback
flyctl releases rollback <previous-version> -a supplex-api

# 5. Verify rollback
flyctl status -a supplex-api
curl https://supplex-api.fly.dev/api/health
```

**Expected Result:**
- ✅ Rollback completes in < 2 minutes
- ✅ Previous version is running
- ✅ Health check passes

**Time:** ~90 seconds

### 4. Security & Quality Tests

#### Test 4.1: Secrets Not Exposed in Logs

**Objective:** Verify secrets are masked in CI logs

**Steps:**
```bash
# 1. Check CI workflow logs
# Navigate to: Actions → CI workflow → Select run → View logs

# 2. Search for sensitive values:
# - DATABASE_URL
# - JWT_SECRET
# - SENTRY_DSN
# - API tokens

# 3. Verify they appear as: ***
```

**Expected Result:**
- ✅ All secrets masked with `***`
- ✅ No sensitive data visible in logs
- ✅ Environment variables not printed

#### Test 4.2: Coverage Threshold Enforced

**Objective:** Verify coverage thresholds block merge

**Prerequisites:** Coverage thresholds set in codecov.yml

**Steps:**
```bash
# 1. Remove tests to drop coverage
# Delete a test file temporarily
git rm apps/api/src/routes/__tests__/health.test.ts
git commit -m "test: Drop coverage"
git push origin test/ci-validation

# 2. Check Codecov comment
# Navigate to PR

# 3. Check CI status
```

**Expected Result:**
- ⚠️ Codecov reports coverage drop
- ❌ CI fails if below threshold (70% backend)
- ❌ PR blocked from merging

**Cleanup:**
```bash
git revert HEAD
git push origin test/ci-validation
```

## Test Execution Checklist

Use this checklist when validating CI/CD setup:

```markdown
### CI Tests
- [ ] CI runs on PR creation
- [ ] Lint job catches errors
- [ ] Type-check job catches errors
- [ ] Test job catches failures
- [ ] Coverage report posted to PR
- [ ] Failed CI blocks merge

### Deployment Tests
- [ ] Backend deploys on merge to main
- [ ] Frontend deploys on merge to main
- [ ] Preview deployments created for PRs
- [ ] Migrations run automatically
- [ ] Health checks verify deployment

### Rollback Tests
- [ ] Vercel rollback works (< 1 min)
- [ ] Fly.io rollback works (< 2 min)

### Security Tests
- [ ] Secrets masked in logs
- [ ] Coverage thresholds enforced

### Manual Verification
- [ ] Application loads in browser
- [ ] User login works
- [ ] Critical flows functional
- [ ] No console errors
- [ ] Sentry not showing errors
```

## Automated Test Script

Create `scripts/test-cicd.sh` for automated testing:

```bash
#!/bin/bash
set -e

echo "🧪 Testing CI/CD Pipeline"

# Test health endpoints
echo "✓ Testing health endpoints..."
curl -f https://supplex-api.fly.dev/api/health
curl -f https://supplex.vercel.app/health

# Test API endpoints
echo "✓ Testing API..."
curl -f https://supplex-api.fly.dev/

# Check deployment status
echo "✓ Checking deployment status..."
flyctl status -a supplex-api

# Check recent releases
echo "✓ Checking recent releases..."
flyctl releases list -a supplex-api --limit 5

echo "✅ All CI/CD tests passed!"
```

Run tests:
```bash
chmod +x scripts/test-cicd.sh
./scripts/test-cicd.sh
```

## Troubleshooting

### Issue: CI Not Running on PR

**Solution:**
```bash
# Check workflow file exists
ls -la .github/workflows/ci.yml

# Verify trigger configuration
cat .github/workflows/ci.yml | grep "on:"

# Check branch protection rules
# GitHub → Settings → Branches → main → Edit
```

### Issue: Coverage Upload Fails

**Solution:**
```bash
# Verify Codecov token set
gh secret list | grep CODECOV_TOKEN

# Check coverage files generated
ls -la apps/web/coverage/
ls -la apps/api/coverage/

# Re-upload manually
pnpm add -g codecov
codecov -t $CODECOV_TOKEN
```

### Issue: Deployment Fails Silently

**Solution:**
```bash
# Check workflow logs
gh workflow view deploy-backend

# Check Fly.io logs
flyctl logs -a supplex-api

# Verify secrets set
flyctl secrets list -a supplex-api
```

## Next Steps

- [Rollback Procedures](./rollback-procedure.md)
- [GitHub Branch Protection Setup](./github-branch-protection-setup.md)
- [Vercel Deployment Setup](./vercel-deployment-setup.md)
- [Fly.io Deployment Setup](./flyio-deployment-setup.md)

