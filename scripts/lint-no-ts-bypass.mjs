#!/usr/bin/env node
/**
 * SUP-13 `@ts-*` directive policy.
 *
 * The TypeScript pragmas split into two camps:
 *
 *   - Always banned:
 *       `@ts-ignore`   — silently disables the next line, never errors
 *                        out when the underlying issue is fixed, rots
 *                        in place.
 *       `@ts-nocheck`  — disables type checking for the entire file.
 *
 *   - Allowed in test files only, and only with a justifying comment:
 *       `@ts-expect-error` — disables the next line BUT errors out if
 *                            that line later becomes type-correct, so
 *                            it self-cleans. Acceptable for tests that
 *                            deliberately exercise bad input or runtime
 *                            invariants the type system can't express.
 *
 * The "test files only" rule keeps `@ts-expect-error` from creeping
 * into production code — outside of tests, a type system gap should
 * be fixed at the source, not papered over.
 *
 * The "justifying comment" rule is easy to miss but matters for
 * readability: a bare `// @ts-expect-error` reviewer can't tell what
 * invariant is being tested. Requiring same-line text after the
 * directive forces the author to explain the intent.
 *
 * The script is dependency-free; runs from a vanilla Node install in
 * CI before `pnpm install`.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

const TEST_FILE_RE = /(\.test\.tsx?|\.spec\.tsx?|\/__tests__\/)/;

function listSourceFiles() {
  const stdout = execSync(`git ls-files "*.ts" "*.tsx"`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the trailing text on `line` after the directive, with
 * leading whitespace and a trailing block-comment closer (asterisk +
 * forward slash) collapsed. Empty string indicates the directive was
 * used without a justifying comment.
 */
function justificationFor(line, directive) {
  const idx = line.indexOf(directive);
  if (idx === -1) return null;
  const after = line.slice(idx + directive.length);
  return after.replace(/\*\/\s*$/, "").trim();
}

function main() {
  const files = listSourceFiles();
  const violations = [];

  for (const rel of files) {
    const abs = resolve(REPO_ROOT, rel);
    let content;
    try {
      content = readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    if (
      !content.includes("@ts-ignore") &&
      !content.includes("@ts-nocheck") &&
      !content.includes("@ts-expect-error")
    ) {
      continue;
    }

    const isTest = TEST_FILE_RE.test(rel.replace(/\\/g, "/"));
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line.includes("@ts-ignore")) {
        violations.push({
          file: rel,
          line: lineNum,
          message: "@ts-ignore is banned (use @ts-expect-error in tests with a justifying comment, or fix the underlying type issue)",
        });
      }
      if (line.includes("@ts-nocheck")) {
        violations.push({
          file: rel,
          line: lineNum,
          message: "@ts-nocheck is banned (it disables type checking for the entire file)",
        });
      }
      if (line.includes("@ts-expect-error")) {
        if (!isTest) {
          violations.push({
            file: rel,
            line: lineNum,
            message: "@ts-expect-error is allowed in test files only — fix the type issue at the source instead",
          });
          continue;
        }
        const justification = justificationFor(line, "@ts-expect-error");
        if (!justification) {
          violations.push({
            file: rel,
            line: lineNum,
            message: "@ts-expect-error requires a same-line justifying comment explaining the invariant being tested",
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `SUP-13 @ts-* directive policy: ${violations.length} violation(s):\n`
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.message}`);
    }
    console.error(
      "\nPolicy reference: docs/standards.md (#type-safety-bar)."
    );
    process.exit(1);
  }

  console.log(
    `SUP-13 @ts-* directive policy: ${files.length} file(s) checked, no violations.`
  );
}

main();
