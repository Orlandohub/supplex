/**
 * Application Configuration
 * Centralized configuration management following best practices
 */

import { z } from "zod";
import { logger } from "./lib/logger";

// Configuration schema with validation
const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  // Supabase
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
    serviceRoleKey: z.string().min(1),
  }),

  // Database
  database: z.object({
    url: z.string().min(1),
  }),

  // CORS
  cors: z.object({
    origin: z.union([
      z.string(),
      z.array(z.string()),
      z.boolean(),
    ]).default("http://localhost:5173"),
  }),

  // JWT — secret is optional; JWKS (from supabase.url) is the primary verification method (SEC-006)
  jwt: z.object({
    secret: z.string().min(32).optional(),
  }).optional(),

  // Optional: Redis
  redis: z
    .object({
      url: z.string().optional(),
    })
    .optional(),
});

/**
 * Load and validate configuration from environment variables.
 * Accepts an optional env override for testing (Bun test freezes NODE_ENV).
 */
export function loadConfig(envOverride?: Record<string, string | undefined>) {
  const env = envOverride
    ? { ...process.env, ...envOverride }
    : process.env;

  const config = {
    port: env.PORT || 3001,
    nodeEnv: env.NODE_ENV || "development",
    supabase: {
      url: env.SUPABASE_URL || "",
      anonKey: env.SUPABASE_ANON_KEY || "",
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
    },
    database: {
      url: env.DATABASE_URL || "",
    },
    cors: {
      origin: env.CORS_ORIGIN
        ? (env.CORS_ORIGIN.includes(",")
          ? env.CORS_ORIGIN.split(",").map((o) => o.trim())
          : env.CORS_ORIGIN)
        : ["http://localhost:5173", "http://localhost:5174"],
    },
    jwt:
      env.SUPABASE_JWT_SECRET || env.JWT_SECRET
        ? { secret: env.SUPABASE_JWT_SECRET || env.JWT_SECRET }
        : undefined,
    redis: env.REDIS_URL
      ? {
          url: env.REDIS_URL,
        }
      : undefined,
  };

  // Validate configuration
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ validationErrors: error.errors.map(e => ({ path: e.path.join("."), message: e.message })) }, "Configuration validation failed");
      throw new Error("Invalid configuration");
    }
    throw error;
  }
}

export const config = loadConfig();

// Type export for use throughout the application
export type Config = z.infer<typeof configSchema>;
