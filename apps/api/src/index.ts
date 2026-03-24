import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
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
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  // Global error handler
  .onError(({ code, error, set }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`[${code}] ${errorMessage}`);

    // Handle different error types
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          error: "Validation Error",
          message: errorMessage,
        };
      case "NOT_FOUND":
        set.status = 404;
        return {
          error: "Not Found",
          message: "The requested resource was not found",
        };
      case "PARSE":
        set.status = 400;
        return {
          error: "Parse Error",
          message: "Invalid request body",
        };
      case "INTERNAL_SERVER_ERROR":
        set.status = 500;
        return {
          error: "Internal Server Error",
          message:
            config.nodeEnv === "production"
              ? "An unexpected error occurred"
              : errorMessage,
        };
      default:
        set.status = 500;
        return {
          error: "Unknown Error",
          message:
            config.nodeEnv === "production"
              ? "An unexpected error occurred"
              : errorMessage,
        };
    }
  })
  // Request logging middleware (development only)
  .onRequest(({ request }) => {
    if (config.nodeEnv === "development") {
      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] ${request.method} ${request.url}`
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
    
    // Conditionally register dev-only auth routes
    if (config.nodeEnv === "development") {
      console.log("⚠️  Development quick login enabled");
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
if (import.meta.main) {
  const server = app.listen(config.port, () => {
    const emailStatus = isRedisEnabled
      ? "📧 Email Worker: Running (concurrency: 5)                   "
      : "📧 Email Worker: Disabled (REDIS_URL not configured)        ";

    // eslint-disable-next-line no-console
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🦊 Supplex API Server                                       ║
║                                                                ║
║   Environment:  ${config.nodeEnv.padEnd(47)} ║
║   Port:         ${String(config.port).padEnd(47)} ║
║   URL:          http://localhost:${config.port}${" ".repeat(27)} ║
║                                                                ║
║   Health Check: http://localhost:${config.port}/health${" ".repeat(21)} ║
║                                                                ║
║   ${emailStatus} ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n⚠️  Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop accepting new connections
      server.stop();

      // Close email worker and queue
      // eslint-disable-next-line no-console
      console.log("🔄 Closing email worker...");
      await closeEmailWorker();
      await closeEmailQueue();

      // Close Redis connection
      // eslint-disable-next-line no-console
      console.log("🔄 Closing Redis connection...");
      await closeRedisConnection();

      // Close database connections, etc.
      // await db.close();

      // eslint-disable-next-line no-console
      console.log("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    // eslint-disable-next-line no-console
    console.error("💥 Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    // eslint-disable-next-line no-console
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown("unhandledRejection");
  });
}

// Export for testing and type safety
export default app;
export type App = typeof app;
