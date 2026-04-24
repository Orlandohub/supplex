/**
 * Structured Logger Module
 * Story: 2.2.21 - Workflow Engine Observability
 *
 * Pino JSON logger configured for Bun runtime.
 * Pretty printing is handled via pipe in the dev script (not pino transport).
 */

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: { service: "supplex-api", env: process.env.NODE_ENV },
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Extract client IP from request headers (reverse-proxy aware).
 * Precedence: x-forwarded-for → x-real-ip → null
 */
export function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0];
    if (first) return first.trim();
  }
  return request.headers.get("x-real-ip");
}

export default logger;
