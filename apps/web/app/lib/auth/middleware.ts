import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { refreshTokens } from './session.server';

/**
 * Middleware to automatically refresh tokens if they're about to expire
 */
export async function withTokenRefresh<T extends LoaderFunctionArgs | ActionFunctionArgs>(
  args: T,
  callback: (args: T, response?: Response) => Promise<any>
): Promise<any> {
  try {
    // Try the callback first
    return await callback(args);
  } catch (error: any) {
    // If we get a 401 (unauthorized), try refreshing tokens
    if (error?.status === 401) {
      try {
        const { response } = await refreshTokens(args.request);
        
        // Retry the callback with refreshed tokens
        return await callback(args, response);
      } catch (refreshError) {
        // If refresh fails, throw the original error
        throw error;
      }
    }
    
    // For any other error, just throw it
    throw error;
  }
}

/**
 * Higher-order function to wrap loaders with automatic token refresh
 */
export function withAuth<T extends LoaderFunctionArgs>(
  loader: (args: T, response?: Response) => Promise<any>
) {
  return async (args: T) => {
    return await withTokenRefresh(args, loader);
  };
}

/**
 * Higher-order function to wrap actions with automatic token refresh
 */
export function withAuthAction<T extends ActionFunctionArgs>(
  action: (args: T, response?: Response) => Promise<any>
) {
  return async (args: T) => {
    return await withTokenRefresh(args, action);
  };
}

/**
 * Utility to check if a token is about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;
  return expiresAt - now <= fiveMinutes;
}

/**
 * Background token refresh utility (for client-side)
 */
export function scheduleTokenRefresh(expiresAt: number, refreshCallback: () => Promise<void>) {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilRefresh = Math.max(0, (expiresAt - now - 300) * 1000); // Refresh 5 min before expiry
  
  setTimeout(async () => {
    try {
      await refreshCallback();
    } catch (error) {
      console.error('Background token refresh failed:', error);
      // Redirect to login or handle error appropriately
      window.location.href = '/login';
    }
  }, timeUntilRefresh);
}
