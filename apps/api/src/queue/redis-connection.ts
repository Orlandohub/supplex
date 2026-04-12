import IORedis from "ioredis";
import { logger } from "../lib/logger";

const redisLogger = logger.child({ module: "redis" });

const redisUrl = process.env.REDIS_URL || "";

export const isRedisEnabled = !!redisUrl;

if (!redisUrl) {
  redisLogger.warn("REDIS_URL not configured — queue and rate limiting will not work");
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
    redisLogger.info("Connected successfully");
  });

  redisConnection.on("error", (error) => {
    redisLogger.error({ err: error }, "Connection error");
  });

  redisConnection.on("close", () => {
    redisLogger.info("Connection closed");
  });
}

/**
 * Graceful shutdown - close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisLogger.info("Connection closed gracefully");
  }
}
