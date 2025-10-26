import IORedis from "ioredis";

/**
 * Shared Redis Connection
 *
 * Single Redis connection instance used by:
 * - BullMQ Queue
 * - BullMQ Worker
 * - Email Rate Limiter
 *
 * This prevents connection pool exhaustion from multiple Redis instances.
 */

// REDIS_URL format: redis://default:password@host:port
const redisUrl = process.env.REDIS_URL || "";

export const isRedisEnabled = !!redisUrl;

if (!redisUrl) {
  console.warn(
    "[REDIS] REDIS_URL not configured. Queue and rate limiting will not work."
  );
}

// Single shared Redis connection (only create if Redis is configured)
export const redisConnection = isRedisEnabled
  ? new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      enableOfflineQueue: false,
    })
  : null;

// Connection event handlers (only if Redis is enabled)
if (redisConnection) {
  redisConnection.on("connect", () => {
    console.log("[REDIS] Connected successfully");
  });

  redisConnection.on("error", (error) => {
    console.error("[REDIS] Connection error:", error);
  });

  redisConnection.on("close", () => {
    console.log("[REDIS] Connection closed");
  });
}

/**
 * Graceful shutdown - close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    console.log("[REDIS] Connection closed gracefully");
  }
}
