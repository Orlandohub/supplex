import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

// Run: bun run ./packages/db/apply-migration-0028.ts

const url = process.env.DATABASE_URL || Bun.env.DATABASE_URL || "";

if (!url) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("Applying Migration 0028 - Promote metadata to columns...\n");

const client = postgres(url, { max: 1 });

try {
  const migrationPath = join(
    __dirname,
    "migrations",
    "0028_promote_metadata_to_columns.sql"
  );
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  console.log("Running migration SQL...");
  await client.unsafe(migrationSQL);
  console.log("Migration applied successfully.\n");

  // Verify
  const processCol = await client`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'process_instance' AND column_name = 'workflow_template_id'
  `;
  console.log("process_instance.workflow_template_id:", processCol[0] ? "OK" : "MISSING");

  const stepCol = await client`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'step_instance' AND column_name = 'workflow_step_template_id'
  `;
  console.log("step_instance.workflow_step_template_id:", stepCol[0] ? "OK" : "MISSING");

  const taskTypeCol = await client`
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_name = 'task_instance' AND column_name = 'task_type'
  `;
  console.log("task_instance.task_type:", taskTypeCol[0] ? `OK (${taskTypeCol[0].udt_name})` : "MISSING");

  const outcomeCol = await client`
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_name = 'task_instance' AND column_name = 'outcome'
  `;
  console.log("task_instance.outcome:", outcomeCol[0] ? `OK (${outcomeCol[0].udt_name})` : "MISSING");

  console.log("\nDone.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
