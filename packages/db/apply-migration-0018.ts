import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

// This script manually applies migration 0018
// Run: bun run ./packages/db/apply-migration-0018.ts

const url = process.env.DATABASE_URL || Bun.env.DATABASE_URL || "";

if (!url) {
  console.error("❌ DATABASE_URL environment variable not set");
  console.error("Please set it before running this script");
  process.exit(1);
}

console.log("🔧 Applying Migration 0018 - Restore Document Templates...\n");

const client = postgres(url, { max: 1 });

try {
  // Read the migration file
  const migrationPath = join(__dirname, "migrations", "0018_restore_document_templates.sql");
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  console.log("1. Creating document_template table...");
  await client`
    CREATE TABLE IF NOT EXISTS document_template (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      template_name VARCHAR(200) NOT NULL,
      required_documents JSONB DEFAULT '[]'::jsonb NOT NULL,
      is_default BOOLEAN DEFAULT false NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'published',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      deleted_at TIMESTAMP WITH TIME ZONE
    )
  `;
  console.log("  ✓ Table created\n");

  console.log("2. Adding FK constraint: document_template.tenant_id → tenants.id...");
  await client`
    ALTER TABLE document_template
    ADD CONSTRAINT IF NOT EXISTS fk_document_template_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE
  `;
  console.log("  ✓ FK constraint added\n");

  console.log("3. Creating index: idx_document_template_tenant_status...");
  await client`
    CREATE INDEX IF NOT EXISTS idx_document_template_tenant_status
    ON document_template(tenant_id, status)
    WHERE deleted_at IS NULL
  `;
  console.log("  ✓ Index created\n");

  console.log("4. Creating index: idx_document_template_tenant_default...");
  await client`
    CREATE INDEX IF NOT EXISTS idx_document_template_tenant_default
    ON document_template(tenant_id, is_default)
  `;
  console.log("  ✓ Index created\n");

  console.log("5. Adding document_template_id column to workflow_step_template...");
  await client`
    ALTER TABLE workflow_step_template
    ADD COLUMN IF NOT EXISTS document_template_id UUID
  `;
  console.log("  ✓ Column added\n");

  console.log("6. Adding document_action_mode column to workflow_step_template...");
  await client`
    ALTER TABLE workflow_step_template
    ADD COLUMN IF NOT EXISTS document_action_mode VARCHAR(50)
  `;
  console.log("  ✓ Column added\n");

  console.log("7. Adding FK constraint: workflow_step_template.document_template_id → document_template.id...");
  await client`
    ALTER TABLE workflow_step_template
    ADD CONSTRAINT IF NOT EXISTS fk_workflow_step_document_template
    FOREIGN KEY (document_template_id)
    REFERENCES document_template(id)
    ON DELETE RESTRICT
  `;
  console.log("  ✓ FK constraint added\n");

  console.log("8. Creating index: idx_workflow_step_template_document_template...");
  await client`
    CREATE INDEX IF NOT EXISTS idx_workflow_step_template_document_template
    ON workflow_step_template(document_template_id)
    WHERE deleted_at IS NULL AND document_template_id IS NOT NULL
  `;
  console.log("  ✓ Index created\n");

  console.log("9. Verifying changes...");
  
  // Verify document_template table exists
  const tableExists = await client`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'document_template'
  `;
  
  if (tableExists.length === 0) {
    console.error("  ❌ ERROR: document_template table not found!");
    process.exit(1);
  }
  console.log("  ✓ document_template table exists");

  // Verify columns in document_template
  const dtColumns = await client`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'document_template'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  
  console.log(`  ✓ document_template has ${dtColumns.length} columns`);

  // Verify workflow_step_template columns restored
  const wstColumns = await client`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'workflow_step_template'
    AND table_schema = 'public'
    AND column_name IN ('document_template_id', 'document_action_mode')
  `;

  if (wstColumns.length !== 2) {
    console.error("  ❌ ERROR: workflow_step_template columns not restored properly!");
    process.exit(1);
  }
  console.log("  ✓ workflow_step_template.document_template_id restored");
  console.log("  ✓ workflow_step_template.document_action_mode restored");

  // Verify indexes
  const indexes = await client`
    SELECT indexname FROM pg_indexes 
    WHERE tablename IN ('document_template', 'workflow_step_template')
    AND indexname LIKE '%document%'
  `;
  
  console.log(`  ✓ ${indexes.length} document-related indexes created`);

  // Verify FK constraints
  const constraints = await client`
    SELECT conname FROM pg_constraint 
    WHERE conname IN ('fk_document_template_tenant', 'fk_workflow_step_document_template')
  `;
  
  if (constraints.length !== 2) {
    console.error("  ❌ ERROR: FK constraints not created properly!");
    process.exit(1);
  }
  console.log("  ✓ fk_document_template_tenant constraint exists");
  console.log("  ✓ fk_workflow_step_document_template constraint exists");

  console.log("\n✅ Migration 0018 applied successfully!\n");

} catch (error) {
  console.error("\n❌ Error:", error);
  process.exit(1);
} finally {
  await client.end();
}

