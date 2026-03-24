#!/usr/bin/env bun

/**
 * Verify Task Instance Table Migration (Story 2.2.5.1)
 * Checks that task_template was removed and task_instance was updated correctly
 */

import postgres from "postgres";
import { resolve } from "path";
import { config } from "dotenv";

// Load environment variables
config({ path: resolve(import.meta.dir, "../../../apps/api/.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });

console.log("\n🔍 Verifying task instance migration (Story 2.2.5.1)...\n");

try {
  // Check that task_template table was removed
  console.log("1️⃣  Checking that task_template table was removed...");
  try {
    const taskTemplateColumns = await client`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'task_template'
      LIMIT 1
    `;
    if (taskTemplateColumns.length > 0) {
      console.error("   ❌ task_template table still exists (should be dropped)");
      process.exit(1);
    }
  } catch (error: any) {
    if (error.message.includes("does not exist")) {
      console.log("   ✅ task_template table successfully removed");
    } else {
      throw error;
    }
  }
  console.log("   ✅ task_template table successfully removed");

  // Check task_instance table structure
  console.log("\n2️⃣  Checking task_instance table structure...");
  const taskInstanceColumns = await client`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'task_instance'
    ORDER BY ordinal_position
  `;
  console.log(`   ✅ task_instance has ${taskInstanceColumns.length} columns`);

  // Verify required new columns exist
  const requiredColumns = [
    "assignee_type",
    "assignee_role",
    "assignee_user_id",
    "completion_time_days",
    "due_at",
  ];
  const columnNames = taskInstanceColumns.map((col: any) => col.column_name);
  
  console.log("\n3️⃣  Verifying new columns exist...");
  for (const col of requiredColumns) {
    if (columnNames.includes(col)) {
      console.log(`   ✅ Column '${col}' exists`);
    } else {
      console.error(`   ❌ Column '${col}' missing`);
      process.exit(1);
    }
  }

  // Verify removed columns are gone
  const removedColumns = ["task_template_id", "assigned_to", "due_date"];
  console.log("\n4️⃣  Verifying old columns removed...");
  for (const col of removedColumns) {
    if (!columnNames.includes(col)) {
      console.log(`   ✅ Column '${col}' removed`);
    } else {
      console.error(`   ❌ Column '${col}' still exists (should be removed)`);
      process.exit(1);
    }
  }

  // Verify step_instance_id is NOT NULL
  console.log("\n5️⃣  Verifying step_instance_id is NOT NULL...");
  const stepInstanceCol = taskInstanceColumns.find(
    (col: any) => col.column_name === "step_instance_id"
  );
  if (stepInstanceCol && stepInstanceCol.is_nullable === "NO") {
    console.log("   ✅ step_instance_id is NOT NULL");
  } else {
    console.error("   ❌ step_instance_id should be NOT NULL");
    process.exit(1);
  }

  // Check indexes on task_instance
  console.log("\n6️⃣  Checking task_instance indexes...");
  const taskInstanceIndexes = await client`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'task_instance'
  `;
  console.log(`   ✅ task_instance has ${taskInstanceIndexes.length} indexes`);
  taskInstanceIndexes.forEach((idx: any) => {
    console.log(`      - ${idx.indexname}`);
  });

  // Verify required new indexes exist
  const requiredIndexes = [
    "idx_task_instance_tenant_assignee_status",
    "idx_task_instance_tenant_assignee_user_status",
    "idx_task_instance_process_step",
    "idx_task_instance_tenant_due_at",
  ];
  const indexNames = taskInstanceIndexes.map((idx: any) => idx.indexname);
  
  console.log("\n7️⃣  Verifying required indexes exist...");
  for (const idx of requiredIndexes) {
    if (indexNames.includes(idx)) {
      console.log(`   ✅ Index '${idx}' exists`);
    } else {
      console.error(`   ❌ Index '${idx}' missing`);
      process.exit(1);
    }
  }

  // Verify old index removed
  console.log("\n8️⃣  Verifying old index removed...");
  if (!indexNames.includes("idx_task_instance_tenant_assigned_status")) {
    console.log("   ✅ Old index 'idx_task_instance_tenant_assigned_status' removed");
  } else {
    console.error(
      "   ❌ Old index 'idx_task_instance_tenant_assigned_status' still exists"
    );
    process.exit(1);
  }

  // Check foreign key constraints on task_instance
  console.log("\n9️⃣  Checking task_instance foreign keys...");
  const taskInstanceFKs = await client`
    SELECT conname, pg_get_constraintdef(oid) AS constraint_definition
    FROM pg_constraint 
    WHERE conrelid = 'task_instance'::regclass
    AND contype = 'f'
  `;
  console.log(`   ✅ task_instance has ${taskInstanceFKs.length} foreign keys`);
  taskInstanceFKs.forEach((fk: any) => {
    console.log(`      - ${fk.conname}: ${fk.constraint_definition}`);
  });

  console.log("\n✅ All verification checks passed!\n");
} catch (error) {
  console.error("\n❌ Verification failed:");
  console.error(error);
  process.exit(1);
} finally {
  await client.end();
}
