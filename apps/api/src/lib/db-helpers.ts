/**
 * Typed database helpers — replace the `(await db.X(...).returning())[0]!`
 * non-null-assertion pattern with shaped, throwing wrappers.
 *
 * Why: `noUncheckedIndexedAccess` is enabled at the workspace level
 * (`packages/config/tsconfig.base.json`), so raw `[0]!` after a Drizzle
 * `.returning()` or `.limit(1)` query bypasses TypeScript's empty-array
 * check. If the query returns zero rows the call site explodes with a
 * generic `TypeError: Cannot read property of undefined` instead of a
 * typed, recognisable error path.
 *
 * The three helpers below wrap the three patterns that show up at every
 * call site in `apps/api/src/**`:
 *
 *  - `insertOneOrThrow(tx, table, values)` — performs the insert and
 *    returns the single inserted row. Throws `Errors.internal(...)` if
 *    the database somehow returns zero rows (a real bug, not a missing
 *    entity).
 *
 *  - `selectFirstOrThrow(query, message?)` — awaits a select query that
 *    is expected to return at least one row. Throws `Errors.notFound(...)`
 *    when the query returns empty. Use this when an empty result means
 *    the caller asked for an entity that does not exist.
 *
 *  - `selectFirst(query)` — awaits a select query that may return empty.
 *    Returns `T | null` so the caller can branch explicitly. Use this
 *    when an empty result is expected (existence check, optional lookup,
 *    etc.).
 *
 * The `Errors.internal` / `Errors.notFound` choices line up with the
 * existing `apps/api/src/lib/errors.ts` envelope so route handlers don't
 * need to translate a custom error class into the API's response shape.
 *
 * Tests can keep raw `[0]!` only when the array length is asserted
 * earlier in the same test (e.g. `expect(rows).toHaveLength(1);`) and
 * the assertion has a same-line `// eslint-disable-next-line` justifying
 * comment per the SUP-13 lint policy.
 */

import { getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DbOrTx } from "@supplex/db";
import { Errors } from "./errors";

/**
 * Insert a single row into `table` and return it. Throws when the
 * database returns zero rows from `.returning()` (defensive — should
 * never happen with a successful insert).
 */
export async function insertOneOrThrow<TTable extends PgTable>(
  tx: DbOrTx,
  table: TTable,
  values: TTable["$inferInsert"]
): Promise<TTable["$inferSelect"]> {
  const rows = await tx.insert(table).values(values).returning();
  const first = rows[0];
  if (!first) {
    throw Errors.internal(
      `insertOneOrThrow: insert into ${getTableName(table)} returned no rows`
    );
  }
  return first as TTable["$inferSelect"];
}

/**
 * Await a select query and return the first row. Throws
 * `Errors.notFound(message)` if the query returns empty.
 */
export async function selectFirstOrThrow<T>(
  query: Promise<T[]>,
  notFoundMessage = "Resource not found"
): Promise<T> {
  const rows = await query;
  const first = rows[0];
  if (!first) {
    throw Errors.notFound(notFoundMessage);
  }
  return first;
}

/**
 * Await a select query and return the first row, or `null` if empty.
 * Use when an empty result is an expected branch in the caller.
 */
export async function selectFirst<T>(query: Promise<T[]>): Promise<T | null> {
  const rows = await query;
  return rows[0] ?? null;
}
