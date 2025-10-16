/**
 * Supplex Database Schema and Migrations
 * Using Drizzle ORM with PostgreSQL (Supabase)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database Connection
 * Uses connection pooling via Supabase
 * Requires DATABASE_URL environment variable
 */
const connectionString = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

// Only validate in production
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please configure it in apps/api/.env"
  );
}

// Create postgres connection client
const client = postgres(connectionString, {
  max: 20, // Maximum connections in pool
  idle_timeout: 60, // Close idle connections after 60 seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

/**
 * Export all schemas for use in queries
 */
export { schema };

/**
 * Export individual tables for convenience
 */
export { tenants } from "./schema/tenants";
export { users } from "./schema/users";
export { suppliers } from "./schema/suppliers";
export { contacts } from "./schema/contacts";
export { documents } from "./schema/documents";

/**
 * Export types for TypeScript
 */
export type {
  InsertTenant,
  SelectTenant,
} from "./schema/tenants";
export type {
  InsertUser,
  SelectUser,
} from "./schema/users";
export type {
  InsertSupplier,
  SelectSupplier,
} from "./schema/suppliers";
export type {
  InsertContact,
  SelectContact,
} from "./schema/contacts";
export type {
  InsertDocument,
  SelectDocument,
} from "./schema/documents";

/**
 * Export tenant context helpers
 */
export * from "./helpers/tenant-context";

