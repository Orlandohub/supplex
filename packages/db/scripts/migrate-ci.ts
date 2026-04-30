#!/usr/bin/env bun

/**
 * CI Migration Script
 *
 * Applies the SQL migrations under `packages/db/migrations/` to a vanilla
 * PostgreSQL database (e.g. the GitHub Actions `postgres:15` service
 * container). It exists alongside `migrate-production.ts` because:
 *
 * 1. drizzle-kit's migrator only knows about migrations recorded in the
 *    `meta/_journal.json` file (currently 0000-0013). All the post-2024
 *    migrations were applied directly via `apply-migration.ts` against
 *    Supabase and never made it back into the journal — but they ARE
 *    required for the schema the API tests exercise.
 *
 * 2. A handful of those migrations (`0033`, `0036`-`0040`) bind to
 *    Supabase-managed schemas (`auth.*`, `storage.*`) and roles
 *    (`authenticated`, `supabase_auth_admin`) that don't exist on a
 *    vanilla Postgres image. Tests in CI connect as the superuser and
 *    don't need RLS to be active, so we skip those migrations.
 *
 * 3. The custom `0040_custom_access_token_hook_test.sql` file is a SQL
 *    smoke test (not a real migration) that asserts on real user data;
 *    it lives in the migrations folder for convenience but should never
 *    run as part of the migration pipeline.
 *
 * The script tracks applied migrations in the `__drizzle_migrations`
 * table so re-runs are idempotent — just like Drizzle's runtime
 * migrator.
 *
 * Usage (typically from CI):
 *   DATABASE_URL=postgres://... bun run packages/db/scripts/migrate-ci.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

const MIGRATIONS_DIR = resolve(import.meta.dir, "../migrations");

/**
 * Migrations to skip in CI for one of two reasons:
 *
 * 1. **Supabase-only**: depend on Supabase-managed schemas (`auth.*`,
 *    `storage.*`) or roles (`authenticated`, `supabase_auth_admin`,
 *    `service_role`) that don't exist on a vanilla Postgres image.
 *    Tests connect as superuser and don't need RLS to be active.
 * 2. **Duplicate / overlay**: an out-of-band manual fix that was
 *    applied to the production DB before the canonical Drizzle
 *    migration was generated, so both files contain the same DDL.
 *    Re-applying the fix on a fresh CI database makes the canonical
 *    migration crash because its prerequisite (the typo column) no
 *    longer exists.
 */
const SKIPPED_MIGRATIONS = new Set<string>([
  // Duplicate of the rename in `0002_warm_absorbing_man.sql`. Was
  // hand-applied to production before drizzle-kit captured the same
  // change in the warm migration. Running both on a fresh DB raises
  // `column "snapshoted_checklist" does not exist`.
  "0002_fix_snapshotted_checklist_typo.sql",
  // Supabase-only (RLS / auth.* / storage.*).
  "0033_enable_storage_rls.sql",
  "0036_backfill_app_metadata.sql",
  "0037_rls_users_tenants.sql",
  "0038_fix_storage_rls_claim_path.sql",
  "0039_rls_business_tables.sql",
  "0040_custom_access_token_hook.sql",
  // Smoke test, not a migration; included in the folder for operator
  // convenience but never executed by automation.
  "0040_custom_access_token_hook_test.sql",
]);

/**
 * SQL to inject _before_ a specific migration file is applied. Used to
 * smooth over migrations that work against the production Supabase
 * instance (where prior state happens to be compatible) but break on a
 * fresh `postgres:15-alpine` image. Each entry documents the exact
 * failure observed in CI.
 *
 * Production DDL is never modified — the patch only runs in this
 * CI-specific runner.
 */
const PRE_MIGRATION_PATCHES: Record<string, string> = {
  // `0008_add_form_template_enums.sql` runs
  //   `ALTER TABLE form_template ALTER COLUMN status TYPE form_template_status …`
  // without first dropping the existing `DEFAULT 'draft'` text default
  // that `0007` set up. Postgres refuses to auto-cast the default to
  // the new enum type and aborts with
  //   `default for column "status" cannot be cast automatically to type form_template_status`.
  // The canonical safe pattern is "drop default → change type → set
  // new default" (see `0035_step_instance_status_enum.sql` for an
  // example). Drop the defaults up front; the migration's `USING`
  // clauses then succeed on the data, and we restore typed defaults
  // immediately after.
  "0008_add_form_template_enums.sql": `
    ALTER TABLE form_template ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE form_template_version ALTER COLUMN status DROP DEFAULT;
  `,

  // `0020_remove_template_versioning.sql` step 7 contains
  //   ALTER TABLE workflow_step_template DROP COLUMN form_template_version_id;
  // (no IF EXISTS). On a fresh CI database the same column was
  // already dropped a few seconds earlier by
  // `0020_fix_workflow_step_form_template.sql` (which shares the
  // 0020_ prefix and ran first lexically), so the drop now raises
  //   column "form_template_version_id" of relation "workflow_step_template" does not exist.
  // Re-add an empty-data column so the subsequent unconditional
  // DROP COLUMN succeeds. The intermediate UPDATE that references
  // this column is a no-op on a fresh DB (no rows) — the column just
  // needs to exist for the SQL to parse and the DROP to find it.
  "0020_remove_template_versioning.sql": `
    ALTER TABLE workflow_step_template
      ADD COLUMN IF NOT EXISTS form_template_version_id UUID;
  `,
};

