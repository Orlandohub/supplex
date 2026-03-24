# 🛡️ Environment Files Protection Guide

## Critical Files

The following files contain sensitive credentials and configuration:

- `apps/web/.env` - Web application environment variables
- `apps/api/.env` - API server environment variables

## ⚠️ FOR AI AGENTS / CURSOR

**MANDATORY INSTRUCTIONS:**

### What You CANNOT Do

❌ **NEVER** attempt to read `.env` files (they're blocked)  
❌ **NEVER** attempt to write/edit `.env` files (will fail)  
❌ **NEVER** attempt to delete `.env` files  
❌ **NEVER** create `.env` files programmatically  

### What You MUST Do

✅ **IF** a task requires environment variable changes:
1. **STOP** - Do not attempt to modify the file
2. **IDENTIFY** which file needs changes (apps/web/.env or apps/api/.env)
3. **PROVIDE** exact lines to add/modify
4. **PROMPT** user to manually make the changes
5. **REMIND** user to restart relevant servers after changes

### Example Scenarios

#### Scenario 1: Adding a New Environment Variable

**Task**: "Add Redis support to the API"

**Correct Approach**:
```markdown
I need you to manually add the following line to apps/api/.env:

REDIS_URL=redis://localhost:6379

Steps:
1. Open apps/api/.env in your editor
2. Add the line above
3. Save the file
4. Restart the API server with: cd apps/api && bun run dev

Note: .env files are protected - I cannot modify them directly.
```

**Incorrect Approach**:
```markdown
I'll add REDIS_URL to your .env file now...
[Attempts to write - FAILS]
```

#### Scenario 2: Updating Existing Variable

**Task**: "Change API port to 3002"

**Correct Approach**:
```markdown
I need you to manually update apps/api/.env:

Change this line:
PORT=3001

To:
PORT=3002

Steps:
1. Open apps/api/.env in your editor
2. Find the PORT= line
3. Change value to 3002
4. Save the file
5. Restart API server

Also update apps/web/.env:

Change:
API_URL=http://localhost:3001

To:
API_URL=http://localhost:3002

Then restart the web server.
```

#### Scenario 3: Detecting Missing Variables

**Task**: User reports "Configuration validation failed: supabase.serviceRoleKey"

**Correct Approach**:
```markdown
The API server is missing SUPABASE_SERVICE_ROLE_KEY in apps/api/.env.

To fix this:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Project Settings → API
4. Copy the "service_role" secret key
5. Open apps/api/.env in your editor
6. Add this line (replace with your actual key):

SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-actual-key

7. Save and restart the API server

⚠️ Warning: This is an admin key - keep it secret!
```

## File Protection Mechanisms

### 1. Git Protection
```gitignore
# .gitignore
.env
.env.local
.env.production.local
.env.development.local
.env.test.local
```

**Result**: Never committed to version control

### 2. Cursor Protection
Files matching `.env*` are blocked by `globalIgnore`

**Result**: AI agents cannot read or write these files

### 3. Security Best Practices
- Contains sensitive credentials (database passwords, API keys, secrets)
- User-managed only
- Different per environment (dev/staging/prod)

## Required Environment Variables

### apps/web/.env

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
API_URL=http://localhost:3001
SESSION_SECRET=64-char-hex-string
NODE_ENV=development

# Optional
SENTRY_DSN=
```

**Validation**: See `apps/web/app/lib/auth/session.server.ts` (lines 16-26)

### apps/api/.env

```bash
# Required
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=base64-string-min-32-chars
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Optional
SENTRY_DSN=
REDIS_URL=
```

**Validation**: See `apps/api/src/config.ts` (uses Zod schema validation)

## Templates

If `.env` files are missing or corrupted, use templates:

```bash
# Web app
cp docs/templates/env-web.template apps/web/.env

# API server
cp docs/templates/env-api.template apps/api/.env
```

Then manually fill in actual values.

## Generating Secrets

### SESSION_SECRET (32 bytes, hex)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### JWT_SECRET (64 bytes, base64)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Supabase Keys
Get from Supabase Dashboard:
- Project Settings → API
- Copy URL, anon key, and service_role key

## Error Detection Patterns

### Common Errors That Indicate Missing/Wrong .env

#### Web App Errors:
```
Error: SUPABASE_URL is required. Check apps/web/.env file.
Error: SESSION_SECRET is required. Check apps/web/.env file.
getaddrinfo ENOTFOUND
```

#### API Errors:
```
❌ Configuration validation failed:
  - supabase.serviceRoleKey: String must contain at least 1 character(s)
  - database.url: String must contain at least 1 character(s)
Error: Invalid configuration
```

### When You See These Errors

**DO**:
1. Identify which variable is missing
2. Identify which file (apps/web/.env or apps/api/.env)
3. Provide instructions to user
4. Reference where to get the value

**DON'T**:
1. Try to fix it yourself
2. Attempt to read/write .env files
3. Assume default values

## Restoration Procedure

If `.env` files are accidentally deleted:

1. **User discovers** apps won't start
2. **AI Agent detects** configuration errors
3. **AI Agent provides** step-by-step restoration:
   ```markdown
   Your .env files appear to be missing. Here's how to restore them:

   1. Copy templates:
      cp docs/templates/env-web.template apps/web/.env
      cp docs/templates/env-api.template apps/api/.env

   2. Get Supabase credentials:
      - Dashboard: https://supabase.com/dashboard
      - Settings → API

   3. Fill in these values in apps/web/.env:
      - SUPABASE_URL=https://xxx.supabase.co
      - SUPABASE_ANON_KEY=eyJhbGci...
      - SESSION_SECRET=[generate new with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]

   4. Fill in these values in apps/api/.env:
      - DATABASE_URL=[from Supabase Settings → Database]
      - SUPABASE_URL=[same as web]
      - SUPABASE_ANON_KEY=[same as web]
      - SUPABASE_SERVICE_ROLE_KEY=[from Supabase API settings]
      - JWT_SECRET=[generate with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"]

   5. Restart both servers:
      pnpm dev
   ```

## Related Documentation

- `apps/web/ENV-CONFIG.md` - Detailed web app env configuration
- `apps/web/ENV-FILE-PROTECTION.md` - Web app specific protection
- `apps/api/ENV-FILE-PROTECTION.md` - API specific protection
- `docs/templates/env-web.template` - Web app template
- `docs/templates/env-api.template` - API template
- `SETUP.md` - Complete setup guide (section 5)

---

**For Future AI Agents**: This is a critical read-first document. Always check this before attempting any environment-related tasks.

**Last Updated**: 2025-10-26
**Status**: Active Protection

