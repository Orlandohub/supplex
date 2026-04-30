#!/usr/bin/env node
/**
 * SUP-13 type-safety bar audit.
 *
 * Asserts that every workspace tsconfig.json either:
 *   1. extends `packages/config/tsconfig.base.json` (directly or
 *      transitively), which sets the four strict flags below, OR
 *   2. sets all four flags to `true` in its own `compilerOptions`.
 *
 * Additionally rejects any tsconfig that explicitly sets any of the
 * four flags to `false`, regardless of where it lives in the extends
 * chain. Without this guard, a downstream tsconfig could silently
 * weaken the bar by re-declaring `"strict": false` and the previous
 * SUP cleanup PRs would silently regress on the next merge.
 *
 * The four flags below were chosen because they are the ones the
 * SUP-7 cleanup actually relies on:
 *
 *   - `strict`                       => implies noImplicitAny,
 *                                       strictNullChecks, strictFunctionTypes,
 *                                       strictBindCallApply,
 *                                       strictPropertyInitialization,
 *                                       alwaysStrict, useUnknownInCatchVariables.
 *   - `noUncheckedIndexedAccess`     => array[i] is `T | undefined`,
 *                                       which is what makes
 *                                       `selectFirstOrThrow` and friends
 *                                       (SUP-11) actually load-bearing.
 *   - `noImplicitOverride`           => `override` keyword required in
 *                                       class hierarchies.
 *   - `noFallthroughCasesInSwitch`   => no implicit case-fallthrough
 *                                       in `switch` statements.
 *
 * The script is intentionally dependency-free so it runs from a vanilla
 * Node install in CI without `pnpm install`.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");

const REQUIRED_FLAGS = /** @type {const} */ ([
  "strict",
  "noUncheckedIndexedAccess",
  "noImplicitOverride",
  "noFallthroughCasesInSwitch",
]);

const BASE_CONFIG_PATH = resolve(
  REPO_ROOT,
  "packages",
  "config",
  "tsconfig.base.json"
);

/**
 * Strip JSONC-only constructs (line comments, block comments, trailing
 * commas) so the result is plain JSON. State-machine pass that walks
 * each character and tracks whether we're inside a string, so `"~/*"`
 * and `"//foo"` inside string values are not mistaken for comments.
 *
 * Avoids pulling in a JSONC dependency so the script can run from a
 * vanilla Node install in CI before `pnpm install`.
 */
function stripJsonComments(text) {
  let out = "";
  let i = 0;
  let inString = false;
  let escape = false;
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      out += c;
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (c === '"') {
      out += c;
      inString = true;
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function parseJsonc(text) {
  const stripped = stripJsonComments(text).replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

/**
 * Enumerate every git-tracked `tsconfig*.json` file in the repo. This
 * is intentionally narrower than a filesystem walk — `node_modules`,
 * Bun/pnpm caches, and other ignored directories never contain
 * tracked files, so the audit only covers tsconfigs the team actually
 * owns.
 */
function findAllTsconfigs(root) {
  const stdout = execSync(`git ls-files "*tsconfig*.json"`, {
    cwd: root,
    encoding: "utf-8",
  });
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => /(^|\/)tsconfig(\.[^.\/]+)?\.json$/.test(p))
    .map((p) => resolve(root, p));
}

/**
 * Resolve the `extends` field relative to the tsconfig that referenced
 * it. Mirrors TypeScript's resolution rules just enough for the configs
 * in this repo: relative paths only (no `node_modules` lookup, since
 * the base lives in the same monorepo).
 */
function resolveExtends(extendsField, fromFile) {
  if (!extendsField) return null;
  if (extendsField.startsWith(".")) {
    return resolve(dirname(fromFile), extendsField);
  }
  return resolve(REPO_ROOT, extendsField);
}

/**
 * Walk the `extends` chain starting at `tsconfigPath` and accumulate
 * `compilerOptions` from base to leaf. Leaf overrides win, matching
 * tsc's actual semantics. Returns the merged compilerOptions object.
 */
function readEffectiveCompilerOptions(tsconfigPath) {
  const visited = new Set();
  const chain = [];
  let current = tsconfigPath;
  while (current && !visited.has(current)) {
    visited.add(current);
    let parsed;
    try {
      parsed = parseJsonc(readFileSync(current, "utf-8"));
    } catch (err) {
      throw new Error(
        `Failed to parse ${relative(REPO_ROOT, current)}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    chain.unshift(parsed);
    current = resolveExtends(parsed.extends, current);
  }
  const merged = {};
  for (const cfg of chain) {
    if (cfg.compilerOptions) {
      Object.assign(merged, cfg.compilerOptions);
    }
  }
  return { merged, chain };
}

/**
 * For each required flag, returns either `null` (passes) or a string
 * describing the violation. `chain` is the resolved extends chain so
 * we can report where the violating override lives.
 */
function auditCompilerOptions(merged, chain, tsconfigPath) {
  const violations = [];
  for (const flag of REQUIRED_FLAGS) {
    if (merged[flag] !== true) {
      violations.push(
        `${flag} is ${JSON.stringify(merged[flag])} (must be true)`
      );
    }
  }
  for (const cfg of chain) {
    if (!cfg.compilerOptions) continue;
    for (const flag of REQUIRED_FLAGS) {
      if (
        Object.prototype.hasOwnProperty.call(cfg.compilerOptions, flag) &&
        cfg.compilerOptions[flag] !== true
      ) {
        violations.push(
          `${flag} explicitly weakened to ${JSON.stringify(
            cfg.compilerOptions[flag]
          )} somewhere in the extends chain`
        );
      }
    }
  }
  return violations;
}

function main() {
  const tsconfigs = findAllTsconfigs(REPO_ROOT);
  if (tsconfigs.length === 0) {
    console.error("No tsconfig.json files found under repo root.");
    process.exit(1);
  }

  let failed = false;
  console.log(
    `Auditing ${tsconfigs.length} tsconfig file(s) for SUP-13 type-safety bar...`
  );
  for (const tsconfig of tsconfigs.sort()) {
    const rel = relative(REPO_ROOT, tsconfig).replace(/\\/g, "/");
    if (tsconfig === BASE_CONFIG_PATH) {
      const { merged, chain } = readEffectiveCompilerOptions(tsconfig);
      const violations = auditCompilerOptions(merged, chain, tsconfig);
      if (violations.length === 0) {
        console.log(`  OK    ${rel} (base)`);
      } else {
        failed = true;
        console.error(`  FAIL  ${rel} (base)`);
        for (const v of violations) console.error(`        - ${v}`);
      }
      continue;
    }
    const { merged, chain } = readEffectiveCompilerOptions(tsconfig);
    const violations = auditCompilerOptions(merged, chain, tsconfig);
    if (violations.length === 0) {
      console.log(`  OK    ${rel}`);
    } else {
      failed = true;
      console.error(`  FAIL  ${rel}`);
      for (const v of violations) console.error(`        - ${v}`);
    }
  }

  if (failed) {
    console.error(
      "\nOne or more tsconfig files weakened the SUP-13 type-safety bar."
    );
    console.error(
      "Required flags must be inherited at true:",
      REQUIRED_FLAGS.join(", ")
    );
    process.exit(1);
  }

  console.log("\nAll tsconfig files inherit the SUP-13 type-safety bar.");
}

main();
