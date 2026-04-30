#!/usr/bin/env bun

/**
 * CI Test Runner — One Bun Process Per Test File
 *
 * Bun's `mock.module()` is process-wide and is not torn down between
 * test files in the same `bun test` invocation. Several specs in this
 * package legitimately mock infrastructure modules (`./db`, `./logger`,
 * `./jwt-verifier`, `./supabase`, `./auth-cache`) to unit-test the
 * RBAC middleware in isolation, and those mocks then bleed into every
 * downstream integration test that imports the same modules. The
 * symptom is the cascade of
 *   `insertOneOrThrow: insert into <table> returned no rows`
 * and `logger.warn is not a function` failures we observed on the
 * shared `Test Backend` job after `lib/rbac/middleware.test.ts` ran.
 *
 * Until Bun's `--isolate` flag stabilises (`oven-sh/bun#29354`), the
 * portable workaround is to spawn one `bun test` process per spec
 * file. Each process gets its own `JSC::VM`, so mocks declared in one
 * file cannot leak into another. This is slower than a single
 * invocation but matches the actual test-isolation contract the suite
 * was written against.
 *
 * Usage (typically from CI):
 *   bun run scripts/test-ci.ts
 *
 * Args after `--` are forwarded to each `bun test` invocation:
 *   bun run scripts/test-ci.ts -- --bail
 */
import { readdirSync, statSync } from "fs";
import { resolve, sep } from "path";
import { spawn } from "bun";

const PKG_ROOT = resolve(import.meta.dir, "..");
const TESTS_ROOT = resolve(PKG_ROOT, "src");

function collectTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectTestFiles(full));
    } else if (entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

const extraArgs = process.argv.slice(2);

const files = collectTestFiles(TESTS_ROOT).sort();
console.log(`→ Discovered ${files.length} test file(s) under src/`);
if (files.length === 0) {
  console.error("✗ No test files found");
  process.exit(1);
}

interface FileResult {
  file: string;
  exitCode: number;
}

const results: FileResult[] = [];
const startedAt = Date.now();

for (const file of files) {
  const relPath = file
    .slice(PKG_ROOT.length + 1)
    .split(sep)
    .join("/");
  console.log(`\n::group::${relPath}`);
  const proc = spawn({
    cmd: ["bun", "test", file, ...extraArgs],
    cwd: PKG_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  const exitCode = await proc.exited;
  console.log(`::endgroup::`);
  if (exitCode !== 0) {
    console.log(`✗ ${relPath} (exit ${exitCode})`);
  }
  results.push({ file: relPath, exitCode });
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
const failures = results.filter((r) => r.exitCode !== 0);

console.log(`\n${"=".repeat(72)}`);
console.log(
  `→ ${results.length - failures.length}/${results.length} files passed in ${elapsed}s`
);
if (failures.length > 0) {
  console.log(`✗ ${failures.length} file(s) failed:`);
  for (const f of failures) {
    console.log(`    ${f.file} (exit ${f.exitCode})`);
  }
  process.exit(1);
}
console.log(`✓ All ${results.length} files passed`);