/**
 * SQL to inject _after_ a specific migration file is applied —
 * counterpart of `PRE_MIGRATION_PATCHES`. Used to restore defaults or
 * other column attributes that the pre-patch had to remove.
 */
const POST_MIGRATION_PATCHES: Record<string, string> = {
  "0008_add_form_template_enums.sql": `
    ALTER TABLE form_template
      ALTER COLUMN status SET DEFAULT 'draft'::form_template_status;
    ALTER TABLE form_template_version
      ALTER COLUMN status SET DEFAULT 'draft'::form_template_status;
  `,
};

interface MigrationRow {
  hash: string;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("✗ DATABASE_URL is not set");
    process.exit(1);
  }

  const allFiles = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => {
      const fullPath = resolve(MIGRATIONS_DIR, name);
      return statSync(fullPath).isFile();
    })
    .sort();

  if (allFiles.length === 0) {
    console.error("✗ No migration files found");
    process.exit(1);
  }

  const skipped: string[] = [];
  const candidates: string[] = [];
  for (const name of allFiles) {
    if (SKIPPED_MIGRATIONS.has(name)) {
      skipped.push(name);
    } else {
      candidates.push(name);
    }
  }

  console.log(`→ Found ${allFiles.length} migration files`);
  console.log(
    `→ Skipping ${skipped.length} migration(s): ${
      skipped.join(", ") || "(none)"
    }`
  );
  console.log(`→ Will attempt to apply ${candidates.length} migrations`);

  const client = postgres(databaseUrl, { max: 1 });

  try {
    // Drizzle's runtime migrator stores applied hashes in
    // `drizzle.__drizzle_migrations`. We store ours under a different
    // table to avoid colliding with that bookkeeping if the same DB is
    // also targeted by drizzle-kit later.
    await client.unsafe(`
      CREATE SCHEMA IF NOT EXISTS supplex_ci_migrations;
      CREATE TABLE IF NOT EXISTS supplex_ci_migrations.applied (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const appliedRows = (await client.unsafe(
      `SELECT name AS hash FROM supplex_ci_migrations.applied`
    )) as unknown as MigrationRow[];
    const applied = new Set(appliedRows.map((r) => r.hash));

    let appliedCount = 0;
    let skippedAlreadyAppliedCount = 0;
    for (const name of candidates) {
      if (applied.has(name)) {
        skippedAlreadyAppliedCount++;
        continue;
      }

      const fullPath = resolve(MIGRATIONS_DIR, name);
      let sql = readFileSync(fullPath, "utf-8");

      // `CREATE INDEX CONCURRENTLY` cannot run inside a transaction
      // block, but `postgres-js` wraps multi-statement queries in an
      // implicit transaction. The concurrency itself is irrelevant on
      // a fresh CI database (no concurrent writers to wait on), so
      // strip the keyword to keep these migrations runnable here. The
      // resulting index is functionally identical for tests.
      if (/CREATE\s+INDEX\s+CONCURRENTLY/i.test(sql)) {
        sql = sql.replace(/CREATE\s+INDEX\s+CONCURRENTLY/gi, "CREATE INDEX");
      }

      console.log(`  • applying ${name}`);
      try {
        const prePatch = PRE_MIGRATION_PATCHES[name];
        if (prePatch) {
          console.log(`    ↳ pre-patch (CI-only)`);
          await client.unsafe(prePatch);
        }

        await client.unsafe(sql);

        const postPatch = POST_MIGRATION_PATCHES[name];
        if (postPatch) {
          console.log(`    ↳ post-patch (CI-only)`);
          await client.unsafe(postPatch);
        }

        await client.unsafe(
          `INSERT INTO supplex_ci_migrations.applied (name) VALUES ($1)`,
          [name]
        );
        appliedCount++;
      } catch (error) {
        console.error(`✗ Migration ${name} failed:`);
        console.error(error);
        process.exit(1);
      }
    }

    console.log(
      `✓ Applied ${appliedCount} new migration(s) (${skippedAlreadyAppliedCount} already-applied skipped, ${skipped.length} explicitly skipped)`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("✗ Unexpected error:");
  console.error(error);
  process.exit(1);
});
