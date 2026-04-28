import { Elysia } from "elysia";
import type { ApiResult } from "@supplex/types";
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

/**
 * Typed stand-in for a Drizzle query-builder chain in unit tests.
 *
 * Drizzle's chained query APIs (`db.select().from().where().limit()`,
 * `db.insert().values().returning()`, `db.update().set().where().returning()`,
 * etc.) are thenable at every step — awaiting at any depth produces the same
 * row array. This class satisfies that contract without leaking `any` into
 * the test surface, so a single call replaces the nested
 * `vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({...}) })`
 * boilerplate that has accumulated across the suite.
 *
 * Each chain method returns `this`, allowing arbitrary chain depth without
 * additional setup. The class implements `PromiseLike<T[]>`, so `await chain`
 * — at any depth — resolves to the supplied `rows` array.
 *
 * Usage:
 *
 *   const chain = mockDbChain<User>([userRow]);
 *   db.select.mockReturnValue(chain);
 *   const result = await db.select().from(users).where(eq(...)).limit(1);
 *   // result === [userRow]
 *
 *   // Inserts and updates work the same way:
 *   db.insert.mockReturnValue(mockDbChain<User>([newUser]));
 *   const inserted = await db.insert(users).values({...}).returning();
 *   // inserted === [newUser]
 *
 * The supported method list is the public Drizzle chainable surface area.
 * If a test exercises a chain method that is not enumerated here, add it
 * to this class rather than reaching for `as any` at the call site.
 */
export class MockDbChain<T> implements PromiseLike<T[]> {
  private readonly rows: T[];

  constructor(rows: T[]) {
    this.rows = rows;
  }

  from = (..._args: readonly unknown[]): this => this;
  where = (..._args: readonly unknown[]): this => this;
  leftJoin = (..._args: readonly unknown[]): this => this;
  innerJoin = (..._args: readonly unknown[]): this => this;
  rightJoin = (..._args: readonly unknown[]): this => this;
  fullJoin = (..._args: readonly unknown[]): this => this;
  orderBy = (..._args: readonly unknown[]): this => this;
  limit = (..._args: readonly unknown[]): this => this;
  offset = (..._args: readonly unknown[]): this => this;
  groupBy = (..._args: readonly unknown[]): this => this;
  having = (..._args: readonly unknown[]): this => this;
  values = (..._args: readonly unknown[]): this => this;
  set = (..._args: readonly unknown[]): this => this;
  returning = (..._args: readonly unknown[]): this => this;
  execute = (..._args: readonly unknown[]): this => this;
  for = (..._args: readonly unknown[]): this => this;
  onConflictDoNothing = (..._args: readonly unknown[]): this => this;
  onConflictDoUpdate = (..._args: readonly unknown[]): this => this;

  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?:
      | ((value: T[]) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.rows).then(onfulfilled, onrejected);
  }
}

/**
 * Convenience constructor for {@link MockDbChain}.
 *
 * Prefer this in tests over instantiating the class directly:
 *
 *   db.select.mockReturnValue(mockDbChain<User>([userRow]));
 */
export function mockDbChain<T>(rows: T[]): MockDbChain<T> {
  return new MockDbChain(rows);
}

/**
 * Asserts that a parsed API response is the success branch and that `data`
 * is present, narrowing `result` to `{ success: true; data: T }` for the
 * remainder of the test.
 *
 * Throws (failing the test) with a descriptive message that includes the
 * server-provided error code+message when the response is the error branch,
 * which is much more useful than a bare `expect(result.success).toBe(true)`
 * failure.
 *
 * Usage:
 *
 *   const result = (await response.json()) as ApiResult<MyData>;
 *   expectOkResult(result);
 *   expect(result.data.field).toBe("value"); // result.data narrowed to MyData
 */
export function expectOkResult<T>(
  result: ApiResult<T>
): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(
      `Expected success result, got error ${result.error.code}: ${result.error.message}`
    );
  }
  if (result.data === undefined) {
    throw new Error(
      "Expected success result with `data`, but `data` was undefined. Use `expectOkVoidResult` for void operations."
    );
  }
}

/**
 * Asserts that a parsed API response is the success branch *without* `data`,
 * narrowing `result` to `{ success: true }`. Use for DELETE-style routes
 * that return `{ success: true }` with no payload.
 */
export function expectOkVoidResult(
  result: ApiResult
): asserts result is { success: true } {
  if (!result.success) {
    throw new Error(
      `Expected success result, got error ${result.error.code}: ${result.error.message}`
    );
  }
}

/**
 * Asserts that a parsed API response is the error branch, narrowing
 * `result` to the error variant for the remainder of the test.
 *
 * Usage:
 *
 *   const result = (await response.json()) as ApiResult<unknown>;
 *   expectErrResult(result);
 *   expect(result.error.code).toBe("VALIDATION_ERROR");
 */
export function expectErrResult(
  result: ApiResult
): asserts result is {
  success: false;
  error: { code: string; message: string };
} {
  if (result.success) {
    throw new Error(
      `Expected error result, got success: ${JSON.stringify(result.data)}`
    );
  }
}
