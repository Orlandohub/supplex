/**
 * Sentry Configuration for ElysiaJS API
 *
 * Configures Sentry for backend error tracking.
 * Only initializes if SENTRY_DSN is provided.
 *
 * Installation:
 *   pnpm add @sentry/bun --filter @supplex/api
 *
 * Note: Use @sentry/bun for Bun runtime, not @sentry/node
 *
 * Usage:
 *   Import in src/index.ts and wrap error handler
 */

// NOTE: Uncomment when @sentry/bun is installed
// import * as Sentry from "@sentry/bun";
import { logger } from "../logger";

const sentryLogger = logger.child({ module: "sentry" });

/**
 * Initialize Sentry for backend error tracking
 *
 * @param dsn - Sentry DSN from environment variables
 * @param environment - Current environment (development, staging, production)
 */
export function initSentry(dsn?: string, _environment?: string) {
  // Skip initialization if DSN not provided
  if (!dsn) {
    sentryLogger.warn("Sentry DSN not provided — error tracking disabled");
    return;
  }

  // NOTE: Uncomment when @sentry/bun is installed
  /*
  Sentry.init({
    dsn,
    environment: environment || "development",
    
    // Performance monitoring
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    
    // Release tracking (use git commit SHA from Fly.io)
    release: process.env.FLY_APP_NAME 
      ? `${process.env.FLY_APP_NAME}@${process.env.FLY_REGION || "unknown"}`
      : undefined,
    
    // Add custom tags
    initialScope: {
      tags: {
        service: "api",
        framework: "elysia",
        runtime: "bun",
      },
    },
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive request data
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }
        
        // Remove query parameters that might contain sensitive data
        if (event.request.query_string) {
          const params = new URLSearchParams(event.request.query_string);
          if (params.has("token")) params.delete("token");
          if (params.has("api_key")) params.delete("api_key");
          event.request.query_string = params.toString();
        }
      }
      
      return event;
    },
  });
  */

  sentryLogger.info("Sentry initialized for API error tracking");
}

/**
 * Capture an exception with context
 *
 * @param error - Error to capture
 * @param context - Additional context (request, user, etc.)
 */
export function captureException(
  error: Error,
  context?: {
    request?: Request;
    userId?: string;
    tenantId?: string;
    extra?: Record<string, any>;
  }
) {
  // NOTE: Uncomment when @sentry/bun is installed
  /*
  Sentry.captureException(error, {
    extra: {
      ...context?.extra,
      url: context?.request?.url,
      method: context?.request?.method,
    },
    user: context?.userId ? {
      id: context.userId,
    } : undefined,
    tags: context?.tenantId ? {
      tenantId: context.tenantId,
    } : undefined,
  });
  */

  sentryLogger.error({ err: error, userId: context?.userId, tenantId: context?.tenantId }, "Error captured");
}

/**
 * Wrap Elysia error handler with Sentry
 *
 * Usage in src/index.ts:
 *
 * ```typescript
 * import { wrapElysiaErrorHandler } from "./lib/monitoring/sentry";
 *
 * const app = new Elysia()
 *   .onError(wrapElysiaErrorHandler(({ error, code, set }) => {
 *     // Your existing error handler
 *   }));
 * ```
 */
export function wrapElysiaErrorHandler<T extends (...args: any[]) => any>(
  handler: T
): T {
  return ((...args: any[]) => {
    const [context] = args;
    const { error } = context;

    // Capture error in Sentry
    if (error instanceof Error) {
      captureException(error, {
        request: context.request,
        extra: {
          code: context.code,
          path: context.path,
        },
      });
    }

    // Call original handler
    return handler(...args);
  }) as T;
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
  // NOTE: Uncomment when @sentry/bun is installed
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

  sentryLogger.debug({ userId: user.id, role: user.role }, "User context set");
}

/**
 * Clear user context
 */
export function clearUserContext() {
  // NOTE: Uncomment when @sentry/bun is installed
  /*
  Sentry.setUser(null);
  */

  sentryLogger.debug("User context cleared");
}

/**
 * Add breadcrumb for debugging
 *
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  // NOTE: Uncomment when @sentry/bun is installed
  /*
  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
  */

  sentryLogger.debug({ breadcrumb: message, ...data }, "Breadcrumb added");
}
