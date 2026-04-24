import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import logger from "./lib/logger";
import { correlationId } from "./lib/correlation-id";
import { ApiError } from "./lib/errors";
import { registerRoute } from "./routes/auth/register";
import { acceptInvitationRoute } from "./routes/auth/accept-invitation";
import { devListUsersRoute } from "./routes/auth/dev-list-users";
import { devLoginRoute } from "./routes/auth/dev-login";
import { usersRoutes } from "./routes/users";
import { suppliersRoutes } from "./routes/suppliers";
import { documentsRoutes } from "./routes/documents";
// import { checklistsRoutes } from "./routes/checklists"; // Legacy - removed Migration 0017
import { workflowsRoutes } from "./routes/workflows";
import { adminRoutes } from "./routes/admin";
import { unsubscribeRoute } from "./routes/unsubscribe";
import { formTemplatesRoutes } from "./routes/form-templates";
import { formSubmissionsRoutes } from "./routes/form-submissions";
import { documentTemplatesRoutes } from "./routes/document-templates";
import { workflowTemplatesRoutes } from "./routes/workflow-templates";
import { healthRoutes } from "./routes/health";
import {
  emailWorker as _emailWorker,
  closeEmailWorker,
  closeEmailQueue,
  closeRedisConnection,
  isRedisEnabled,
} from "./queue";

/**
 * Main Elysia application instance
 * Configured with CORS, error handling, and routes
 */
const app = new Elysia()
  // CORS configuration
  .use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
      exposeHeaders: ["X-Correlation-ID"],
    })
  )
  .use(correlationId)
  // Global error handler — standard shape: { success, error: { code, message } }
  .onError(({ code, error, set, request }) => {
    const corrId = request.headers.get("x-correlation-id") || "unknown";

    // 1. ApiError — thrown intentionally by routes/middleware
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      logger.warn(
        {
          err: error,
          code: error.code,
          statusCode: error.statusCode,
          correlationId: corrId,
        },
        error.message
      );
      return {
        success: false,
        error: { code: error.code, message: error.message },
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, code, correlationId: corrId }, errorMessage);
    const isProd = config.nodeEnv === "production";

    // 3. ElysiaJS built-in error codes
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          success: false,
          error: { code: "VALIDATION_ERROR", message: errorMessage },
        };
      case "NOT_FOUND":
        set.status = 404;
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "The requested resource was not found",
          },
        };
      case "PARSE":
        set.status = 400;
        return {
          success: false,
          error: { code: "PARSE_ERROR", message: "Invalid request body" },
        };
      default:
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: isProd ? "An unexpected error occurred" : errorMessage,
          },
        };
    }
  })
  .onRequest(({ request }) => {
    if (config.nodeEnv === "development") {
      logger.debug(
        { method: request.method, url: request.url },
        "incoming request"
      );
    }
  })
  // Root endpoint
  .get("/", () => ({
    message: "Supplex API",
    version: "1.0.0",
    status: "healthy",
    environment: config.nodeEnv,
  }))
  // Health check routes (with database connectivity check)
  .use(healthRoutes)
  // API routes - Auth
  .group("/api", (app) => {
    // Always register standard auth routes
    app = app.use(registerRoute).use(acceptInvitationRoute);

    if (config.nodeEnv === "development") {
      logger.info("development quick login enabled");
      app = app.use(devListUsersRoute).use(devLoginRoute);
    }

    return app;
  })
  // Other API routes (each has its own /api prefix)
  .use(usersRoutes)
  .use(suppliersRoutes)
  .use(documentsRoutes)
  // .use(checklistsRoutes) // Legacy - removed Migration 0017
  .use(workflowsRoutes)
  .use(adminRoutes)
  .use(formTemplatesRoutes)
  .use(formSubmissionsRoutes)
  .use(documentTemplatesRoutes)
  .use(workflowTemplatesRoutes)
  .use(unsubscribeRoute);

/**
 * Start the server only when running directly (not during tests)
 */
if (config.jwt?.secret) {
  logger.info(
    "JWT verification: JWKS (primary) + HMAC fallback (transition mode)"
  );
} else {
  logger.info("JWT verification: JWKS only");
}

if (import.meta.main) {
  const server = app.listen(config.port, () => {
    const _emailStatus = isRedisEnabled
      ? "📧 Email Worker: Running (concurrency: 5)                   "
      : "📧 Email Worker: Disabled (REDIS_URL not configured)        ";

    logger.info(
      {
        environment: config.nodeEnv,
        port: config.port,
        emailStatus: isRedisEnabled ? "running" : "disabled",
      },
      `Supplex API Server started on http://localhost:${config.port}`
    );
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, "starting graceful shutdown");

    try {
      // Stop accepting new connections
      server.stop();

      logger.info("closing email worker");
      await closeEmailWorker();
      await closeEmailQueue();

      logger.info("closing Redis connection");
      await closeRedisConnection();

      logger.info("graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "error during shutdown");
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal(
      { err: reason, promise: String(promise) },
      "unhandled rejection"
    );
    gracefulShutdown("unhandledRejection");
  });
}

// Export for testing and type safety
export default app;
export type App = typeof app;
