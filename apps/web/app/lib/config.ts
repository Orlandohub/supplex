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

  // In browser, use window.ENV or fallback to defaults
  // In server, use process.env
  const apiUrl = isBrowser
    ? window.ENV?.API_URL || "http://localhost:3001"
    : process.env.API_URL || "http://localhost:3001";

  const nodeEnv = isBrowser
    ? window.ENV?.NODE_ENV || "development"
    : process.env.NODE_ENV || "development";

  return {
    apiUrl,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}

// Export singleton config instance
export const config = getConfig();
