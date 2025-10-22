import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";

/**
 * Eden Treaty Client Configuration
 * Provides end-to-end type safety for API calls
 */

const API_URL = process.env.API_URL || "http://localhost:3001";

/**
 * Create Eden Treaty client for server-side API calls (Remix loaders/actions)
 * Requires authentication token from the request
 */
export function createEdenTreatyClient(token: string) {
  return treaty<App>(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
  });
}

