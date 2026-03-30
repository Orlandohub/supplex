/**
 * Apply Migration 0019: Add step_instance_id to form_submission
 * 
 * Run: bun run apply-migration-0019.ts
 */

import { sql } from "drizzle-orm";
import { db } from "./src/index";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🚀 Applying Migration 0019: Add step_instance_id to form_submission");
  console.log("━".repeat(60));

  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error("❌ DATABASE_URL environment variable not set");
      console.error("Please set it before running this script");
      process.exit(1);
    }

    // Read migration SQL file
    const migrationPath = join(__dirname, "migrations", "0019_add_step_instance_to_form_submission.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📄 Reading migration file...");
    console.log(`   Path: ${migrationPath}`);

    // Execute migration
    console.log("\n⚙️  Executing migration...");
    await db.execute(sql.raw(migrationSQL));

    console.log("\n✅ Migration applied successfully!");
    console.log("\n📊 Verification queries:");
    
    // Verify column was added
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'form_submission' 
      AND column_name = 'step_instance_id'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log("   ✓ Column 'step_instance_id' added to form_submission");
      console.log(`   ✓ Type: ${columnCheck.rows[0].data_type}, Nullable: ${columnCheck.rows[0].is_nullable}`);
    } else {
      console.log("   ⚠️  Column 'step_instance_id' not found");
    }

    // Verify unique constraint
    const constraintCheck = await db.execute(sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'form_submission' 
      AND constraint_name = 'uq_form_submission_version_step'
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log("   ✓ Unique constraint 'uq_form_submission_version_step' created");
    } else {
      console.log("   ⚠️  Unique constraint not found");
    }

    // Verify index
    const indexCheck = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'form_submission' 
      AND indexname = 'idx_form_submission_step_instance'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log("   ✓ Index 'idx_form_submission_step_instance' created");
    } else {
      console.log("   ⚠️  Index not found");
    }

    console.log("\n🎉 Migration 0019 completed successfully!");
    console.log("━".repeat(60));

  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

main();

