#!/usr/bin/env bun

/**
 * Apply Single Migration Script
 * Runs a specific SQL migration file
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

// Load environment variables
config({ path: resolve(import.meta.dir, "../../../apps/api/.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("❌ Usage: bun run scripts/apply-migration.ts <migration-file>");
  process.exit(1);
}

const migrationPath = resolve(import.meta.dir, "../migrations", migrationFile);

console.log(`\n🔄 Applying migration: ${migrationFile}\n`);

// Read migration SQL
let sql: string;
try {
  sql = readFileSync(migrationPath, "utf-8");
} catch (error) {
  console.error(`❌ Could not read migration file: ${migrationPath}`);
  console.error(error);
  process.exit(1);
}

// Connect to database and run migration
const client = postgres(DATABASE_URL, { max: 1 });

try {
  await client.unsafe(sql);
  console.log("✅ Migration applied successfully!\n");
} catch (error) {
  console.error("❌ Migration failed:");
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}

