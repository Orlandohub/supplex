import postgres from "postgres";

// This script manually applies migration 0013
// Run: bun run ./packages/db/apply-migration-direct.ts

const url = process.env.DATABASE_URL || Bun.env.DATABASE_URL || "";

if (!url) {
  console.error("❌ DATABASE_URL environment variable not set");
  console.error("Please set it before running this script");
  process.exit(1);
}

console.log("🔧 Applying Migration 0013 directly...\n");

const client = postgres(url, { max: 1 });

try {
  console.log("1. Dropping index idx_workflow_template_tenant_process_status...");
  await client`DROP INDEX IF EXISTS idx_workflow_template_tenant_process_status`;
  console.log("  ✓ Index dropped\n");

  console.log("2. Dropping column process_type from workflow_template...");
  await client`ALTER TABLE workflow_template DROP COLUMN IF EXISTS process_type`;
  console.log("  ✓ Column dropped\n");

  console.log("3. Verifying changes...");
  const columns = await client`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'workflow_template'
    AND table_schema = 'public'
    ORDER BY column_name
  `;

  const hasProcessType = columns.some((col) => col.column_name === "process_type");

  if (hasProcessType) {
    console.error("  ❌ ERROR: process_type column still exists!");
    process.exit(1);
  }

  console.log("  ✓ Column successfully removed");
  console.log("\n✅ Migration 0013 applied successfully!\n");

} catch (error) {
  console.error("\n❌ Error:", error);
  process.exit(1);
} finally {
  await client.end();
}

