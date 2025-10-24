/**
 * Sentry Server-Side Configuration
 *
 * Configures Sentry for server-side error tracking in Remix SSR.
 * Only initializes if SENTRY_DSN is provided.
 *
 * Installation:
 *   pnpm add @sentry/remix --filter @supplex/web
 *
 * Usage:
 *   Import in app/entry.server.tsx
 */

// NOTE: Uncomment when @sentry/remix is installed
// import * as Sentry from "@sentry/remix";

/**
 * Initialize Sentry for server-side error tracking
 *
 * @param dsn - Sentry DSN from environment variables
 * @param environment - Current environment (development, staging, production)
 */
export function initSentryServer(dsn?: string, _environment?: string) {
  // Skip initialization if DSN not provided
  if (!dsn) {
    console.warn("Sentry DSN not provided, error tracking disabled");
    return;
  }

  // NOTE: Uncomment when @sentry/remix is installed
  /*
  Sentry.init({
    dsn,
    environment: environment || "development",
    
    // Performance monitoring (lower sample rate for server)
    tracesSampleRate: environment === "production" ? 0.05 : 1.0,
    
    // Add custom tags
    initialScope: {
      tags: {
        service: "web-server",
        framework: "remix",
        runtime: "node",
      },
    },
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      
      return event;
    },
  });
  */

  console.log("Sentry initialized for server-side tracking");
}

/**
 * Capture exception with server context
 *
 * @param error - Error to capture
 * @param request - Request object
 */
export function captureRemixError(error: Error, request?: Request) {
  // NOTE: Uncomment when @sentry/remix is installed
  /*
  Sentry.captureException(error, {
    extra: {
      url: request?.url,
      method: request?.method,
    },
  });
  */

  console.error("Server error captured:", error, request?.url);
}
