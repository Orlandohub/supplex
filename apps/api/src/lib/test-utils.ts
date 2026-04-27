import { Elysia } from "elysia";
import { ApiError } from "./errors";

/**
 * Mutable subset of Elysia's `set` parameter that the test error handler
 * needs. We model only the fields we actually mutate (and accept `undefined`
 * to stay assignment-compatible with Elysia's full `set` type, which marks
 * `status` optional).
 */
interface ElysiaSetLike {
  status?: number | string;
}

interface ApiErrorLike {
  statusCode: number;
  code?: string;
  message?: string;
}

function isApiErrorLike(value: unknown): value is ApiErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "statusCode" in value &&
    typeof (value as { statusCode: unknown }).statusCode === "number"
  );
}

/**
 * Standard error handler for test Elysia instances.
 * Uses duck-typing fallback because Bun's mock.module() can break
 * `instanceof` checks across module boundaries. Accepts `unknown` because
 * Elysia's error parameter is a wide union (Error | custom status responses)
 * and we narrow defensively.
 */
function handleTestError({
  error,
  set,
}: {
  error: unknown;
  set: ElysiaSetLike;
}) {
  if (error instanceof ApiError) {
    set.status = error.statusCode;
    return {
      success: false,
      error: { code: error.code, message: error.message },
    };
  }
  if (isApiErrorLike(error)) {
    set.status = error.statusCode;
    return {
      success: false,
      error: { code: error.code, message: error.message },
    };
  }
  set.status = 500;
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } };
}

/**
 * Creates a test Elysia app with the ApiError handler pre-registered.
 * Use instead of `new Elysia()` in tests.
 */
export function createTestApp() {
  return new Elysia().onError(handleTestError);
}

/**
 * Minimal contract describing the only Elysia method this helper actually
 * touches. Defining the constraint structurally lets callers pass test apps
 * that have been enriched via `.derive(...)` / `.use(...)` without leaking
 * Elysia's full generics into the helper signature.
 */
type AppWithOnError = {
  onError: (handler: typeof handleTestError) => unknown;
};

/**
 * Adds the standard ApiError handler to an existing Elysia instance.
 *
 * Callers may pass test apps that have been enriched via `.derive(...)` /
 * `.use(...)`; the structural `AppWithOnError` constraint ensures we only
 * touch `.onError(...)` and don't leak richer Elysia generics here.
 */
export function withApiErrorHandler<T extends AppWithOnError>(app: T): T {
  app.onError(handleTestError);
  return app;
}
