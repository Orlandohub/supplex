import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";
import { config } from "./config";
import { toast } from "sonner";

/**
 * Eden Treaty Client Configuration
 * Provides end-to-end type safety for API calls
 */

const API_URL = config.apiUrl;

/**
 * Custom fetch wrapper that handles auth-related HTTP errors centrally.
 *
 *  - 401 (any): clear Zustand auth state, redirect to /login.
 *  - 403:       show an "Access Denied" toast; no redirect.
 *
 * Login, registration, and password-recovery flows use their own fetch paths
 * and are exempt — they never go through this wrapper.
 *
 * Wired into Eden Treaty via the `fetcher` config slot (custom fetch
 * implementation), NOT `fetch` (default RequestInit options). Passing this
 * function to `fetch` was a silent no-op — Eden destructured it as
 * `let { fetch: _ } = config; ...{ ..._, ...}` and the spread of a function
 * dropped it, falling back to `globalThis.fetch`. The `as any` previously
 * required to satisfy that wrong slot was masking a real production bug:
 * 401/403 redirects never fired. See docs/troubleshooting.md.
 *
 * The single `as typeof fetch` cast (NOT `as any`) bridges a TypeScript
 * platform-typing quirk: `bun-types` leaks transitively via Elysia's `.d.ts`
 * and augments the global `fetch` with `preconnect()` and `BunFetchRequestInit`,
 * neither of which Eden uses at runtime. Asserting `typeof fetch` here is
 * narrower and safer than `as any`: the inner arrow function's parameter
 * types still enforce a valid fetch-shaped contract.
 */
const fetchWithAuthErrorHandler = (async (
  input: globalThis.RequestInfo | URL,
  init?: globalThis.RequestInit
): Promise<Response> => {
  const response = await fetch(input, init);

  if (response.status === 401) {
    handleUnauthorized();
    return response;
  }

  if (response.status === 403) {
    toast.error("Access denied — you don't have permission for this action.");
    return response;
  }

  return response;
}) as typeof fetch;

function handleUnauthorized(): void {
  if (typeof window === "undefined") return;

  // Prevent redirect loops when already on the login page
  if (window.location.pathname === "/login") return;

  // Clear Zustand auth state (dynamic import avoids circular deps at module init)
  import("~/hooks/useAuth")
    .then(({ useAuth }) => useAuth.getState().clearAuth())
    .catch(() => {
      try {
        localStorage.removeItem("supplex-auth");
      } catch {
        /* noop */
      }
    });

  toast.error("Your session has expired. Redirecting to login…", {
    duration: 3000,
  });

  setTimeout(() => {
    window.location.href = "/login";
  }, 1500);
}

/**
 * Create Eden Treaty client for server-side API calls (Remix loaders/actions).
 * Requires authentication token from the request.
 *
 * On the server, `handleUnauthorized()` is a no-op (no `window`), so 401/403
 * detection still propagates to the loader without browser-only side effects.
 */
export function createEdenTreatyClient(token: string) {
  return treaty<App>(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    fetcher: fetchWithAuthErrorHandler,
  });
}

/**
 * Create Eden Treaty client for client-side API calls.
 * Token should be obtained from the current session.
 */
export function createClientEdenTreatyClient(token: string) {
  return treaty<App>(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    fetcher: fetchWithAuthErrorHandler,
  });
}
