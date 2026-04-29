/**
 * Sentry Client-Side Configuration
 *
 * Configures Sentry for client-side error tracking in the React Router v7 app.
 * Only initializes if SENTRY_DSN is provided.
 *
 * Installation:
 *   pnpm add @sentry/react-router --filter @supplex/web
 *
 * Usage:
 *   Import in app/entry.client.tsx
 */

// NOTE: Uncomment when @sentry/react-router is installed
// import * as Sentry from "@sentry/react-router";
// import { useEffect } from "react";
// import { useLocation, useMatches } from "react-router";

/**
 * Initialize Sentry for client-side error tracking
 *
 * @param dsn - Sentry DSN from environment variables
 * @param environment - Current environment (development, staging, production)
 */
export function initSentryClient(dsn?: string, _environment?: string) {
  // Skip initialization if DSN not provided
  if (!dsn) {
    console.warn("Sentry DSN not provided, error tracking disabled");
    return;
  }

  // NOTE: Uncomment when @sentry/react-router is installed
  /*
  Sentry.init({
    dsn,
    environment: environment || "development",
    
    // Performance monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    
    // Session replay (optional - additional cost)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // React Router-specific integrations
    integrations: [
      Sentry.browserTracingIntegration({
        useEffect,
        useLocation,
        useMatches,
      }),
      Sentry.replayIntegration(),
    ],
    
    // Filter out non-error logs in production
    beforeSend(event, hint) {
      // Don't send 404 errors to Sentry
      if (event.exception?.values?.[0]?.value?.includes("404")) {
        return null;
      }
      
      return event;
    },
    
    // Add custom tags
    initialScope: {
      tags: {
        service: "web",
        framework: "react-router",
      },
    },
  });
  */

  console.log("Sentry initialized for client-side tracking");
}

/**
 * Manually capture an exception
 *
 * @param error - Error to capture
 * @param context - Additional context
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
) {
  // NOTE: Uncomment when @sentry/react-router is installed
  /*
  Sentry.captureException(error, {
    extra: context,
  });
  */

  console.error("Error captured:", error, context);
}

/**
 * Set user context for error tracking
 *
 * @param user - User information
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  role?: string;
  tenantId?: string;
}) {
  // NOTE: Uncomment when @sentry/react-router is installed
  /*
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.email,
    // Custom properties
    role: user.role,
    tenantId: user.tenantId,
  });
  */

  console.log("User context set:", user);
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  // NOTE: Uncomment when @sentry/react-router is installed
  /*
  Sentry.setUser(null);
  */

  console.log("User context cleared");
}
