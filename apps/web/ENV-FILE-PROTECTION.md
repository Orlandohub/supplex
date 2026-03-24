# ⚠️ CRITICAL: .env File Protection

## 🚨 DO NOT DELETE OR OVERWRITE apps/web/.env

The `apps/web/.env` file contains **critical environment variables** required for the application to function.

## Why This File Exists

- **Supabase Authentication**: Contains Supabase URL and keys
- **API Connection**: Defines API endpoint for backend communication
- **Session Security**: Contains SESSION_SECRET for cookie encryption
- **Environment Configuration**: Defines NODE_ENV and other settings

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
I need you to manually add the following to apps/web/.env:

REDIS_URL=redis://localhost:6379

Please add this line and restart the dev server.
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
- ✅ Templates available in `docs/templates/env-web.template`

## Required Environment Variables

The following variables **MUST** be present in `apps/web/.env`:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...

# API Configuration (Required)
API_URL=http://localhost:3001

# Session Secret (Required - for cookie encryption)
SESSION_SECRET=your-64-character-hex-secret

# Environment (Required)
NODE_ENV=development

# Optional
SENTRY_DSN=
```

## If This File Is Missing or Corrupted

**DO NOT CREATE FROM SCRATCH**

1. **Copy from template**:
   ```bash
   cp docs/templates/env-web.template apps/web/.env
   ```

2. **Fill in values** (see SETUP.md section 5)

3. **Get Supabase credentials**:
   - Go to https://supabase.com/dashboard
   - Project Settings → API
   - Copy Project URL and anon/public key

4. **Generate SESSION_SECRET**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Security Notes

- 🔒 Never commit this file to git
- 🔒 Keep credentials secret
- 🔒 Use different secrets for production
- 🔒 Rotate secrets periodically
- 🔒 Store production secrets in secure vaults (GitHub Secrets, Vercel, etc.)

## Related Documentation

- `apps/web/ENV-CONFIG.md` - Detailed environment configuration guide
- `docs/templates/env-web.template` - Template for this file
- `SETUP.md` - Complete setup instructions

---

**Last Updated**: 2025-10-26
**Status**: Protected File - Manual Management Only

