# Setup Instructions

This file contains manual setup steps required after the initial code structure is in place.

## Prerequisites Installation

### 1. Install pnpm (if not already installed)

```bash
# Using npm
npm install -g pnpm@8.15.0

# Or using the install script
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Verify installation
pnpm --version
```

### 2. Install Bun (if not already installed)

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (use WSL2)
wsl --install
# Then run the above command inside WSL

# Verify installation
bun --version
```

## Initial Setup Steps

### 3. Install Dependencies

```bash
# From project root
pnpm install
```

This will:
- Install all dependencies for all workspaces
- Generate `pnpm-lock.yaml`
- Create `node_modules` in root and each workspace
- Link workspace packages together

### 4. Configure Supabase Project (Database & Authentication Setup)

**Story 1.2 requires a Supabase project for PostgreSQL database with RLS support.**
**Story 1.3 requires Supabase Auth configuration for user authentication.**

#### 4.1 Create Supabase Project

1. **Create Supabase Project**:
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - **Important Settings**:
     - Name: `supplex-dev` (or your preference)
     - Database Password: Generate a strong password (save it!)
     - Region: **EU-West (Frankfurt)** - Required for GDPR compliance
     - Plan: Free tier is sufficient for development
   - Wait for project initialization (~2 minutes)

2. **Get Database Connection String**:
   - In Supabase Dashboard, go to Project Settings → Database
   - Under "Connection string", select **URI** format
   - Copy the connection pooling string (for better performance)
   - Replace `[YOUR-PASSWORD]` with your database password
   - Example format: `postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`

3. **Get API Keys**:
   - Go to Project Settings → API
   - Copy the following keys (save them securely):
     - **Project URL**: `https://xxx.supabase.co`
     - **Anon/Public Key**: Used for client-side authentication
     - **Service Role Key**: Used for server-side admin operations (keep secret!)

#### 4.2 Configure Supabase Authentication (Story 1.3)

1. **Enable Email/Password Authentication**:
   - In Supabase Dashboard, go to Authentication → Settings
   - Under "Auth Providers", ensure **Email** is enabled
   - Configure email settings:
     - **Enable email confirmations**: Yes (recommended for production)
     - **Enable email change confirmations**: Yes
     - **Enable secure email change**: Yes (prevents email takeover)

2. **Configure JWT Settings**:
   - Go to Authentication → Settings → JWT Settings
   - **JWT expiry**: Set to `3600` (1 hour for access tokens)
   - **Refresh token expiry**: Set to `604800` (7 days)
   - Note: JWT Secret is auto-generated, copy it for your .env files

3. **Set Up OAuth Providers**:

   **Google OAuth Setup**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing one
   - Enable Google+ API (or Google Identity API)
   - Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
   - Application type: **Web application**
   - Authorized redirect URIs: `https://xxx.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret
   - In Supabase: Authentication → Settings → Auth Providers → Google
   - Enable Google provider and paste Client ID and Secret

   **Microsoft OAuth Setup** (Optional):
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to Azure Active Directory → App registrations
   - Click "New registration"
   - Name: `Supplex Authentication`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `https://xxx.supabase.co/auth/v1/callback`
   - After creation, go to Certificates & secrets → New client secret
   - Copy Application (client) ID and client secret value
   - In Supabase: Authentication → Settings → Auth Providers → Azure
   - Enable Azure provider and paste Client ID and Secret

4. **Configure Email Templates**:
   - Go to Authentication → Settings → Email Templates
   - Customize the following templates for branding:

   **Confirmation Email Template**:
   ```html
   <h1>Welcome to Supplex!</h1>
   <p>Please confirm your email address by clicking the link below:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm Email Address</a></p>
   <p>If you didn't sign up for Supplex, you can safely ignore this email.</p>
   <p>Best regards,<br>The Supplex Team</p>
   ```

   **Password Reset Template**:
   ```html
   <h1>Reset Your Supplex Password</h1>
   <p>You requested a password reset for your Supplex account.</p>
   <p>Click the link below to reset your password:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
   <p>This link will expire in 24 hours.</p>
   <p>If you didn't request this reset, you can safely ignore this email.</p>
   <p>Best regards,<br>The Supplex Team</p>
   ```

   **Magic Link Template**:
   ```html
   <h1>Sign in to Supplex</h1>
   <p>Click the link below to sign in to your account:</p>
   <p><a href="{{ .ConfirmationURL }}">Sign In to Supplex</a></p>
   <p>This link will expire in 1 hour.</p>
   <p>If you didn't request this sign-in link, you can safely ignore this email.</p>
   <p>Best regards,<br>The Supplex Team</p>
   ```

