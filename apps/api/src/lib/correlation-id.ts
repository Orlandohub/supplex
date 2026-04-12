/**
 * Correlation ID Middleware
 * Story: 2.2.21 - Workflow Engine Observability
 *
 * Generates or propagates a correlation ID per request.
 * Creates a request-scoped child logger with contextual fields.
 * Logs request completion timing and detects slow requests.
 */

import { Elysia } from "elysia";
import { randomUUID } from "crypto";
import logger from "./logger";

const SLOW_REQUEST_THRESHOLD_MS = 5000;

export const correlationId = new Elysia({ name: "correlation-id" })
  .derive({ as: "global" }, ({ headers, request }) => {
    const id = headers["x-correlation-id"] || randomUUID();
    const url = new URL(request.url);
    const requestLogger = logger.child({
      correlationId: id,
      method: request.method,
      path: url.pathname,
    });
    return {
      correlationId: id,
      requestLogger,
      _requestStart: Date.now(),
    };
  })
  .onAfterHandle(
    { as: "global" },
    ({ correlationId: corrId, requestLogger, _requestStart, set }) => {
      set.headers["x-correlation-id"] = corrId;
      const durationMs = Date.now() - _requestStart;
      const logData = { durationMs, statusCode: (set.status as number) || 200 };
      if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
        requestLogger.warn({ ...logData, slowRequest: true }, "slow request");
      } else {
        requestLogger.info(logData, "request completed");
      }
    }
  );
