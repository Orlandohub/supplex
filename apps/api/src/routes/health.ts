import { Elysia } from "elysia";
import { db } from "@supplex/db";
import { sql } from "drizzle-orm";

/**
 * Backend Health Check Routes
 *
 * Provides health check endpoints for monitoring and deployment verification.
 * Tests connectivity to critical services (database, Redis in future).
 *
 * Used by:
 * - Fly.io health checks
 * - Vercel health monitoring
 * - Sentry uptime monitoring
 * - CI/CD deployment verification
 */
export const healthRoutes = new Elysia({ prefix: "/api" }).get(
  "/health",
  async ({ set }) => {
    const healthCheck = {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      service: "api",
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: "unknown" as "connected" | "disconnected" | "unknown",
      },
    };

    // Set cache control headers for all responses
    set.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    set.headers["Pragma"] = "no-cache";

    // Test database connection
    try {
      await db.execute(sql`SELECT 1 as health_check`);
      healthCheck.checks.database = "connected";
    } catch (error) {
      healthCheck.checks.database = "disconnected";
      healthCheck.status = "error";
      set.status = 503;

      // Return error response with 503 Service Unavailable
      return {
        ...healthCheck,
        error:
          error instanceof Error ? error.message : "Database connection failed",
      };
    }

    // Return 200 OK if all checks pass
    return healthCheck;
  }
);
