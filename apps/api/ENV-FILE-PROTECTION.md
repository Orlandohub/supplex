# ⚠️ CRITICAL: .env File Protection

## 🚨 DO NOT DELETE OR OVERWRITE apps/api/.env

The `apps/api/.env` file contains **critical environment variables** required for the API server to start.

## Why This File Exists

- **Database Connection**: Contains PostgreSQL connection string
- **Supabase Configuration**: Service role key for admin operations
- **Authentication**: JWT secret for token signing
- **Server Configuration**: Port, CORS, and environment settings

## ⚠️ FOR AI AGENTS / CURSOR - READ THIS

**CRITICAL INSTRUCTIONS FOR AI ASSISTANTS:**

1. **.env files are PROTECTED** - They are in `.gitignore` and blocked by `globalIgnore`
2. **You CANNOT modify .env files** - Any attempt to write/edit will fail
3. **If a task requires .env changes:**
   - ❌ DO NOT attempt to modify the file
   - ✅ PROMPT the user to manually add the changes
   - ✅ Provide the exact lines to add
   - ✅ Specify which file (apps/web/.env or apps/api/.env)

### Example Correct Behavior

**Task**: "Add REDIS_URL to environment"

**Correct Response**:
```
I need you to manually add the following to apps/api/.env:

REDIS_URL=redis://localhost:6379

Please add this line and restart the API server.
```

**Incorrect Response**:
```
I'll add REDIS_URL to your .env file...
[Attempts to write file - FAILS]
```

## File Protection Status

- ✅ Listed in `.gitignore` - Never committed to version control
- ✅ Blocked by `globalIgnore` - AI agents cannot modify
- ✅ Contains sensitive credentials - Must be manually managed
- ✅ Templates available in `docs/templates/env-api.template`

## Required Environment Variables

The following variables **MUST** be present in `apps/api/.env`:

```bash
# Database Configuration (Required)
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... # ⚠️ Admin key - keep secret!

# Authentication & Security (Required)
JWT_SECRET=your-secure-random-string-min-32-chars

# Server Configuration (Required)
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Optional
SENTRY_DSN=
REDIS_URL=
```

## Configuration Validation

The API server validates configuration on startup using Zod schemas (see `apps/api/src/config.ts`).

**If validation fails**, you'll see errors like:
```
❌ Configuration validation failed:
  - supabase.serviceRoleKey: String must contain at least 1 character(s)
```

This means a required variable is missing or empty.

## If This File Is Missing or Corrupted

**DO NOT CREATE FROM SCRATCH**

1. **Copy from template**:
   ```bash
   cp docs/templates/env-api.template apps/api/.env
   ```

2. **Fill in values** (see SETUP.md section 5)

3. **Get Supabase credentials**:
   - Go to https://supabase.com/dashboard
   - Project Settings → API
   - Copy Project URL, anon key, and **service_role key**
   - Project Settings → Database
   - Copy connection string (use connection pooling)

4. **Generate JWT_SECRET**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
   ```

## Security Notes

- 🔒 Never commit this file to git
- 🔒 **SUPABASE_SERVICE_ROLE_KEY** has admin privileges - keep secret!
- 🔒 Use different secrets for production
- 🔒 Rotate secrets periodically
- 🔒 Store production secrets in secure vaults (Fly.io Secrets, GitHub Secrets, etc.)

## Troubleshooting

### API Server Won't Start

**Error**: `Configuration validation failed`

**Solution**: Check all required variables are present and non-empty. See error message for specific field.

**Error**: `Invalid configuration`

**Solution**: Check format of variables:
- DATABASE_URL must be valid PostgreSQL connection string
- SUPABASE_URL must be valid URL (https://...)
- JWT_SECRET must be at least 32 characters

### Database Connection Fails

**Error**: `Connection timeout` or `getaddrinfo ENOTFOUND`

**Solution**: 
1. Verify DATABASE_URL is correct
2. Check password is correctly escaped
3. Ensure Supabase project is active
4. Try connection pooling URL instead of direct connection

## Related Documentation

- `apps/api/SETUP-COMPLETE.md` - API server setup guide
- `docs/templates/env-api.template` - Template for this file
- `SETUP.md` - Complete setup instructions

---

**Last Updated**: 2025-10-26
**Status**: Protected File - Manual Management Only

