import { Elysia } from "elysia";
import { ApiError } from "./errors";
import { logger } from "./logger";

const rateLimitLogger = logger.child({ module: "rate-limiter" });

// In-memory rate limiter (for production, use Redis)
interface RateLimitData {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitData>();

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
      if (data.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: any) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Rate limiting middleware for Elysia
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (request) => getClientIP(request) || "unknown",
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return new Elysia()
    .derive(({ request, set }) => {
      const key = keyGenerator(request);
      const now = Date.now();

      // Get or create rate limit data
      let data = rateLimitStore.get(key);
      if (!data || data.resetTime < now) {
        data = {
          count: 0,
          resetTime: now + windowMs,
        };
        rateLimitStore.set(key, data);
      }

      // Check if limit exceeded
      if (data.count >= maxRequests) {
        const resetInSeconds = Math.ceil((data.resetTime - now) / 1000);

        set.headers = {
          "Retry-After": resetInSeconds.toString(),
          "X-RateLimit-Limit": maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": data.resetTime.toString(),
        };

        rateLimitLogger.warn({
          event: "rate_limited",
          key,
          route: request.url,
          method: request.method,
          correlationId: request.headers.get("x-correlation-id"),
          clientIp: getClientIP(request),
          retryAfter: resetInSeconds,
        }, "Rate limit exceeded");

        throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
      }

      // Increment counter (will be decremented if request should be skipped)
      data.count++;

      return {
        rateLimitData: data,
        rateLimitKey: key,
      };
    })
    .onAfterHandle(({ rateLimitData, set }) => {
      // Add rate limit headers without spreading to avoid type conflicts
      set.headers["X-RateLimit-Limit"] = maxRequests.toString();
      set.headers["X-RateLimit-Remaining"] = Math.max(
        0,
        maxRequests - rateLimitData.count
      ).toString();
      set.headers["X-RateLimit-Reset"] = rateLimitData.resetTime.toString();

      // Skip counting successful requests if configured
      const statusCode = typeof set.status === "number" ? set.status : 200;
      if (skipSuccessfulRequests && statusCode < 400 && rateLimitData) {
        rateLimitData.count--;
      }
    })
    .onError(({ error, rateLimitData, set }) => {
      // Skip counting failed requests if configured
      const statusCode = typeof set.status === "number" ? set.status : 500;
      if (skipFailedRequests && statusCode >= 400 && rateLimitData) {
        rateLimitData.count--;
      }

      // Don't modify the error
      return error;
    });
}

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string | null {
  // Check headers for forwarded IP (common in reverse proxy setups)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(",")[0]?.trim() || null;
  }

  // Check other common headers
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // For local development, return a default IP
  return "127.0.0.1";
}

/**
 * Pre-configured rate limiters for common scenarios
 */
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10, // 10 requests per minute for auth endpoints
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 100, // 100 requests per minute for general endpoints
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 5, // 5 requests per minute for sensitive endpoints
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});
