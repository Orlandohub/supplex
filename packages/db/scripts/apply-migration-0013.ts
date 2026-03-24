#!/usr/bin/env tsx
/**
 * Apply Migration 0013: Remove process_type from workflow_template
 * Story: 2.2.7.1
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from "dotenv";
const envPath = join(__dirname, "../../api/.env");
dotenv.config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("🔧 Applying Migration 0013: Remove process_type from workflow_template\n");

const client = postgres(DATABASE_URL, { max: 1 });

try {
  // Read migration file
  const migrationPath = join(__dirname, "../migrations/0013_remove_process_type_from_workflow_template.sql");
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  // Apply migration
  console.log("📝 Executing migration SQL...");
  await client.unsafe(migrationSQL);

  // Update Drizzle journal
  console.log("\n✓ Migration SQL executed successfully");

  // Verify changes
  console.log("\n🔍 Verifying changes...");
  
  const columns = await client`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'workflow_template'
    AND table_schema = 'public'
    ORDER BY column_name;
  `;

  console.log("\n📋 Current workflow_template columns:");
  columns.forEach((col) => console.log(`   - ${col.column_name}`));

  const hasProcessType = columns.some((col) => col.column_name === "process_type");
  
  if (hasProcessType) {
    console.error("\n❌ ERROR: process_type column still exists!");
    process.exit(1);
  }

  console.log("\n✓ process_type column successfully removed");

  // Check indexes
  const indexes = await client`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'workflow_template'
    AND schemaname = 'public'
    ORDER BY indexname;
  `;

  console.log("\n📋 Current workflow_template indexes:");
  indexes.forEach((idx) => console.log(`   - ${idx.indexname}`));

  const hasProcessTypeIndex = indexes.some(
    (idx) => idx.indexname === "idx_workflow_template_tenant_process_status"
  );

  if (hasProcessTypeIndex) {
    console.error("\n❌ ERROR: idx_workflow_template_tenant_process_status index still exists!");
    process.exit(1);
  }

  console.log("\n✓ idx_workflow_template_tenant_process_status index successfully removed");
  console.log("\n✅ Migration 0013 applied successfully!\n");

} catch (error) {
  console.error("\n❌ Error applying migration:", error);
  process.exit(1);
} finally {
  await client.end();
}

