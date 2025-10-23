/**
 * Application Configuration
 * Centralized configuration for environment variables
 *
 * CRITICAL: Never access process.env directly in application code
 * All environment variables must be accessed through this config object
 */

interface AppConfig {
  apiUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

function getConfig(): AppConfig {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== "undefined";

  // Multi-source environment variable loading (matches supabase-client.ts pattern)
  // 1. Browser: window.ENV (from server via root.tsx)
  // 2. Server/Build: import.meta.env (Vite) or process.env (Node.js)
  const apiUrl = isBrowser
    ? window.ENV?.API_URL || "http://localhost:3001"
    : import.meta.env.API_URL || process.env.API_URL || "http://localhost:3001";

  const nodeEnv = isBrowser
    ? window.ENV?.NODE_ENV || "development"
    : import.meta.env.NODE_ENV || process.env.NODE_ENV || "development";

  return {
    apiUrl,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}

// Export singleton config instance
export const config = getConfig();
