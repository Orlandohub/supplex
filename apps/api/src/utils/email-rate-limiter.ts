import { redisConnection } from "../queue/redis-connection";

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
      console.log(
        `[RATE LIMIT] User ${userId} exceeded 10 emails/hour (count: ${count})`
      );
      return false; // Rate limit exceeded
    }

    console.log(
      `[RATE LIMIT] User ${userId} email count: ${count}/10 for hour ${hour}`
    );
    return true; // Allow email
  } catch (error) {
    console.error(`[RATE LIMIT] Error checking rate limit:`, error);
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
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `email_rate_limit:${userId}:${hour}`;
    const count = await redisConnection.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error(`[RATE LIMIT] Error getting email count:`, error);
    return 0;
  }
}

/**
 * Reset email count for user (admin function)
 *
 * @param userId - User ID to reset
 */
export async function resetEmailRateLimit(userId: string): Promise<void> {
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `email_rate_limit:${userId}:${hour}`;
    await redisConnection.del(key);
    console.log(`[RATE LIMIT] Reset email count for user ${userId}`);
  } catch (error) {
    console.error(`[RATE LIMIT] Error resetting rate limit:`, error);
  }
}
