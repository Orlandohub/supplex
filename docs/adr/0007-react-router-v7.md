# ADR 0007: Adopt React Router v7 (Framework Mode) For The Web App

## Status

Accepted — 2026-04-19

Supersedes the "Remix" framework choice in [ADR 0002: Remix Plus Elysia Application Split](./0002-remix-plus-elysia-application-split.md). ADR 0002 otherwise remains valid: the split between a user-facing SSR web app and a dedicated Elysia API is unchanged.

## Context

`apps/web` originally ran on Remix v2 (`@remix-run/node`, `@remix-run/react`, `@remix-run/serve`, `@remix-run/dev`). Remix v2 has been merged into React Router v7. Remix Development Corp. has communicated that:

- React Router v7 is the continuation of Remix v2's framework mode
- New framework work (route typegen, data APIs, SSR integrations) lands in `react-router` / `@react-router/*`, not `@remix-run/*`
- Remaining `@remix-run/*` packages continue to exist mostly as compatibility shims

Staying on `@remix-run/*` would mean:

- Diverging from upstream fixes and performance work
- Missing new typegen / `./+types/<route>` patterns that improve DX
- Carrying two separate routing surfaces in the dependency tree (`@remix-run/react` and `react-router-dom`)

The migration surface in Supplex was large but mechanical: dozens of route files, loader/action helpers (`json`, `redirect`), typed loader args, and test mocks. Tests and type-check on `main` were already partially red for reasons unrelated to this migration, which required a disciplined "do-not-regress" strategy rather than a "turn everything green" one (see [`docs/migrations/sup-5-baseline.md`](../migrations/sup-5-baseline.md)).

## Decision

Migrate `apps/web` to React Router v7 in **Framework mode**. Specifically:

- Replace `@remix-run/node`, `@remix-run/react`, `@remix-run/serve`, `@remix-run/dev` with `react-router`, `@react-router/node`, `@react-router/serve`, `@react-router/dev`
- Remove `react-router-dom` — framework primitives all come from `react-router`
- Use `@react-router/fs-routes` (`flatRoutes`) from `apps/web/app/routes.ts` to preserve the existing Remix-style file-system routing (`_app.*.tsx`, `$param`, trailing underscore siblings)
- Replace `@remix-run/dev`'s Vite plugin with `@react-router/dev/vite`'s `reactRouter()` plugin
- Replace `remix.config.js` with `react-router.config.ts` (opting into `ssr: true`)
- Keep existing SSR behavior, including `window.ENV` injection in `apps/web/app/root.tsx`
- Treat unrelated pre-existing type-check and test failures on `main` as out-of-scope (tracked under Linear SUP-8), and only fix regressions directly caused or naturally resolved by this migration

### Import rules going forward

- Framework primitives (hooks, components, loader/action types, `data`, `redirect`, etc.) import from `react-router`
- Server adapters and env-specific helpers import from `@react-router/node`
- Do **not** import from `@remix-run/*` or `react-router-dom` — those paths are no longer installed
- `json()` is removed in v7; use plain object returns, `data(value, init)` from `react-router` for status/header control, or `Response.json(...)` when a raw `Response` is required

Typed route args are generated via `react-router typegen` into `.react-router/types/`. Prefer the generated `Route.LoaderArgs` / `Route.ActionArgs` / `Route.ComponentProps` over hand-rolled `LoaderFunctionArgs` in new code.

## Consequences

### Positive ✅

- Stays on the supported upstream (React Router v7 is where framework work lands)
- Eliminates dual routing surfaces (no more `@remix-run/react` + `react-router-dom`)
- Unblocks adoption of generated per-route types (`./+types/<route>`) and future v7 data APIs
- Fewer packages in the dependency tree (`@remix-run/*` drops out entirely)
- Small lint/type improvements fall out for free (fixed `ShouldRevalidateFunctionArgs` import, removed some obsolete serialization paths)

### Negative ❌

- Breaking import changes across every route and many components and tests (done as a single migration PR)
- `json()` helper is gone; loaders that used it had to be rewritten (tactically aliased to `data` in large swaths of code to minimize churn)
- SSR JSON serialization shape shifted slightly, which exposed a few new `useLoaderData<typeof loader>()` casts; the underlying serialization tech-debt (`JsonifyObject<T>` mismatch) is tracked under SUP-8
- Contributors need to retrain on React Router v7 primitives instead of `@remix-run/*` ones

