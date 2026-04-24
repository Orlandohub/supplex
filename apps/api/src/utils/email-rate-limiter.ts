import { redisConnection } from "../queue/redis-connection";
import { logger } from "../lib/logger";

const rateLimitLogger = logger.child({ module: "email-rate-limiter" });

/**
 * Email Rate Limiter
 *
 * Uses Redis to track email count per user per hour
 * - Key: email_rate_limit:{user_id}:{hour}
 * - TTL: 3600 seconds (1 hour)
 * - Limit: 10 emails per user per hour
 */

/**
 * Check if user has exceeded email rate limit
 *
 * @param userId - User ID to check
 * @returns True if rate limit NOT exceeded (email can be sent), false if exceeded
 */
export async function checkEmailRateLimit(userId: string): Promise<boolean> {
  if (!redisConnection) return true;
  try {
    // Get current hour in ISO format (e.g., "2025-10-25T14")
    const hour = new Date().toISOString().slice(0, 13);
    const key = `email_rate_limit:${userId}:${hour}`;

    // Increment counter
    const count = await redisConnection.incr(key);

    // Set TTL on first increment
    if (count === 1) {
      await redisConnection.expire(key, 3600); // 1 hour
    }

    // Check if limit exceeded
    if (count > 10) {
      rateLimitLogger.warn(
        { userId, count, hour },
        "User exceeded email rate limit"
      );
      return false;
    }

    rateLimitLogger.debug(
      { userId, count, hour },
      "Email rate limit check passed"
    );
    return true; // Allow email
  } catch (error) {
    rateLimitLogger.error(
      { err: error, userId },
      "Error checking email rate limit"
    );
    // On Redis error, allow email to prevent blocking legitimate emails
    return true;
  }
}

/**
 * Get current email count for user in current hour
 *
 * @param userId - User ID to check
 * @returns Current email count
 */
export async function getEmailCount(userId: string): Promise<number> {
  if (!redisConnection) return 0;
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `email_rate_limit:${userId}:${hour}`;
    const count = await redisConnection.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    rateLimitLogger.error({ err: error, userId }, "Error getting email count");
    return 0;
  }
}

/**
 * Reset email count for user (admin function)
 *
 * @param userId - User ID to reset
 */
export async function resetEmailRateLimit(userId: string): Promise<void> {
  if (!redisConnection) return;
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `email_rate_limit:${userId}:${hour}`;
    await redisConnection.del(key);
    rateLimitLogger.info({ userId }, "Email rate limit reset");
  } catch (error) {
    rateLimitLogger.error(
      { err: error, userId },
      "Error resetting email rate limit"
    );
  }
}
