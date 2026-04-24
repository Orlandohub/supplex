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
 */
async function fetchWithAuthErrorHandler(
  input: globalThis.RequestInfo | URL,
  init?: globalThis.RequestInit
): Promise<Response> {
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
}

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
 * Create Eden Treaty client for server-side API calls (Remix loaders/actions)
 * Requires authentication token from the request
 */
export function createEdenTreatyClient(token: string) {
  return treaty<App>(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    fetch: fetchWithAuthErrorHandler as any,
  });
}

/**
 * Create Eden Treaty client for client-side API calls
 * Token should be obtained from the current session
 */
export function createClientEdenTreatyClient(token: string) {
  return treaty<App>(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    fetch: fetchWithAuthErrorHandler as any,
  });
}
