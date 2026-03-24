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
 * Error response structure from API
 */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
}

/**
 * Custom fetch wrapper to handle token expiry
 */
async function fetchWithTokenExpiryHandler(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // Check for token expiry on 401 responses
  if (response.status === 401) {
    try {
      // Clone the response to avoid consuming the body
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();

      // Try to parse as JSON
      let errorData: ApiErrorResponse;
      try {
        errorData = JSON.parse(text);
      } catch {
        // If parsing fails, check if it contains TOKEN_EXPIRED in the raw text
        if (text.includes('"code":"TOKEN_EXPIRED"')) {
          redirectToLogin();
        }
        return response;
      }

      // Check for TOKEN_EXPIRED error code
      if (errorData?.error?.code === "TOKEN_EXPIRED") {
        redirectToLogin();
      }
    } catch (error) {
      console.error("[API Client] Error checking token expiry:", error);
    }
  }

  return response;
}

/**
 * Redirect to login page with friendly message
 */
function redirectToLogin(): void {
  console.log("[API Client] Token expired, redirecting to login...");

  // Only perform redirect in browser environment
  if (typeof window !== "undefined") {
    // Show user-friendly toast message
    toast.error("Your session has expired. Redirecting to login...", {
      duration: 3000,
    });

    // Brief delay to allow the toast message to be seen
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  }
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
    fetch: fetchWithTokenExpiryHandler,
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
    fetch: fetchWithTokenExpiryHandler,
  });
}
