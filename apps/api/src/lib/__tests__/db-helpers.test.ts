import { describe, test, expect } from "bun:test";
import {
  insertOneOrThrow,
  selectFirstOrThrow,
  selectFirst,
} from "../db-helpers";
import { ApiError } from "../errors";
import type { DbOrTx } from "@supplex/db";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * Minimal mock of the chained `tx.insert(table).values(values).returning()`
 * surface we use. Returning whatever `rows` we pass in lets the helper's
 * empty-array branch be exercised without touching a real database.
 */
function makeMockTx(rows: unknown[]): DbOrTx {
  const chain = {
    values: () => chain,
    returning: async () => rows,
  };
  return {
    insert: () => chain,
  } as unknown as DbOrTx;
}

/**
 * Drizzle's `getTableName` reads `table[Table.Symbol.Name]`. Constructing
 * a real PgTable instance pulls in the Postgres dialect; for these unit
 * tests we only need the helper to be able to format an error message,
 * so a stub object satisfies the call.
 */
function makeMockTable(name: string): PgTable {
  // The Symbol used by drizzle-orm is exported indirectly via Table; we
  // reach into the same well-known key by getting it off `getTableName`'s
  // contract: the implementation reads `table[Symbol(name)]`. Easiest
  // robust path is to stub by setting an own property under the same
  // symbol key, which `getTableName` looks up.
  const sym = Object.getOwnPropertySymbols(
    Object.create({ [Symbol.for("drizzle:Name")]: "" })
  ).find((s) => s.description === "drizzle:Name");
  return {
    [sym ?? Symbol.for("drizzle:Name")]: name,
  } as unknown as PgTable;
}

describe("db-helpers", () => {
  describe("insertOneOrThrow", () => {
    test("returns the first inserted row", async () => {
      const inserted = { id: "row-1", name: "test" };
      const tx = makeMockTx([inserted]);
      const table = makeMockTable("test_table");

      const result = await insertOneOrThrow(tx, table, {
        name: "test",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock values shape
      } as any);

      expect(result).toEqual(inserted);
    });

    test("throws Errors.internal when the insert returns no rows", async () => {
      const tx = makeMockTx([]);
      const table = makeMockTable("test_table");

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock values shape
        await insertOneOrThrow(tx, table, { name: "test" } as any);
        expect.unreachable("insertOneOrThrow should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
        expect((err as ApiError).code).toBe("INTERNAL_SERVER_ERROR");
      }
    });
  });

  describe("selectFirstOrThrow", () => {
    test("returns the first row when the query has results", async () => {
      const row = { id: "row-1" };
      const result = await selectFirstOrThrow(Promise.resolve([row]));
      expect(result).toEqual(row);
    });

    test("throws Errors.notFound with default message when empty", async () => {
      try {
        await selectFirstOrThrow<{ id: string }>(Promise.resolve([]));
        expect.unreachable("selectFirstOrThrow should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).code).toBe("NOT_FOUND");
        expect((err as ApiError).message).toBe("Resource not found");
      }
    });

    test("uses the provided notFoundMessage when empty", async () => {
      try {
        await selectFirstOrThrow<{ id: string }>(
          Promise.resolve([]),
          "User not found"
        );
        expect.unreachable("selectFirstOrThrow should have thrown");
      } catch (err) {
        expect((err as ApiError).message).toBe("User not found");
      }
    });
  });

  describe("selectFirst", () => {
    test("returns the first row when present", async () => {
      const row = { id: "row-1" };
      const result = await selectFirst(Promise.resolve([row]));
      expect(result).toEqual(row);
    });

    test("returns null when the query is empty", async () => {
      const result = await selectFirst<{ id: string }>(Promise.resolve([]));
      expect(result).toBeNull();
    });
  });
});
