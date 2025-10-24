# Sentry Error Monitoring Setup

This guide covers setting up Sentry for error tracking and monitoring in both frontend (Remix) and backend (ElysiaJS) applications.

## Overview

Sentry provides:
- Real-time error tracking
- Performance monitoring
- Release tracking
- User context
- Breadcrumb trails for debugging
- Alert notifications (Email, Slack, etc.)

## Prerequisites

- Sentry account (sign up at [sentry.io](https://sentry.io))
- Project deployed to staging or production

## Quick Start

### 1. Create Sentry Projects

#### Via Sentry Dashboard

1. Go to [sentry.io](https://sentry.io) and log in
2. Click **Create Project**
3. Create two projects:
   - **Frontend Project:**
     - Platform: **JavaScript (Remix)**
     - Name: `supplex-web`
     - Team: Select your team
   - **Backend Project:**
     - Platform: **Node.js** (or Bun if available)
     - Name: `supplex-api`
     - Team: Select your team

#### Get DSN Keys

1. Go to Project → Settings → Client Keys (DSN)
2. Copy the DSN for each project:
   - Frontend DSN: `https://xxx@xxx.ingest.sentry.io/xxx`
   - Backend DSN: `https://yyy@yyy.ingest.sentry.io/yyy`

### 2. Install Sentry SDKs

#### Frontend (Remix)

```bash
pnpm add @sentry/remix --filter @supplex/web
```

#### Backend (ElysiaJS with Bun)

```bash
# Use Bun-specific SDK
pnpm add @sentry/bun --filter @supplex/api

# Or Node.js SDK if Bun SDK unavailable
pnpm add @sentry/node --filter @supplex/api
```

### 3. Configure Environment Variables

#### Frontend (.env)

```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

#### Backend (.env)

```bash
SENTRY_DSN=https://yyy@yyy.ingest.sentry.io/yyy
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=supplex-api
SENTRY_AUTH_TOKEN=sntrys_...
```

### 4. Initialize Sentry

#### Frontend Integration

**app/entry.client.tsx:**

```typescript
import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { initSentryClient } from "~/lib/monitoring/sentry.client";

// Initialize Sentry
if (typeof window !== "undefined") {
  initSentryClient(
    window.ENV?.SENTRY_DSN,
    window.ENV?.NODE_ENV
  );
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
```

**app/entry.server.tsx:**

```typescript
import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";
import { initSentryServer } from "~/lib/monitoring/sentry.server";

// Initialize Sentry for SSR
initSentryServer(
  process.env.SENTRY_DSN,
  process.env.NODE_ENV
);

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

// Error boundary
export function handleError(error: Error, { request }: { request: Request }) {
  // Don't log 404s
  if (error.message?.includes("404")) {
    return;
  }
  
  console.error("Server error:", error);
  
  // Sentry will automatically capture this
}
```

#### Backend Integration

**apps/api/src/index.ts:**

```typescript
import { Elysia } from "elysia";
import { initSentry, captureException } from "./lib/monitoring/sentry";

// Initialize Sentry
initSentry(
  process.env.SENTRY_DSN,
  process.env.NODE_ENV
);

const app = new Elysia()
  // ... other middleware
  .onError(({ error, code, set, request }) => {
    // Capture error in Sentry
    if (error instanceof Error) {
      captureException(error, {
        request,
        extra: { code },
      });
    }
    
    // ... existing error handling
  });
```

### 5. Set Environment Variables in Deployment

#### Vercel (Frontend)

```bash
# Via Vercel CLI
vercel env add SENTRY_DSN production
# Enter: https://xxx@xxx.ingest.sentry.io/xxx

# Or via Vercel Dashboard:
# Project → Settings → Environment Variables
# Add SENTRY_DSN for Production, Preview, Development
```

#### Fly.io (Backend)

```bash
flyctl secrets set \
  SENTRY_DSN="https://yyy@yyy.ingest.sentry.io/yyy" \
  -a supplex-api
```

### 6. Configure Alerts

#### Email Alerts

1. Go to Sentry Project → Settings → Alerts
2. Click **Create Alert**
3. Configure:
   - **Alert Name:** "Production Errors"
   - **When:** "An event is seen"
   - **If:** "The event's environment equals production"
   - **Then:** "Send an email to team@supplex.com"

#### Slack Integration

1. Go to Organization Settings → Integrations
2. Find **Slack** and click **Add to Slack**
3. Authorize Slack workspace
4. Create Alert Rule:
   - **Alert Name:** "Critical Production Errors"
   - **When:** "An event is seen"
   - **If:**
     - Environment equals production
     - Event level is error or fatal
   - **Then:** "Send a Slack notification to #alerts"

#### Alert Thresholds

Create alert for error spikes:
1. **Alert Name:** "Error Spike Detection"
2. **When:** "Number of events in an issue"
3. **If:**
   - Environment equals production
   - Greater than 10 events
   - In 5 minutes
4. **Then:** "Send a Slack notification to #alerts"

### 7. Verify Integration

#### Test Frontend Error Tracking

Add test button temporarily:

```typescript
// app/routes/test-error.tsx
export default function TestError() {
  function triggerError() {
    throw new Error("Test frontend error");
  }
  
  return (
    <button onClick={triggerError}>
      Trigger Test Error
    </button>
  );
}
```

Visit `/test-error` and click button. Check Sentry dashboard for error.

#### Test Backend Error Tracking

```bash
# Trigger error via API
curl https://supplex-api.fly.dev/api/non-existent-route

# Or add test endpoint:
app.get("/test-error", () => {
  throw new Error("Test backend error");
});
```

Check Sentry dashboard for error.

## Source Maps Configuration

### Why Source Maps?

Source maps allow Sentry to show original TypeScript code in error stack traces instead of minified JavaScript.

### Frontend Source Maps (Vercel)

**vite.config.ts:**

```typescript
export default defineConfig({
  build: {
    sourcemap: true, // Generate source maps
  },
});
```

**Upload to Sentry:**

```bash
# Install Sentry CLI
pnpm add -D @sentry/cli --filter @supplex/web

# Add build script to package.json
"scripts": {
  "build": "remix vite:build && sentry-cli sourcemaps upload --org your-org --project supplex-web ./build"
}

# Set environment variables for CI
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org
SENTRY_PROJECT=supplex-web
```

### Backend Source Maps (Fly.io)

**bunfig.toml:**

```toml
[build]
  sourcemap = "external"
```

**Upload to Sentry:**

```bash
# Add to .github/workflows/deploy-backend.yml
- name: Upload source maps to Sentry
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  run: |
    pnpm add -g @sentry/cli
    sentry-cli sourcemaps upload \
      --org your-org \
      --project supplex-api \
      ./apps/api/dist
```

## Advanced Configuration

### User Context Tracking

**Frontend:**

```typescript
// After user logs in
import { setUserContext } from "~/lib/monitoring/sentry.client";

setUserContext({
  id: user.id,
  email: user.email,
  role: user.role,
  tenantId: user.tenantId,
});

// On logout
import { clearUserContext } from "~/lib/monitoring/sentry.client";
clearUserContext();
```

**Backend:**

```typescript
// In authentication middleware
import { setUserContext } from "./lib/monitoring/sentry";

app.derive(({ request, user }) => {
  if (user) {
    setUserContext({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
  }
});
```

### Breadcrumbs

Add breadcrumbs for debugging:

```typescript
import { addBreadcrumb } from "./lib/monitoring/sentry";

// Log important actions
addBreadcrumb("User created supplier", {
  supplierId: supplier.id,
  userId: user.id,
});

// If error occurs, breadcrumbs show user's actions leading to error
```

### Performance Monitoring

**Frontend:**

Already configured in `sentry.client.ts` with `tracesSampleRate`.

**Backend:**

```typescript
import * as Sentry from "@sentry/bun";

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// ... routes
app.use(Sentry.Handlers.errorHandler());
```

### Session Replay (Frontend Only)

**Note:** Additional cost, useful for debugging UI issues.

Already configured in `sentry.client.ts` with `replaysSessionSampleRate`.

Adjust sample rates:
- `replaysSessionSampleRate: 0.1` - Record 10% of normal sessions
- `replaysOnErrorSampleRate: 1.0` - Record 100% of sessions with errors

## Monitoring & Dashboards

### Sentry Dashboard

Key sections:
1. **Issues:** View and triage errors
2. **Performance:** Monitor transaction speeds
3. **Releases:** Track errors by deployment
4. **Alerts:** Manage notification rules
5. **Stats:** View error trends

### Custom Dashboard

Create custom dashboard:
1. Go to Dashboards → Create Dashboard
2. Add widgets:
   - **Error Rate:** Line chart of errors over time
   - **Top Errors:** Table of most frequent errors
   - **Slow Transactions:** Table of slowest API endpoints
   - **Error by Environment:** Pie chart

### Weekly Reports

Enable weekly email reports:
1. User Settings → Notifications
2. Enable **Weekly Reports**
3. Select projects to include

## Troubleshooting

### Errors Not Appearing in Sentry

**Cause:** Sentry not initialized or DSN incorrect

**Fix:**
```bash
# Verify DSN is set
echo $SENTRY_DSN

# Check Sentry initialization logs
# Should see: "Sentry initialized for..."

# Test manually
curl -X POST https://sentry.io/api/0/... \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN"
```

### Source Maps Not Working

**Cause:** Source maps not uploaded or release not tagged

**Fix:**
```bash
# Upload source maps
sentry-cli sourcemaps upload --org your-org --project supplex-web ./build

# Verify upload
sentry-cli releases list --org your-org
```

### Too Many Errors (Alert Fatigue)

**Cause:** Low-priority errors flooding Sentry

**Fix:**
```typescript
// Filter errors in beforeSend
beforeSend(event) {
  // Ignore 404 errors
  if (event.message?.includes("404")) {
    return null;
  }
  
  // Ignore network errors
  if (event.message?.includes("Network request failed")) {
    return null;
  }
  
  return event;
}
```

### High Sentry Costs

**Cause:** Too many events or high sample rates

**Fix:**
1. Reduce sample rates:
   - `tracesSampleRate: 0.05` (5% of transactions)
   - `replaysSessionSampleRate: 0.01` (1% of sessions)

2. Set rate limits in Sentry:
   - Project Settings → Client Keys → Rate Limits
   - Set max events per minute

3. Filter low-value errors with `beforeSend`

## Best Practices

1. **Don't log sensitive data:**
   - Remove PII from error messages
   - Filter sensitive headers (Authorization, Cookie)
   - Redact sensitive query parameters

2. **Use environments:**
   - Separate dev, staging, production
   - Only alert on production errors

3. **Tag releases:**
   - Use Git commit SHA for releases
   - Deploy same release to frontend and backend

4. **Set user context:**
   - Helps identify affected users
   - Filter errors by tenant

5. **Add breadcrumbs:**
   - Log important user actions
   - Helps reproduce bugs

6. **Triage regularly:**
   - Mark errors as resolved
   - Archive low-priority issues
   - Create GitHub issues for bugs

7. **Monitor performance:**
   - Track slow API endpoints
   - Optimize based on Sentry data

## Cost Optimization

- **Free Tier:** 5,000 errors/month, 10,000 transactions/month
- **Team Plan:** $26/month - 50,000 errors, 100,000 transactions
- **Business Plan:** $80/month - 250,000 errors, 500,000 transactions

**Tips:**
- Start with low sample rates (5-10%)
- Filter non-actionable errors
- Use error grouping to reduce unique issues
- Review monthly usage in Settings → Usage & Billing

## Next Steps

- [Rollback Procedures](./rollback-procedure.md)
- [Environment Variables Configuration](./environment-variables.md)
- [GitHub Branch Protection Setup](./github-branch-protection-setup.md)

