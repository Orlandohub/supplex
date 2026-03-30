import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

// This script manually applies migration 0016
// Run: bun run ./packages/db/apply-migration-0016.ts

const url = process.env.DATABASE_URL || Bun.env.DATABASE_URL || "";

if (!url) {
  console.error("❌ DATABASE_URL environment variable not set");
  console.error("Please set it before running this script");
  process.exit(1);
}

console.log("🔧 Applying Migration 0016 - Workflow Active & Completion Status...\n");

const client = postgres(url, { max: 1 });

try {
  // Read the migration file
  const migrationPath = join(__dirname, "migrations", "0016_add_workflow_active_and_completion_status.sql");
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  console.log("1. Adding 'active' column to workflow_template...");
  await client`ALTER TABLE workflow_template ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true`;
  console.log("  ✓ Column added\n");

  console.log("2. Adding comment to 'active' column...");
  await client`COMMENT ON COLUMN workflow_template.active IS 'Controls whether template can be instantiated. Only active=true AND status=published templates appear in dropdowns. Does not affect existing workflow instances.'`;
  console.log("  ✓ Comment added\n");

  console.log("3. Adding 'completion_status' column to workflow_step_template...");
  await client`ALTER TABLE workflow_step_template ADD COLUMN IF NOT EXISTS completion_status VARCHAR(100)`;
  console.log("  ✓ Column added\n");

  console.log("4. Adding comment to 'completion_status' column...");
  await client`COMMENT ON COLUMN workflow_step_template.completion_status IS 'Optional custom status value. When step completes, if NOT NULL, this value is copied to process_instance.status. Allows workflow status to reflect custom progression (e.g., "Documents Submitted", "Under Review", "Approved"). If NULL, process status remains unchanged.'`;
  console.log("  ✓ Comment added\n");

  console.log("5. Dropping old index idx_workflow_template_tenant_status...");
  await client`DROP INDEX IF EXISTS idx_workflow_template_tenant_status`;
  console.log("  ✓ Old index dropped\n");

  console.log("6. Creating new index idx_workflow_template_tenant_status_active...");
  await client`CREATE INDEX IF NOT EXISTS idx_workflow_template_tenant_status_active ON workflow_template (tenant_id, status, active) WHERE deleted_at IS NULL`;
  console.log("  ✓ New index created\n");

  console.log("7. Verifying changes...");
  const wtColumns = await client`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'workflow_template'
    AND table_schema = 'public'
    AND column_name = 'active'
  `;

  const wstColumns = await client`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'workflow_step_template'
    AND table_schema = 'public'
    AND column_name = 'completion_status'
  `;

  if (wtColumns.length === 0) {
    console.error("  ❌ ERROR: active column not found in workflow_template!");
    process.exit(1);
  }

  if (wstColumns.length === 0) {
    console.error("  ❌ ERROR: completion_status column not found in workflow_step_template!");
    process.exit(1);
  }

  console.log("  ✓ workflow_template.active:", wtColumns[0]);
  console.log("  ✓ workflow_step_template.completion_status:", wstColumns[0]);
  console.log("\n✅ Migration 0016 applied successfully!\n");

} catch (error) {
  console.error("\n❌ Error:", error);
  process.exit(1);
} finally {
  await client.end();
}

