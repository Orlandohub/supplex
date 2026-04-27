/**
 * Type-safe helpers for working with caught errors typed as `unknown`.
 *
 * These utilities replace ad-hoc `catch (error: any)` patterns with narrow,
 * intentional access to error properties (Postgres driver errors, ApiError-shaped
 * errors crossing module boundaries, generic Error message/name extraction).
 */

/**
 * Postgres / pg / postgres-js driver errors expose at least a string `code`
 * and optionally a `constraint` and `message`. We narrow defensively on
 * shape rather than depending on a specific driver class.
 */
export interface PostgresErrorLike {
  code: string;
  constraint?: string;
  message?: string;
}

/**
 * `ApiError` instances thrown across module / transaction boundaries can lose
 * their prototype identity (so `instanceof ApiError` returns false) while still
 * carrying the same shape. This guard lets call sites duck-type check and
 * rethrow them unchanged.
 */
export interface ApiErrorLike {
  statusCode: number;
  code: string;
  message?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function isPostgresError(error: unknown): error is PostgresErrorLike {
  return isObject(error) && typeof error.code === "string";
}

export function isApiErrorLike(error: unknown): error is ApiErrorLike {
  return (
    isObject(error) &&
    typeof error.statusCode === "number" &&
    typeof error.code === "string"
  );
}

/**
 * Attempts to extract a `.message` string from an unknown error.
 * Returns `undefined` if the value is not an `Error` and has no string message.
 */
export function tryGetErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (isObject(error) && typeof error.message === "string")
    return error.message;
  if (typeof error === "string") return error;
  return undefined;
}

/**
 * Like {@link tryGetErrorMessage} but always returns a string,
 * defaulting to `"Unknown error"` when no message can be derived.
 */
export function getErrorMessage(error: unknown): string {
  return tryGetErrorMessage(error) ?? "Unknown error";
}

export function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  if (isObject(error) && typeof error.name === "string") return error.name;
  return undefined;
}