### Neutral ⚠️

- Runtime behavior is intentionally unchanged: same SSR, same flat-route layout, same auth and loader semantics — only the package boundary moves
- ADR 0002's "Remix + Elysia split" framing is now better read as "SSR-first framework + Elysia split"; the architectural split itself is unaffected

## Alternatives Considered

### Alternative 1: Stay on Remix v2

**Description**: Leave `@remix-run/*` packages installed and keep the current Remix v2 dev/serve/build pipeline.

**Pros**:

- Zero migration effort
- No risk of introducing route-level regressions

**Cons**:

- Diverges from upstream; new framework work lands in `react-router` v7, not Remix v2
- Keeps the dual routing surface (`@remix-run/react` + `react-router-dom`) alive
- Compounds migration cost the longer we wait

**Why not chosen**: The upstream direction is clear. Staying on Remix v2 is a controlled short-term choice, not a long-term architecture.

### Alternative 2: React Router v7 in Library (Data) mode

**Description**: Use `react-router` as a pure client router and re-implement SSR, build, and server adapters ourselves.

**Pros**:

- Lightest footprint, fewest framework conventions

**Cons**:

- Throws away SSR, loader/action ergonomics, file-system routing, and typegen
- Would require rebuilding the dev/build/serve pipeline from scratch
- Misaligned with ADR 0002's SSR-first premise

**Why not chosen**: Framework mode preserves exactly the Remix-equivalent behavior Supplex relies on.

### Alternative 3: Mixed install (`@remix-run/*` + `react-router`)

**Description**: Partially adopt `react-router` v7 primitives while keeping some `@remix-run/*` packages installed.

**Pros**:

- Could have been rolled out incrementally

**Cons**:

- Guarantees long-term duplication in the dependency tree
- Confuses import conventions (which primitive comes from where?)
- No real win over a single migration PR

**Why not chosen**: The "two routers in one app" failure mode is exactly what Supplex needed to get rid of.

## Implementation Notes

Key code locations:

- `apps/web/package.json` — swap of `@remix-run/*` → `@react-router/*`, scripts now call `react-router dev` / `react-router build` / `react-router-serve` / `react-router typegen`
- `apps/web/vite.config.ts` — `reactRouter()` plugin from `@react-router/dev/vite` (skipped in `test` mode)
- `apps/web/react-router.config.ts` — `ssr: true`, replaces `remix.config.js`
- `apps/web/app/routes.ts` — `flatRoutes({ ignoredRouteFiles: ["**/*.test.{ts,tsx}", "**/__tests__/**"] })` preserves the existing file-system routing and excludes co-located tests
- `apps/web/tsconfig.json` — `"types"` now includes `@react-router/node` instead of `@remix-run/node`, and `.react-router/types/**/*` is added to `include`
- `.gitignore` — adds `.react-router/` (the generated typegen output)

Migration / rollout:

- Delivered as a single PR on branch `danilolb27/sup-5-migrate-remix-to-latest-react-router` (Linear SUP-5)
- Baseline snapshot (pre-migration `main`): [`docs/migrations/sup-5-baseline.md`](../migrations/sup-5-baseline.md)
- Unrelated pre-existing failures are tracked under Linear SUP-8
- CI gates (`lint`, `type-check`, `test-frontend`, `test-backend`, `ci-status`) must pass at their post-migration levels before merge; no new test or type-check regressions are allowed vs. the baseline
- Vercel preview is required to boot and render `_app.*` routes before the PR is promoted from Draft to Ready

## Related Decisions

- [ADR 0002: Remix Plus Elysia Application Split](./0002-remix-plus-elysia-application-split.md) — superseded specifically on the "Remix" framework choice; the app split remains valid
- [ADR 0001: Monorepo And Application Boundaries](./0001-monorepo-and-application-boundaries.md) — unchanged; `apps/web` boundary is the same, only its internal framework moved

## References

- React Router v7 docs: <https://reactrouter.com>
- Remix → React Router v7 upgrade guide: <https://reactrouter.com/upgrading/remix>
- Linear issue SUP-5 (this migration)
- Linear issue SUP-8 (baseline tech-debt follow-up)

---

See [ADR Guidelines](../adr-guidelines.md) for when and how to write ADRs.
