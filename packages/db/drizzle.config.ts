import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit Configuration
 * Manages database migrations for Supabase PostgreSQL
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

