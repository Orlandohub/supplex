/**
 * Shared helpers for narrowing Eden Treaty responses in `apps/web`.
 *
 * Treaty puts the response body in `response.data` for 2xx responses and
 * `response.error.value` for non-2xx (status outside 200-299). The
 * server contract is the `ApiResult<T>` discriminated union from
 * `@supplex/types`, so loaders, actions, and components can switch on
 * `result.success` to narrow `result.data` vs `result.error`.
 *
 * These helpers replace the per-call-site `as any`, `as { ... }`, and
 * `as unknown as { ... }` patterns that the codebase accumulated. Each
 * helper performs exactly ONE narrow assertion at the trust boundary
 * (the runtime envelope shape is enforced by `apps/api`).
 */

import type { ApiResult } from "@supplex/types";

/**
 * Treaty error envelope as exposed on the client.
 *
 * The shape comes from `apps/api/src/lib/test-utils.ts:handleTestError`,
 * which formats every non-2xx response as `{ success: false, error: { code,
 * message } }`. Treaty wraps that in `{ status, value }`.
 */
export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message?: string;
    /**
     * Optional route-specific structured payload (e.g. validation errors
     * carrying `missingFields: string[]`). The API's `Errors.foo()`
     * helpers in `apps/api/src/lib/errors.ts` accept arbitrary `details`,
     * so this is intentionally typed as a free-form record.
     */
    details?: Record<string, unknown>;
  };
}

/**
 * Extract the typed `ApiErrorBody` from a Treaty `response.error`.
 *
 * Returns `null` when there is no error (i.e. the response was 2xx).
 *
 * Usage:
 * ```ts
 * const response = await client.api.workflows({ id }).get();
 * const err = errorBody(response.error);
 * if (err) throw new Response(err.error.message, { status: response.status });
 * ```
 */
export function errorBody(
  error: { value: unknown } | null
): ApiErrorBody | null {
  if (!error) return null;
  return error.value as ApiErrorBody;
}

/**
 * Narrow an Eden Treaty function-call return value to the union variant
 * exposing the property `K`.
 *
 * Treaty's path inference collapses Elysia routes that share the same
 * dynamic-segment position into a union — for example, `/:id` (GET, PATCH,
 * DELETE), `/:id/publish` (PATCH), and `/:templateId/sections` (POST) all
 * mounted under `/api/form-templates` collapse into one function-call
 * signature whose return type is a union of all per-variant route shapes.
 * Accessing a property that is unique to one variant (e.g. `publish` lives
 * only on the `/:id`-bearing branch) therefore needs explicit narrowing.
 *
 * This is the same pattern that SUP-9c established for `apps/api` tests.
 * The runtime value is unchanged; the helper is purely a typed assertion.
 *
 * Usage:
 * ```ts
 * const route = client.api["form-templates"]({ id, templateId: id });
 * const response = await withTreatyBranch(route, "publish").publish.patch();
 * ```
 */
export function withTreatyBranch<T, K extends string>(
  route: T,
  _key: K
): Extract<T, Record<K, unknown>> {
  return route as Extract<T, Record<K, unknown>>;
}

/**
 * Extract the typed `ApiResult<T>` data envelope from a Treaty `response.data`.
 *
 * Treaty already validates the success-path shape against the route's
 * inferred response schema, but loaders consuming these responses still need
 * to narrow `success: true | false` for the discriminated-union to work.
 *
 * Returns `null` when `data` is `null` (Treaty returns `null` on non-2xx).
 *
 * Usage:
 * ```ts
 * const response = await client.api.suppliers({ id }).get();
 * const result = okBody<Supplier>(response.data);
 * if (!result || !result.success) throw new Response("Not Found", { status: 404 });
 * return { supplier: result.data };
 * ```
 */
export function okBody<T>(data: unknown): ApiResult<T> | null {
  if (data == null) return null;
  return data as ApiResult<T>;
}
