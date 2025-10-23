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
  const apiUrl = process.env.API_URL || "http://localhost:3001";
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    apiUrl,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
  };
}

// Export singleton config instance
export const config = getConfig();
