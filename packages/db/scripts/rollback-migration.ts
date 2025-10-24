#!/usr/bin/env bun

/**
 * Migration Rollback Script
 *
 * IMPORTANT: Drizzle does not support automatic rollbacks.
 * This script helps you manually rollback by:
 * 1. Showing recent migrations
 * 2. Guiding you to create a reverse migration
 *
 * For automatic rollback, you need to:
 * 1. Create a new migration that reverses the changes
 * 2. Run that migration
 *
 * Usage:
 *   bun run scripts/rollback-migration.ts
 */

import postgres from "postgres";

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

async function showMigrationStatus() {
  log("╔════════════════════════════════════════════╗", "cyan");
  log("║   Supplex Migration Rollback Helper        ║", "cyan");
  log("╚════════════════════════════════════════════╝", "cyan");
  log("");

  // Validate environment
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    log("✗ DATABASE_URL environment variable not set", "red");
    process.exit(1);
  }

  // Connect to database
  log("Connecting to database...\n", "blue");
  const client = postgres(DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
  });

  try {
    // Get migration history
    const migrations = await client`
      SELECT 
        id,
        hash,
        created_at,
        success
      FROM __drizzle_migrations
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (migrations.length === 0) {
      log("No migrations found in database", "yellow");
      await client.end();
      process.exit(0);
    }

    log("Recent migrations:", "blue");
    log("─".repeat(80), "blue");

    migrations.forEach((migration, index) => {
      const status = migration.success ? "✓" : "✗";
      const statusColor = migration.success ? "green" : "red";

      log(`${status} ID: ${migration.id}`, statusColor);
      log(`  Hash: ${migration.hash}`, "reset");
      log(`  Date: ${new Date(migration.created_at).toISOString()}`, "reset");
      if (index < migrations.length - 1) log("");
    });

    log("\n" + "─".repeat(80), "blue");

    log(
      "\n⚠  IMPORTANT: Drizzle does not support automatic rollbacks",
      "yellow"
    );
    log("\nTo rollback a migration:", "blue");
    log(
      "1. Identify the migration you want to rollback from the list above",
      "reset"
    );
    log("2. Manually create a reverse migration:", "reset");
    log("   - Edit your schema files to reverse the changes", "reset");
    log("   - Run: pnpm --filter @supplex/db db:generate", "reset");
    log("   - This creates a new migration that reverses the changes", "reset");
    log("3. Apply the reverse migration:", "reset");
    log("   - Run: pnpm --filter @supplex/db db:migrate", "reset");
    log("\nAlternative: Use a database backup:", "blue");
    log("1. List backups: Check Supabase dashboard", "reset");
    log("2. Restore from backup to rollback to a previous state", "reset");
    log("\nFor emergency rollback in production:", "blue");
    log("1. Rollback the Fly.io deployment:", "reset");
    log("   flyctl releases rollback <version> -a supplex-api", "reset");
    log("2. This reverts the app code but NOT the database", "reset");
    log("3. If database changes are breaking, restore from backup", "reset");
  } catch (error) {
    log("\n✗ Error accessing migration history", "red");
    log(error instanceof Error ? error.message : String(error), "red");
  } finally {
    await client.end();
  }
}

// Run
showMigrationStatus().catch((error) => {
  log("\n✗ Unexpected error occurred", "red");
  console.error(error);
  process.exit(1);
});
