import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import { registerRoute } from "./routes/auth/register";
import { usersRoutes } from "./routes/users";
import { suppliersRoutes } from "./routes/suppliers";
import { documentsRoutes } from "./routes/documents";
import { checklistsRoutes } from "./routes/checklists";
import { workflowsRoutes } from "./routes/workflows";
import { healthRoutes } from "./routes/health";

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
  // API routes
  .group("/api", (app) => app.use(registerRoute))
  .use(usersRoutes)
  .use(suppliersRoutes)
  .use(documentsRoutes)
  .use(checklistsRoutes)
  .use(workflowsRoutes);

/**
 * Start the server only when running directly (not during tests)
 */
if (import.meta.main) {
  const server = app.listen(config.port, () => {
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
