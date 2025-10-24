# GitHub Branch Protection Setup

This document describes how to configure GitHub branch protection rules to ensure CI checks pass before merging.

## Prerequisites

- GitHub repository with admin access
- CI workflow configured (`.github/workflows/ci.yml`)
- At least one successful CI run on a branch

## Steps to Configure Branch Protection

### 1. Navigate to Branch Protection Settings

1. Go to your GitHub repository
2. Click **Settings** tab
3. Click **Branches** in the left sidebar
4. Click **Add branch protection rule**

### 2. Configure Protection Rule for `main` Branch

**Branch name pattern:** `main`

#### Required Status Checks

Enable: **✓ Require status checks to pass before merging**

Select the following status checks:
- ✓ `lint`
- ✓ `type-check`
- ✓ `test-frontend`
- ✓ `test-backend`
- ✓ `ci-status` (overall status check)

Enable: **✓ Require branches to be up to date before merging**

#### Additional Recommended Settings

- **✓ Require a pull request before merging**
  - Required approvals: `1`
  - ✓ Dismiss stale pull request approvals when new commits are pushed
  - ✓ Require review from Code Owners (optional, if using CODEOWNERS)

- **✓ Require conversation resolution before merging** (optional)

- **✓ Include administrators** (enforce rules for admins too)

- **✓ Do not allow bypassing the above settings**

### 3. Configure Protection Rule for `staging` Branch (Optional)

Repeat the same steps for the `staging` branch if you have a staging environment.

**Branch name pattern:** `staging`

Use the same required status checks as `main`.

### 4. Save Protection Rule

Click **Create** or **Save changes** at the bottom of the page.

## Verification

### Test the Protection Rule

1. Create a new branch from `main`
2. Make a small change (e.g., update README)
3. Push the branch and create a pull request
4. Verify that:
   - CI jobs run automatically
   - Merge button is disabled until all checks pass
   - If you introduce a lint error, the merge is blocked

### Troubleshooting

**Status checks not appearing:**
- Ensure CI workflow has run at least once on a branch
- Check that status check names in branch protection match job names in `.github/workflows/ci.yml`
- Status checks are case-sensitive

**Merge button still enabled despite failing checks:**
- Verify "Require status checks to pass" is enabled
- Check that you've saved the branch protection rule
- Ensure you're not an admin bypassing the rules (enable "Include administrators")

## Codecov Setup

To enable Codecov integration:

1. **Sign up for Codecov:**
   - Go to [codecov.io](https://codecov.io)
   - Sign in with GitHub account
   - Select your repository

2. **Get Codecov Token:**
   - Navigate to your repository on Codecov
   - Go to Settings → General
   - Copy the `CODECOV_TOKEN`

3. **Add Token to GitHub Secrets:**
   - Go to GitHub repository → Settings → Secrets and variables → Actions
   - Click **New repository secret**
   - Name: `CODECOV_TOKEN`
   - Value: Paste the token from Codecov
   - Click **Add secret**

4. **Verify Integration:**
   - Push a branch and create a PR
   - Verify Codecov comments on the PR with coverage report
   - Check that coverage checks appear in the PR status checks

## Next Steps

- Review [Vercel Deployment Setup](./vercel-deployment-setup.md)
- Review [Fly.io Deployment Setup](./flyio-deployment-setup.md)
- Review [Rollback Procedures](./rollback-procedure.md)

