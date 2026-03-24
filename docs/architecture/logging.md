# Logging Configuration

**Version**: 1.0  
**Date**: December 19, 2025  
**Status**: Production Standard

This document defines the logging standards for the Supplex application.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Log Levels](#log-levels)
3. [Environment Configuration](#environment-configuration)
4. [Backend (Elysia/Bun)](#backend-elysiabun)
5. [Frontend (Remix)](#frontend-remix)
6. [Best Practices](#best-practices)

---

## Philosophy

### Industry Standards

✅ **Production-Ready Logging**
- Minimal logs in production (errors only by default)
- Verbose logs in development (when needed)
- No PII (Personally Identifiable Information) in logs
- Structured logging for easy parsing
- Log levels for filtering

❌ **Anti-Patterns to Avoid**
- `console.log` everywhere
- Logging sensitive data (tokens, passwords, full headers)
- Same verbosity in all environments
- Unstructured log messages

---

## Log Levels

| Level | When to Use | Production | Development |
|-------|-------------|-----------|-------------|
| **ERROR** | Failures, exceptions, critical issues | ✅ Always | ✅ Always |
| **WARN** | Degraded functionality, auth failures | ✅ Yes | ✅ Yes |
| **INFO** | Important business events | ⚠️ Optional | ✅ Yes |
| **DEBUG** | Detailed flow, troubleshooting | ❌ No | ⚠️ Optional |

---

## Environment Configuration

### Backend API (Elysia/Bun)

Set these environment variables:

```bash
# Production (default)
NODE_ENV=production
LOG_LEVEL=error           # Only log errors
AUTH_DEBUG=false          # Disable auth middleware logging

# Staging/QA
NODE_ENV=production
LOG_LEVEL=warn            # Log errors and warnings
AUTH_DEBUG=false

# Development (verbose)
NODE_ENV=development
LOG_LEVEL=info            # Log everything except debug
AUTH_DEBUG=false          # Still don't spam auth logs

# Development (troubleshooting auth issues)
NODE_ENV=development
LOG_LEVEL=debug           # Log everything including debug
AUTH_DEBUG=true           # Enable verbose auth middleware logs
```

### Frontend (Remix)

Set these environment variables:

```bash
# Production
NODE_ENV=production

# Development
NODE_ENV=development
```

---

## Backend (Elysia/Bun)

### Auth Middleware Logging

**Location**: `apps/api/src/lib/rbac/middleware.ts`

**Default Behavior** (Production):
- ✅ Logs authentication **errors** only
- ✅ Logs user deactivation events
- ❌ No logs for successful auth
- ❌ No PII in logs (tokens masked, headers excluded)

**Debug Mode** (Development with `AUTH_DEBUG=true`):
- ✅ Logs all auth steps
- ✅ Logs user IDs, roles, tenant IDs (not full tokens)
- ✅ Helps troubleshoot auth issues

**Example Output (Production)**:
```
[AUTH WARN] Authentication failed: Token expired
[AUTH ERROR] Authentication failed: Invalid token - JWT malformed
```

**Example Output (Debug Mode)**:
```
[AUTH DEBUG] Starting authentication...
[AUTH DEBUG] Token extracted: present
[AUTH DEBUG] Validating token with Supabase...
[AUTH DEBUG] User authenticated: { userId: 'xxx', role: 'admin', tenantId: 'present' }
[AUTH DEBUG] Checking user status in database...
[AUTH DEBUG] Authentication successful
```

### Custom Logger Pattern

Use structured logging in route handlers:

```typescript
// ✅ Good
console.error("[WORKFLOW ERROR]", {
  action: "create",
  userId: user.id,
  error: error.message,
  timestamp: new Date().toISOString(),
});

// ❌ Bad
console.log("Error creating workflow:", error);
console.log("User:", user); // PII exposure
console.log("Headers:", headers); // Security risk
```

---

## Frontend (Remix)

### Loader/Action Logging

**Default Behavior**:
- ✅ Log critical errors only
- ❌ No verbose logging in production

**Pattern**:

```typescript
// ✅ Good
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const data = await fetchData();
    return json({ data });
  } catch (error) {
    console.error("[LOADER ERROR]", {
      route: "/suppliers",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    throw new Response("Failed to load data", { status: 500 });
  }
}

// ❌ Bad
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Starting loader"); // Too verbose
  console.log("Request:", request); // PII exposure
  const data = await fetchData();
  console.log("Data:", data); // Security risk
  return json({ data });
}
```

---

## Best Practices

### ✅ DO

1. **Use Structured Logs**
   ```typescript
   console.error("[MODULE ERROR]", {
     action: "specific_action",
     userId: user.id,
     error: error.message,
     timestamp: new Date().toISOString(),
   });
   ```

2. **Log Errors with Context**
   ```typescript
   try {
     await updateSupplier(id, data);
   } catch (error) {
     console.error("[SUPPLIER UPDATE ERROR]", {
       supplierId: id,
       error: error.message,
     });
     throw error;
   }
   ```

3. **Use Environment Checks**
   ```typescript
   if (process.env.NODE_ENV === "development") {
     console.log("[DEV] Processing workflow:", workflowId);
   }
   ```

4. **Mask Sensitive Data**
   ```typescript
   console.log("Token:", token.slice(0, 10) + "..."); // ✅ Masked
   ```

### ❌ DON'T

1. **Don't Log PII**
   ```typescript
   console.log("User:", user); // ❌ Contains email, name, etc.
   console.log("Token:", token); // ❌ Security risk
   console.log("Password:", password); // ❌ Critical security issue
   ```

2. **Don't Use `console.log` for Production**
   ```typescript
   console.log("Starting process..."); // ❌ Noise in production
   ```

3. **Don't Log Full Objects**
   ```typescript
   console.log("Request:", request); // ❌ Too much data
   console.log("Headers:", headers); // ❌ May contain sensitive info
   ```

4. **Don't Duplicate Logs**
   ```typescript
   console.log("Error:", error);
   console.log("Error message:", error.message); // ❌ Redundant
   console.error("Error:", error); // ❌ Same info 3 times
   ```

---

## Troubleshooting

### "I need to debug authentication issues"

**Backend**:
```bash
# Terminal
export AUTH_DEBUG=true
export LOG_LEVEL=debug
bun run dev
```

### "Too many logs in development"

**Backend**:
```bash
# Terminal
export AUTH_DEBUG=false
export LOG_LEVEL=warn
bun run dev
```

### "I need to see specific route logs"

Add temporary debug logs with environment checks:

```typescript
if (process.env.DEBUG_ROUTES === "true") {
  console.log("[ROUTE DEBUG]", { path: request.url });
}
```

---

## Migration Notes

**December 19, 2025**: Reduced auth middleware logging from 14 logs per request to 0-7 logs based on environment and log level.

**Before** (every request):
```
[AUTH MIDDLEWARE] Starting authentication...
[AUTH MIDDLEWARE] Headers: {...}
[AUTH MIDDLEWARE] Extracted token: EXISTS
[AUTH MIDDLEWARE] Validating token with Supabase...
[AUTH MIDDLEWARE] Supabase response - User: EXISTS
[AUTH MIDDLEWARE] Supabase response - Error: null
[AUTH MIDDLEWARE] User metadata: {...}
[AUTH MIDDLEWARE] Extracted role: admin
[AUTH MIDDLEWARE] Extracted tenantId: xxx
[AUTH MIDDLEWARE] Checking if user is deactivated...
[AUTH MIDDLEWARE] Returning user context
```

**After** (production):
```
(no logs for successful auth)
```

**After** (debug mode):
```
[AUTH DEBUG] Starting authentication...
[AUTH DEBUG] Token extracted: present
[AUTH DEBUG] Validating token with Supabase...
[AUTH DEBUG] User authenticated: { userId: 'xxx', role: 'admin', tenantId: 'present' }
[AUTH DEBUG] Checking user status in database...
[AUTH DEBUG] Authentication successful
```

---

**Last Updated**: December 19, 2025  
**Approved By**: Dev Team  
**Status**: Production Standard

