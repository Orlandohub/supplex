/**
 * Application Configuration
 * Centralized configuration management following best practices
 */

import { z } from "zod";

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

  // JWT (Supabase JWT Secret for local verification)
  jwt: z.object({
    secret: z.string().min(32),
  }),

  // Optional: Redis
  redis: z
    .object({
      url: z.string().optional(),
    })
    .optional(),
});

/**
 * Load and validate configuration from environment variables
 */
function loadConfig() {
  const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || "development",
    supabase: {
      url: process.env.SUPABASE_URL || "",
      anonKey: process.env.SUPABASE_ANON_KEY || "",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    },
    database: {
      url: process.env.DATABASE_URL || "",
    },
    cors: {
      origin: process.env.CORS_ORIGIN 
        ? (process.env.CORS_ORIGIN.includes(',') 
          ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
          : process.env.CORS_ORIGIN)
        : ["http://localhost:5173", "http://localhost:5174"],
    },
    jwt: {
      secret:
        process.env.SUPABASE_JWT_SECRET ||
        process.env.JWT_SECRET ||
        "dev-secret-key-change-in-production-min-32-chars",
    },
    redis: process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
        }
      : undefined,
  };

  // Validate configuration
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Invalid configuration");
    }
    throw error;
  }
}

export const config = loadConfig();

// Type export for use throughout the application
export type Config = z.infer<typeof configSchema>;
