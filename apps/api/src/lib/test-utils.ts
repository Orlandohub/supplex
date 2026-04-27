import { Elysia } from "elysia";
import { ApiError } from "./errors";

/**
 * Standard error handler for test Elysia instances.
 * Uses duck-typing fallback because Bun's mock.module() can break
 * `instanceof` checks across module boundaries.
 */
function handleTestError({ error, set }: { error: Error; set: any }) {
  if (error instanceof ApiError) {
    set.status = error.statusCode;
    return {
      success: false,
      error: { code: error.code, message: error.message },
    };
  }
  if (error && typeof error === "object" && "statusCode" in error) {
    const e = error as any;
    set.status = e.statusCode;
    return { success: false, error: { code: e.code, message: e.message } };
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
  return new Elysia().onError(handleTestError as any);
}

/**
 * Adds the standard ApiError handler to an existing Elysia instance.
 *
 * The constraint uses fully `any`-typed Elysia generics so that callers can
 * pass test apps that have already been enriched via `.derive(...)` /
 * `.use(...)` without TypeScript flagging the richer generics as not assignable
 * to the default-instantiated `Elysia` constraint.
 */
export function withApiErrorHandler<
  T extends Elysia<any, any, any, any, any, any, any>,
>(app: T): T {
  return app.onError(handleTestError as any) as T;
}
