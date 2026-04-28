import { Elysia } from "elysia";
import { mock, type Mock } from "bun:test";
import type { UserRole } from "@supplex/types";
import { isValidRole, type ApiResult } from "@supplex/types";
import { ApiError } from "./errors";

/**
 * Narrows a `users.role` string column read out of Drizzle to the
 * `UserRole` enum that `AuthContext` and RBAC checks expect.
 *
 * Throws (failing the test fixture) when the DB value is unexpectedly
 * off-grid, which is far better than silently funnelling an invalid role
 * through `as UserRole` and getting downstream RBAC drift.
 *
 * This helper lives in `test-utils` so route-level integration tests that
 * seed real `users` rows and need to construct an `AuthContext["user"]`
 * for the test app share a single, type-safe narrowing path.
 */
export function asUserRole(role: string): UserRole {
  if (!isValidRole(role)) {
    throw new Error(`Test fixture inserted invalid role: ${role}`);
  }
  return role;
}

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
 * Shape of the test-side `db` mock returned by {@link createMockDb}.
 *
 * Each top-level write/read entry is a Bun {@link Mock} whose default
 * implementation produces a {@link MockDbChain} resolving to `[]`. Tests can
 * override per-call via `mocks.db.select.mockReturnValue(mockDbChain([row]))`.
 *
 * The shape mirrors the public surface of Drizzle's `db` instance that any
 * test in this repo currently consumes; expand it (here, not at the call
 * site with `as any`) if a route or service starts using a new `db.X(...)`
 * method.
 */
export interface MockDb {
  select: Mock<(..._args: readonly unknown[]) => MockDbChain<unknown>>;
  selectDistinct: Mock<(..._args: readonly unknown[]) => MockDbChain<unknown>>;
  insert: Mock<(..._args: readonly unknown[]) => MockDbChain<unknown>>;
  update: Mock<(..._args: readonly unknown[]) => MockDbChain<unknown>>;
  delete: Mock<(..._args: readonly unknown[]) => MockDbChain<unknown>>;
  execute: Mock<(..._args: readonly unknown[]) => Promise<unknown>>;
  transaction: Mock<
    (callback: (tx: MockDb) => unknown | Promise<unknown>) => Promise<unknown>
  >;
  query: Record<
    string,
    {
      findFirst: Mock<(..._args: readonly unknown[]) => Promise<unknown>>;
      findMany: Mock<(..._args: readonly unknown[]) => Promise<unknown[]>>;
    }
  >;
}

/**
 * Builds a complete, type-safe `db` mock suitable for `mock.module("...lib/db",
 * () => ({ db: createMockDb(...) }))` at test-file scope.
 *
 * **Why this exists.** Bun's `mock.module()` is process-wide and is not
 * cleaned up between test files. Earlier revisions of several test files
 * declared *partial* mocks (e.g. `{ db: { select } }` with no `insert` /
 * `update` / `delete`). When such a mock was registered, any unrelated test
 * file that subsequently imported `db` and called the missing method
 * crashed with `db.X is not a function` in its `beforeAll` hook, collapsing
 * that file's entire `describe` block to a single `(unnamed)` failure.
 *
 * `createMockDb` returns a *complete* shape — every method that any test in
 * the suite touches resolves to an empty `MockDbChain`, so polluted-into
 * test files at worst run their lifecycle hooks against empty arrays
 * instead of crashing. Combined with `query` namespaces stubbed to return
 * `null` / `[]`, the mock is safe to leak across files.
 *
 * Tests that depend on specific db responses can either:
 *   (a) override per-call: `mocks.db.select.mockReturnValueOnce(mockDbChain([row]))`
 *   (b) pass an `overrides` object to seed the default behavior at construction:
 *       `createMockDb({ select: mock(() => mockDbChain([row])) })`
 *
 * The `query` namespace is keyed by table name. Pass `queryTables` to
 * pre-register tables your test reads, e.g. `["tenants", "users"]`. Other
 * tables are still safe to access at runtime — accessing an unknown table
 * lazily creates a stub via the {@link MockDb.query} getter.
 *
 * Usage:
 *
 *     import { createMockDb, mockDbChain } from "../../lib/test-utils";
 *
 *     const mockDb = createMockDb({
 *       queryTables: ["tenants", "users"],
 *     });
 *
 *     mock.module("../../lib/db", () => ({ db: mockDb }));
 *
 *     // later, in a test body:
 *     mockDb.select.mockReturnValueOnce(mockDbChain([{ id: "t-1" }]));
 *     mockDb.query.users.findFirst.mockResolvedValueOnce({ id: "u-1" });
 */
export interface CreateMockDbOptions {
  /** Drizzle query-namespace tables to pre-register. */
  queryTables?: readonly string[];
  /** Optional overrides for individual top-level mocks. */
  overrides?: Partial<{
    select: MockDb["select"];
    selectDistinct: MockDb["selectDistinct"];
    insert: MockDb["insert"];
    update: MockDb["update"];
    delete: MockDb["delete"];
    execute: MockDb["execute"];
    transaction: MockDb["transaction"];
  }>;
}

export function createMockDb(options: CreateMockDbOptions = {}): MockDb {
  const { queryTables = [], overrides = {} } = options;

  const defaultChain = (): MockDbChain<unknown> => mockDbChain<unknown>([]);

  const select = overrides.select ?? (mock(defaultChain) as MockDb["select"]);
  const selectDistinct =
    overrides.selectDistinct ??
    (mock(defaultChain) as MockDb["selectDistinct"]);
  const insert = overrides.insert ?? (mock(defaultChain) as MockDb["insert"]);
  const update = overrides.update ?? (mock(defaultChain) as MockDb["update"]);
  const del = overrides.delete ?? (mock(defaultChain) as MockDb["delete"]);
  const execute =
    overrides.execute ??
    (mock(() => Promise.resolve(undefined as unknown)) as MockDb["execute"]);

  const queryNamespace: MockDb["query"] = {};
  for (const table of queryTables) {
    queryNamespace[table] = {
      findFirst: mock(() =>
        Promise.resolve(null)
      ) as MockDb["query"][string]["findFirst"],
      findMany: mock(() =>
        Promise.resolve([])
      ) as MockDb["query"][string]["findMany"],
    };
  }

  // Lazy proxy: any read of `query.<unknown table>` produces a stub on demand
  // so polluted-into test files don't crash on `db.query.X.findFirst()` when
  // we forgot to enumerate `X` in `queryTables`.
  const queryProxy = new Proxy(queryNamespace, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && !(prop in target)) {
        target[prop] = {
          findFirst: mock(() =>
            Promise.resolve(null)
          ) as MockDb["query"][string]["findFirst"],
          findMany: mock(() =>
            Promise.resolve([])
          ) as MockDb["query"][string]["findMany"],
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  const db: MockDb = {
    select,
    selectDistinct,
    insert,
    update,
    delete: del,
    execute,
    // `transaction` runs the supplied callback with the same mock so that
    // test code wrapping `db.transaction(async (tx) => tx.insert(...)...)`
    // hits the same `select`/`insert`/etc. mocks the test has already set up.
    transaction:
      overrides.transaction ??
      (mock(async (callback: (tx: MockDb) => unknown | Promise<unknown>) => {
        return await callback(db);
      }) as MockDb["transaction"]),
    query: queryProxy,
  };

  return db;
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
export function expectErrResult(result: ApiResult): asserts result is {
  success: false;
  error: { code: string; message: string };
} {
  if (result.success) {
    throw new Error(
      `Expected error result, got success: ${JSON.stringify(result.data)}`
    );
  }
}
