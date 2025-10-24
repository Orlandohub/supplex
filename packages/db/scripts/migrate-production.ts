#!/usr/bin/env bun

/**
 * Production Migration Script
 *
 * Safely runs database migrations in production environment.
 * Includes pre-flight checks and validation.
 *
 * Usage:
 *   bun run scripts/migrate-production.ts
 *
 * Or via package.json script:
 *   pnpm --filter @supplex/db db:migrate:prod
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { existsSync } from "fs";
import { resolve } from "path";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigrations() {
  log("╔════════════════════════════════════════════╗", "cyan");
  log("║   Supplex Database Migration Runner        ║", "cyan");
  log("╚════════════════════════════════════════════╝", "cyan");
  log("");

  // Step 1: Validate environment
  log("Step 1: Validating environment...", "blue");

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    log("✗ DATABASE_URL environment variable not set", "red");
    log("Set it with: export DATABASE_URL='postgresql://...'", "yellow");
    process.exit(1);
  }

  log("✓ DATABASE_URL is set", "green");

  // Step 2: Verify migrations directory exists
  log("\nStep 2: Checking migrations directory...", "blue");

  const migrationsFolder = resolve(import.meta.dir, "../migrations");
  if (!existsSync(migrationsFolder)) {
    log("✗ Migrations directory not found", "red");
    log(`Expected: ${migrationsFolder}`, "yellow");
    log("Run: pnpm --filter @supplex/db db:generate", "yellow");
    process.exit(1);
  }

  log(`✓ Migrations directory found: ${migrationsFolder}`, "green");

  // Step 3: Connect to database
  log("\nStep 3: Connecting to database...", "blue");

  let client: postgres.Sql;
  try {
    client = postgres(DATABASE_URL, {
      max: 1,
      connect_timeout: 10,
    });

    // Test connection
    await client`SELECT 1 as test`;
    log("✓ Database connection successful", "green");
  } catch (error) {
    log("✗ Database connection failed", "red");
    log(error instanceof Error ? error.message : String(error), "red");
    process.exit(1);
  }

  // Step 4: Run migrations
  log("\nStep 4: Running migrations...", "blue");

  try {
    const db = drizzle(client);

    await migrate(db, { migrationsFolder });

    log("✓ Migrations completed successfully", "green");
  } catch (error) {
    log("✗ Migration failed", "red");
    log(error instanceof Error ? error.message : String(error), "red");

    // Clean up connection
    await client.end();

    process.exit(1);
  }

  // Step 5: Verify migration status
  log("\nStep 5: Verifying migration status...", "blue");

  try {
    const result = await client`
      SELECT COUNT(*) as count 
      FROM __drizzle_migrations 
      WHERE success = true
    `;

    const successfulMigrations = result[0]?.count || 0;
    log(`✓ ${successfulMigrations} migrations applied successfully`, "green");
  } catch (error) {
    log("⚠ Could not verify migration status", "yellow");
    log(error instanceof Error ? error.message : String(error), "yellow");
  }

  // Clean up
  await client.end();

  log("\n╔════════════════════════════════════════════╗", "cyan");
  log("║   Migration Completed Successfully ✓       ║", "cyan");
  log("╚════════════════════════════════════════════╝", "cyan");

  process.exit(0);
}

// Run migrations
runMigrations().catch((error) => {
  log("\n✗ Unexpected error occurred", "red");
  console.error(error);
  process.exit(1);
});
