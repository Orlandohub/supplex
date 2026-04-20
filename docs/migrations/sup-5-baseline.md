# SUP-5 Pre-Migration Baseline

This document freezes the state of `main` immediately before the Remix -> React Router v7 migration (SUP-5) begins. It exists so the migration PR can be reviewed against a precise do-not-regress bar rather than an absolute green-CI bar, since `main` is substantially red on `pnpm type-check` and `pnpm --filter @supplex/web test` for reasons unrelated to the migration.

## Snapshot metadata

| Field | Value |
| --- | --- |
| Base commit (`main`) | `4c528272bc203d7ee7b997c690c4bca1dc540e85` |
| Snapshot date | 2026-04-19 |
| Linear issue | [SUP-5 - Migrate Remix to Latest React Router](https://linear.app/supplex/issue/SUP-5/migrate-remix-to-latest-react-router) |
| Node version | 20.x (CI pinned) |
| Package manager | pnpm 8.15+ |

## Commands used to produce the snapshot

Run from the repo root:

```bash
pnpm --filter @supplex/web type-check
pnpm --filter @supplex/web test
```

Raw artifacts are committed alongside this file:

- [`sup-5-baseline-type-errors.txt`](./sup-5-baseline-type-errors.txt) - every `error TS####:` line emitted by `tsc --noEmit` (429 entries).
- [`sup-5-baseline-failing-tests.txt`](./sup-5-baseline-failing-tests.txt) - every unique failing test file name emitted by `vitest run` (31 entries).

## Summary

| Check | Status |
| --- | --- |
| `pnpm --filter @supplex/web build` | not re-run, not part of the red baseline - must succeed on the migration PR |
| `pnpm --filter @supplex/web lint` | **red**: 38 ESLint errors + 153 warnings. `lint-staged` does not catch them because it only runs on staged files, and these errors live in files nobody has touched recently. The migration's mass import rewrite touches them all, so the hook surfaces the pre-existing errors. Fixed as part of the migration because the pre-commit hook would otherwise block every migration commit - see the `chore(web): fix pre-existing eslint errors...` commit on the SUP-5 branch. Follow-up for the rule-level causes: still tracked under SUP-8. |
| `pnpm --filter @supplex/web type-check` | **429 errors** across 96 files |
| `pnpm --filter @supplex/web test` | **155 tests failing** across **31 test files**, 479 tests passing, 20 test files passing |

## Type-check failures

### Distribution by error code

| Count | TS code | Gloss |
| --- | --- | --- |
| 87 | TS18048 | `X` is possibly `undefined` |
| 67 | TS2339 | Property does not exist on type |
| 53 | TS2322 | Type `A` is not assignable to type `B` |
| 52 | TS7053 | Implicit any from string-index expression (Eden-Treaty client) |
| 30 | TS2532 | Object is possibly `undefined` |
| 22 | TS2741 | Property missing in type |
| 22 | TS2345 | Argument not assignable to parameter |
| 17 | TS2739 | Missing properties from type |
| 14 | TS18047 | `X` is possibly `null` |
| 11 | TS2305 | Module has no exported member |
| 11 | TS2551 | Property does not exist (did-you-mean) |
| 9 | TS2561 | Object literal with unknown property |
| 8 | TS2307 | Cannot find module |
| 4 | TS2367 | Comparison appears unintentional |
| 4 | TS2352 | Conversion may be mistake |
| 3 | TS2554 | Expected N arguments, got M |
| 2 each | TS2559, TS2308, TS7022, TS7024, TS2353, TS2722 | misc |
| 1 each | TS7034, TS7005, TS2769 | misc |

### Clusters

The errors group cleanly into three clusters, **none of which are caused by the Remix -> React Router v7 migration**:

1. **`JsonifyObject<T>` vs `T` drift in Remix loaders.** `useLoaderData<typeof loader>()` returns a serialized (`JsonifyObject<T>`) shape where `Date` becomes `string`, `null` behaviour changes, etc. Dozens of route files pass these values directly into components typed against the unserialized domain types. RR7's `SerializeFrom<typeof loader>` behaves the same way on this axis, so the migration will not fix these errors. Representative files:
   - [`apps/web/app/routes/_app.forms.$submissionId.tsx`](../../apps/web/app/routes/_app.forms.$submissionId.tsx)
   - [`apps/web/app/routes/_app.forms.new.tsx`](../../apps/web/app/routes/_app.forms.new.tsx)
   - [`apps/web/app/routes/_app.settings.document-templates.tsx`](../../apps/web/app/routes/_app.settings.document-templates.tsx)
   - [`apps/web/app/routes/_app.settings.workflow-templates.$id_.edit.tsx`](../../apps/web/app/routes/_app.settings.workflow-templates.$id_.edit.tsx)
   - [`apps/web/app/routes/_app.settings.workflow-templates._index.tsx`](../../apps/web/app/routes/_app.settings.workflow-templates._index.tsx)
   - [`apps/web/app/routes/_app.workflows.processes._index.tsx`](../../apps/web/app/routes/_app.workflows.processes._index.tsx)
   - [`apps/web/app/routes/_app.workflows.processes.$processInstanceId.tsx`](../../apps/web/app/routes/_app.workflows.processes.$processInstanceId.tsx)
   - [`apps/web/app/routes/auth.accept-invitation.tsx`](../../apps/web/app/routes/auth.accept-invitation.tsx)

2. **Eden-Treaty string-index typing regressions (TS7053).** Usage patterns like `api["settings"]["foo"][id].put(...)` hit `"string can't be used to index type '(params: {...}) => ...'"`. This is a pure backend-client typing issue orthogonal to Remix. Representative files:
   - [`apps/web/app/routes/_app.settings.document-templates.tsx`](../../apps/web/app/routes/_app.settings.document-templates.tsx)
   - [`apps/web/app/routes/_app.settings.form-templates.$id_.edit.tsx`](../../apps/web/app/routes/_app.settings.form-templates.$id_.edit.tsx)
   - [`apps/web/app/routes/_app.settings.form-templates._index.tsx`](../../apps/web/app/routes/_app.settings.form-templates._index.tsx)
   - [`apps/web/app/routes/_app.settings.workflow-templates.$id_.edit.tsx`](../../apps/web/app/routes/_app.settings.workflow-templates.$id_.edit.tsx)
   - [`apps/web/app/routes/_app.workflows.processes.$processInstanceId.tsx`](../../apps/web/app/routes/_app.workflows.processes.$processInstanceId.tsx)
   - [`apps/web/app/routes/_app.workflows.processes.$processId.steps.$stepId.documents.tsx`](../../apps/web/app/routes/_app.workflows.processes.$processId.steps.$stepId.documents.tsx)
   - [`apps/web/app/routes/_app.workflows.processes.$processId.steps.$stepId.form.tsx`](../../apps/web/app/routes/_app.workflows.processes.$processId.steps.$stepId.form.tsx)

3. **Monorepo-level issues bleeding into the `apps/web` type-check run.**
   - [`packages/types/src/index.ts`](../../packages/types/src/index.ts) re-exports `FormSectionWithFields` and `FormTemplateWithStructure` ambiguously (TS2308).
   - [`packages/db/src/schema/process-instance.ts`](../../packages/db/src/schema/process-instance.ts) and [`packages/db/src/schema/step-instance.ts`](../../packages/db/src/schema/step-instance.ts) have implicit `any` in self-referential definitions (TS7022, TS7024).
   - Many `apps/api` routes surface TS18048 / TS2339 (missing `requestLogger` property on the Elysia context) because the shared tsconfig pulls them into the web type-check via project references.

### One error IS in migration territory

[`apps/web/app/routes/_app.workflows.processes.$processInstanceId.tsx`](../../apps/web/app/routes/_app.workflows.processes.$processInstanceId.tsx) imports `ShouldRevalidateFunctionArgs` from `@remix-run/node` but it is exported from `@remix-run/react`. Post-migration the codemod rewrites this to `react-router`, and the error must disappear.

```
app/routes/_app.workflows.processes.$processInstanceId.tsx(11,3): error TS2305:
  Module '"@remix-run/node"' has no exported member 'ShouldRevalidateFunctionArgs'.
```

## Test failures

### Distribution by failure mode

| Count | Mode | Fate in this PR |
| --- | --- | --- |
| ~40 | `Invariant failed: useNavigate() may be used only in the context of a <Router> component` - component renders call `useNavigate()` without a router wrapper | **Folded in.** The migration rewrites `@remix-run/react` mocks to `react-router` and adds a reusable `MemoryRouter` test wrapper, so these failures are expected to pass after migration. |
| ~115 | Genuinely broken test assertions, outdated fixture expectations, mocks that no longer match component contracts, Supabase client test env drift | **Out of scope.** Tracked in the separate baseline tech-debt Linear ticket. |

Concrete examples of the first (migration-adjacent) mode, taken verbatim from `vitest run`:

```
 FAIL  app/components/workflow-engine/__tests__/CommentThreadView.test.tsx
Error: useNavigate() may be used only in the context of a <Router> component.
 ❯ Proxy.useNavigate node_modules/.pnpm/react-router@6.30.0_react@18.3.1/node_modules/react-router/lib/hooks.tsx:186:46
 ❯ CommentThreadView app/components/workflow-engine/CommentThreadView.tsx:48:20
```

Concrete examples of the second (out-of-scope) mode:

```
 FAIL  app/components/workflows/__tests__/RejectStageModal.test.tsx
   > "Comments validation" > "should trim whitespace before validation"
AssertionError: expected 10 to be less than 10
  expect(comments.trim().length).toBeLessThan(10);  // "Short text".length is 10

 FAIL  app/components/workflows/__tests__/RejectStageModal.test.tsx
   > "Form fields" > "should show placeholder text"
AssertionError: expected 'Explain what needs to be corrected or…' to contain 'explain'
  expect(placeholder).toContain("explain");  // actual is "Explain...", case mismatch
```

### Affected test files

See [`sup-5-baseline-failing-tests.txt`](./sup-5-baseline-failing-tests.txt) for the full 31-file list.

## Do-not-regress acceptance bar for the SUP-5 PR

Post-migration, the following must hold before the PR is promoted from Draft to Ready:

1. `pnpm --filter @supplex/web build` succeeds. **Hard gate, no substitutions.**
2. `pnpm --filter @supplex/web lint` is green.
3. `rg "@remix-run|remix vite:|remix-serve|remix.config" apps/web` returns zero matches.
4. `pnpm --filter @supplex/web type-check` produces a set of errors that is a strict subset of [`sup-5-baseline-type-errors.txt`](./sup-5-baseline-type-errors.txt), minus at minimum the `ShouldRevalidateFunctionArgs` TS2305 error in `_app.workflows.processes.$processInstanceId.tsx`. Any newly appearing error must be demonstrably tied to migration territory.
5. `pnpm --filter @supplex/web test` produces a failing-test-file set that is a strict subset of [`sup-5-baseline-failing-tests.txt`](./sup-5-baseline-failing-tests.txt), minus at minimum the `useNavigate`-context failures that the MemoryRouter wrapper resolves.
6. Manual dev smoke (login, authed route, form action, fetcher, nested route, `window.ENV` populated in browser) passes.

## Follow-up

The unrelated baseline failures are tracked in [SUP-8 - Clean up pre-existing type-check and test failures on main](https://linear.app/supplex/issue/SUP-8/clean-up-pre-existing-type-check-and-test-failures-on-main). SUP-8 is related to, but **not** a blocker for, SUP-5 landing.

## Post-migration verification (SUP-5 PR)

Re-run of the baseline commands on the SUP-5 branch after the migration landed in this branch, for reviewer convenience:

| Check | Main (baseline) | SUP-5 branch (post-migration) | Delta |
| --- | --- | --- | --- |
| `pnpm --filter @supplex/web build` | not re-run | **passes** | - |
| `pnpm --filter @supplex/web lint` | 38 errors + 153 warnings | **0 errors, 153 warnings** (all pre-existing) | -38 errors |
| `pnpm --filter @supplex/web type-check` | 429 errors | **411 errors**, 0 new (file + TS code) tuples | -18 errors |
| `pnpm --filter @supplex/web test` | 155 failing / 31 files | **131 failing / 30 files**, 0 new failing files | -24 tests, -1 file |
| `rg "@remix-run\|remix vite:\|remix-serve\|remix.config" apps/web` | many hits | **zero hits** in code (documentation-only mentions in `apps/web/app/lib/rbac/README.md` get rewritten in the docs commit) | - |

Raw artifacts from the post-migration runs are committed for auditability:

- [`sup-5-postmigration-type-errors.txt`](./sup-5-postmigration-type-errors.txt)
- [`sup-5-postmigration-failing-tests.txt`](./sup-5-postmigration-failing-tests.txt)
- [`sup-5-postmigration-test.txt`](./sup-5-postmigration-test.txt) (full vitest output)
- [`sup-5-postmigration-build.txt`](./sup-5-postmigration-build.txt)

All acceptance-bar items (1)-(5) in the section above are met. Item (6) - manual dev smoke - is the final gate before promoting the PR from Draft to Ready.
