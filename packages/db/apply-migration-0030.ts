import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

// Run: bun run ./packages/db/apply-migration-0030.ts

const url = process.env.DATABASE_URL || Bun.env.DATABASE_URL || "";

if (!url) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("Applying Migration 0030 - Add workflow_name and backfill due dates...\n");

const client = postgres(url, { max: 1 });

try {
  const migrationPath = join(
    __dirname,
    "migrations",
    "0030_add_workflow_name_and_backfill.sql"
  );
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  console.log("Running migration SQL...");
  await client.unsafe(migrationSQL);
  console.log("Migration applied successfully.\n");

  // Verify workflow_name column
  const col = await client`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'process_instance' AND column_name = 'workflow_name'
  `;
  console.log("process_instance.workflow_name:", col[0] ? "OK" : "MISSING");

  // Check backfill results
  const backfilled = await client`
    SELECT COUNT(*) AS count FROM process_instance WHERE workflow_name IS NOT NULL
  `;
  console.log("Process instances with workflow_name:", backfilled[0]?.count);

  const dueFilled = await client`
    SELECT COUNT(*) AS count FROM task_instance WHERE due_at IS NOT NULL
  `;
  console.log("Task instances with due_at:", dueFilled[0]?.count);

  console.log("\nDone.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