5. **Configure Security Settings**:
   - Go to Authentication → Settings → Security
   - **Rate limiting**: Configure to prevent abuse
     - **Auth requests per hour**: 100 (adjust based on needs)
     - **Password reset requests per hour**: 10
   - **Password Requirements**:
     - Minimum length: 8 characters
     - Require uppercase: Yes
     - Require lowercase: Yes
     - Require numbers: Yes
     - Require symbols: Optional (set to No for better UX)

6. **Test Authentication Flow**:
   - Go to Authentication → Users
   - Click "Add user" to test manual user creation
   - Try creating a user with email and password
   - Verify email confirmation works (check spam folder)
   - Test password reset flow
   - Test OAuth providers if configured

#### 4.3 Advanced Configuration (Optional)

1. **Install Supabase CLI** (for database migrations and local development):
   ```bash
   # Using npm
   npm install -g supabase
   
   # Verify installation
   supabase --version
   
   # Login to Supabase
   supabase login
   ```

2. **Configure Connection Pooling**:
   - Connection pooling is already enabled in Supabase by default
   - Default settings for Free tier:
     - Max connections: 20
     - Connection timeout: 60s
   - No additional configuration needed for MVP

### 5. Create Environment Files

Environment file templates are provided for easy setup:

```bash
# Copy environment templates and customize with your values
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Now edit the `.env` files with your actual Supabase configuration:

**Frontend Environment (`apps/web/.env`)**:
- Replace `https://xxx.supabase.co` with your Supabase Project URL
- Replace `your-anon-key-here` with your Supabase Anon Key
- Add OAuth client IDs (Google/Microsoft) if using OAuth
- Generate a strong SESSION_SECRET for Remix cookies

**Backend Environment (`apps/api/.env`)**:
- Replace `[YOUR-PASSWORD]` in DATABASE_URL with your database password
- Replace Supabase URL, Anon Key, and Service Role Key with actual values
- Add OAuth client secrets if using server-side OAuth flows
- Configure JWT secrets (auto-generated by Supabase)

**Security Note**: 
- Never commit `.env` files to git (already in `.gitignore`)
- Keep Service Role Key secret - it has admin privileges
- Use different secrets for production environments
- See `.env.example` files for complete reference

### 5. Initialize Husky

```bash
# Prepare Husky hooks
pnpm prepare

# Make pre-commit hook executable (Unix/macOS/Linux)
chmod +x .husky/pre-commit
```

### 6. Verify TypeScript Configuration

```bash
# Type-check all workspaces
pnpm type-check
```

Expected output: No errors across all workspaces

### 7. Run Tests

```bash
# Run all tests
pnpm test
```

Expected: All tests should pass

### 8. Start Development Servers

```bash
# Start both frontend and backend
pnpm dev
```

This should start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### 9. Verify Setup

Open your browser and navigate to:

- **Frontend**: http://localhost:3000
  - Should see "Welcome to Supplex" page
  
- **Backend Health**: http://localhost:3001/health
  - Should return JSON: `{"status":"ok","timestamp":"..."}`

- **Backend Root**: http://localhost:3001/
  - Should return: `{"message":"Supplex API","version":"1.0.0","status":"healthy"}`

## Troubleshooting

### Bun/ElysiaJS Backend Verification (Windows/WSL)

**Windows users must use WSL2 for Bun runtime. Follow these steps:**

1. **Install WSL2** (if not already installed):
   ```bash
   # Run in PowerShell as Administrator
   wsl --install
   # Restart your computer after installation
   ```

