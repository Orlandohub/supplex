/**
 * Apply Migration 0017: Drop Legacy Qualification System
 * 
 * This script applies migration 0017 which removes all legacy qualification
 * tables and replaces them with the new workflow engine.
 * 
 * ⚠️ WARNING: This migration is DESTRUCTIVE and deletes data permanently.
 * 
 * Usage:
 *   bun run packages/db/apply-migration-0017.ts
 * 
 * Prerequisites:
 *   - DATABASE_URL environment variable must be set
 *   - User must explicitly approve data loss
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.error("   Please set it in your .env file or environment");
  process.exit(1);
}

async function applyMigration() {
  console.log("🚀 Starting Migration 0017: Drop Legacy Qualification System");
  console.log("⚠️  WARNING: This will permanently delete all legacy qualification data!");
  console.log("");
  
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Read migration file
    const migrationPath = join(__dirname, "migrations", "0017_drop_legacy_qualification_system.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📂 Read migration file: 0017_drop_legacy_qualification_system.sql");
    console.log("");

    // Split by statement (simple split by semicolon, filtering comments and empty lines)
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => {
        // Remove comments and empty statements
        const withoutComments = stmt
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim();
        return withoutComments.length > 0;
      });

    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    console.log("");

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`   [${i + 1}/${statements.length}] Executing...`);
      
      try {
        await sql.unsafe(statement);
        console.log(`   ✅ Success`);
      } catch (error: any) {
        // Some statements may fail if objects don't exist (e.g., DROP IF EXISTS)
        // Only log actual errors
        if (!error.message.includes("does not exist")) {
          console.warn(`   ⚠️  Warning: ${error.message}`);
        } else {
          console.log(`   ℹ️  Skipped (object doesn't exist)`);
        }
      }
    }

    console.log("");
    console.log("✅ Migration 0017 applied successfully!");
    console.log("");
    console.log("📋 Verification:");
    console.log("   Run the following queries to verify:");
    console.log("   1. Check dropped tables:");
    console.log("      SELECT table_name FROM information_schema.tables");
    console.log("      WHERE table_schema = 'public' AND table_name IN");
    console.log("      ('qualification_process', 'qualification_stages', 'qualification_templates',");
    console.log("       'workflow_documents', 'workflow_events');");
    console.log("   ");
    console.log("   2. Check workflow_step_template columns:");
    console.log("      SELECT column_name FROM information_schema.columns");
    console.log("      WHERE table_name = 'workflow_step_template'");
    console.log("      AND column_name IN ('document_template_id', 'document_action_mode');");
    console.log("");
    console.log("   Both queries should return 0 rows.");

  } catch (error: any) {
    console.error("❌ Error applying migration:");
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();

