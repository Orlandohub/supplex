/**
 * Shared typed helpers for `apps/web` Vitest suites.
 *
 * The goal is to remove `as any` from test fixtures by giving each
 * recurring shape (loader/action args, mock localStorage, mock fetch
 * responses, Supabase user/session stubs) a precise type that contributors
 * can copy-paste without disabling the type-checker.
 *
 * Each helper performs a single, narrow assertion at a clearly-named
 * boundary, mirroring the convention `apps/web/app/lib/api-helpers.ts`
 * established for production code in SUP-10c/10d.
 */

import { vi } from "vitest";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

/**
 * Build a minimal `LoaderFunctionArgs` for tests.
 *
 * Production loaders only read `request` (and occasionally `params`), so
 * the rest of the React Router context can be stubbed. The single
 * `as unknown as LoaderFunctionArgs` cast is the trust boundary — much
 * narrower than the `as any` it replaces.
 */
export function createLoaderArgs(
  request: Request,
  params: Record<string, string> = {}
): LoaderFunctionArgs {
  return { request, params, context: {} } as unknown as LoaderFunctionArgs;
}

/**
 * Build a minimal `ActionFunctionArgs` for tests. Same boundary contract
 * as {@link createLoaderArgs}; loaders and actions share the same shape
 * but Remix/React Router exports them as nominally distinct types.
 */
export function createActionArgs(
  request: Request,
  params: Record<string, string> = {}
): ActionFunctionArgs {
  return { request, params, context: {} } as unknown as ActionFunctionArgs;
}

/**
 * In-memory `localStorage` substitute for hooks that touch
 * `window.localStorage`. Each method is a `vi.fn()` spy so individual
 * tests can assert call counts/arguments.
 *
 * The structural shape matches the parts of the DOM `Storage` interface
 * that `~/hooks/useAuth` exercises (we don't model `length` or
 * indexed access; both are unused in production code).
 */
export interface MockLocalStorage {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

export function createMockLocalStorage(): MockLocalStorage {
  return {
    getItem: vi.fn(() => null) as ReturnType<typeof vi.fn>,
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
}

/**
 * Minimal Supabase `User` stub for tests that only read `id` / `email`.
 * The real `SupabaseUser` is wide (40+ fields, including `app_metadata`,
 * `user_metadata`, `factors`, etc.); replicating it in fixtures was the
 * driver for most `as any` casts in `useAuth` tests.
 */
export function createMockSupabaseUser(
  overrides: Partial<SupabaseUser> = {}
): SupabaseUser {
  return {
    id: "test-user-id",
    aud: "authenticated",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  } as SupabaseUser;
}

/**
 * Minimal Supabase `Session` stub for tests. The real shape is wide and
 * mostly irrelevant to the auth flow we test (we only read
 * `access_token` / `user`).
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: createMockSupabaseUser(),
    ...overrides,
  } as Session;
}

/**
 * `fetch` mock that also exposes the `preconnect` extension React adds
 * at module-eval time. Without `preconnect`, React's RSC plumbing throws
 * `(global.fetch as any).preconnect is not a function` during tests.
 *
 * Returns the mock so tests can chain `.mockResolvedValueOnce(...)`.
 */
export function createMockFetch(): typeof fetch & {
  preconnect: ReturnType<typeof vi.fn>;
} {
  const fn = vi.fn() as unknown as typeof fetch & {
    preconnect: ReturnType<typeof vi.fn>;
  };
  fn.preconnect = vi.fn();
  return fn;
}