2. **Verify Bun installation in WSL**:
   ```bash
   # Open WSL terminal
   wsl
   
   # Check Bun version
   bun --version  # Should show 1.1.0 or higher
   ```

3. **Test ElysiaJS dev server with hot reload**:
   ```bash
   # Navigate to project in WSL
   cd /mnt/c/Users/[YourUser]/[PathToProject]/supplex
   
   # Install dependencies if needed
   pnpm install
   
   # Start backend dev server
   pnpm --filter @supplex/api dev
   
   # Expected output:
   # 🦊 Supplex API is running at http://localhost:3001
   ```

4. **Test health check endpoint**:
   ```bash
   # In a new terminal/WSL session
   curl http://localhost:3001/health
   
   # Expected output:
   # {"status":"ok","timestamp":"2025-10-16T..."}
   ```

5. **Test hot reload**:
   - With dev server running, edit `apps/api/src/index.ts`
   - Make a small change (e.g., update version number)
   - Server should automatically restart
   - Verify change reflected in API response

6. **Test concurrent dev mode** (frontend + backend):
   ```bash
   # From project root
   pnpm dev
   
   # Should start both:
   # - Frontend: http://localhost:3000
   # - Backend: http://localhost:3001
   ```

**Known WSL Issues:**
- **File permissions**: If you get permission errors, ensure project is on Linux filesystem (`~` or `/home/`), not Windows mount (`/mnt/c/`)
- **Port access**: WSL2 ports should be accessible from Windows browser automatically
- **Performance**: Projects on Windows filesystem (`/mnt/c/`) are slower; consider moving to WSL home directory

### pnpm install fails

If you see errors during `pnpm install`:

1. **Check Node.js version**: Must be 20.x or higher
   ```bash
   node --version
   ```

2. **Clear cache and retry**:
   ```bash
   pnpm store prune
   pnpm install --force
   ```

3. **Check for package conflicts**: Review the error message for specific package issues

### Bun not found

- **Windows users**: Bun requires WSL2. Install WSL and run commands inside WSL.
- **macOS/Linux**: Ensure `~/.bun/bin` is in your PATH

### TypeScript errors

If you see "Cannot find module '@supplex/types'" errors:

1. Ensure all packages are installed: `pnpm install`
2. Build the types package: `pnpm --filter @supplex/types build`
3. Restart your IDE to refresh TypeScript server

### Pre-commit hook not working

```bash
# Reinitialize Husky
rm -rf .husky
pnpm prepare
chmod +x .husky/pre-commit

# Test manually
git add .
git commit -m "test"
```

### Port conflicts

If ports 3000 or 3001 are already in use:

**Option 1**: Stop the conflicting process
```bash
# Find process using port
lsof -ti:3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

**Option 2**: Change ports in .env files
```bash
# apps/web/.env
PORT=3002

# apps/api/.env
PORT=3003
```

## Validation Checklist

After completing all steps, verify:

- [ ] `pnpm install` completed without errors
- [ ] `pnpm-lock.yaml` file exists in root
- [ ] `.env` files exist in `apps/web/` and `apps/api/`
- [ ] `pnpm type-check` passes with no errors
- [ ] `pnpm test` runs and all tests pass
- [ ] `pnpm dev` starts both servers successfully
- [ ] Frontend loads at http://localhost:3000
- [ ] Backend health check works at http://localhost:3001/health
- [ ] Pre-commit hook runs on `git commit`
- [ ] Hot reload works (edit a file and see it update)

## Next Steps

Once setup is complete:

1. Review [README.md](./README.md) for development workflow
2. Check [docs/architecture/](./docs/architecture/) for architecture details
3. Review coding standards in [docs/architecture/coding-standards.md](./docs/architecture/coding-standards.md)
4. Start implementing features from [docs/stories/](./docs/stories/)

## Getting Help

If you encounter issues not covered here:

1. Check the main [README.md](./README.md) troubleshooting section
2. Review [docs/architecture/development-workflow.md](./docs/architecture/development-workflow.md)
3. Check package-specific README files (if they exist)
4. Review error logs in terminal output

---

**Last Updated**: 2025-10-13
**Story**: 1.1 - Project Infrastructure & Monorepo Setup

