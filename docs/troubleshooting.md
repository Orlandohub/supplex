# Troubleshooting

This document captures the recurring issues that contributors are most likely to hit again.

Use `docs/README.md` for the full documentation map. Keep detailed app setup and environment behavior in the app-level READMEs.

## Quick Fixes

| Error Message | Fix |
| --- | --- |
| Slow tab switching | Add `shouldRevalidate` and avoid unnecessary loader re-runs |
| Data not updating after mutation | Use revalidation instead of manual client-side state repair |
| Flash of loading state | Move fetching into the route loader |
| `user.role is undefined` | Use `authenticate` directly and do role checks inside the handler |
| `process is not defined` | Use isomorphic config access (`window.ENV`, `import.meta.env`, `process.env`) |
| `Object.entries requires...` | Verify actual schema fields before writing Drizzle selections |
| `Cannot create route... parameter` | Use consistent route parameter names |
| `POST to /suppliers/undefined/api/...` | Use centralized `config.apiUrl`, not a non-existent `VITE_API_URL` |
| `Preflight validation check failed` | Use TypeBox in Elysia route validation, not Zod schemas |
| `TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '((params: { id: string \| number; }) => ...)` | Use Eden Treaty's function-call syntax: `client.api.suppliers({ id }).get()` instead of `client.api.suppliers[id].get()`. See [Eden Treaty: dynamic path segments](#eden-treaty-dynamic-path-segments). |
| 401/403 redirects never fire from Treaty calls | Eden's `treaty(url, { fetch })` slot expects an object of default `RequestInit` options. To inject a custom fetch implementation, use `fetcher:` instead. See [Eden Treaty: `fetch` vs `fetcher`](#eden-treaty-fetch-vs-fetcher). |

## Recurring Contributor Pitfalls

### Authentication middleware

- Use `authenticate` directly on routes
- Perform role checks inside handlers with null safety
- Avoid fragile wrapper middleware that can lose derived context

### Schema and joins

- Verify field names against `packages/db/src/schema/`
- Null-check joined data before using it
- Prefer live schema truth over assumptions from old docs or old code

### Isomorphic frontend configuration

- Do not access `process.env` directly in browser-executed code
- Follow the `window.ENV` -> `import.meta.env` -> `process.env` pattern described in `apps/web/README.md`
- Test client-side navigation, not just initial SSR page loads

### React Router routes

- Keep route data loading in loaders
- Use sibling versus child route naming intentionally
- Add `shouldRevalidate` when URL state should not trigger full route reloads
- If you see `Cannot find module '@remix-run/react'` or `@remix-run/node`: the app was migrated to React Router v7 in Framework mode. Import from `react-router` (framework primitives) or `@react-router/node` (server adapters) instead. See [`docs/adr/0007-react-router-v7.md`](./adr/0007-react-router-v7.md).
- If you see `Module '"react-router"' has no exported member 'json'`: the `json()` helper was removed in v7. Return plain objects from loaders, or use `data(value, init)` from `react-router` for status/header control, or `Response.json(...)` when a raw `Response` is required.
- If you see `Error: Route config file not found at "app/routes.ts"`: the React Router dev pipeline requires a root route config. It lives at `apps/web/app/routes.ts` and uses `@react-router/fs-routes`' `flatRoutes({ ignoredRouteFiles })` to preserve the Remix-style file-system routing.

### Elysia route structure

- Let parent aggregators own route prefixes
- Keep child route modules prefix-free
- Use consistent route parameter names across related endpoints

### Eden Treaty: dynamic path segments

Treaty exposes routes with dynamic path parameters (e.g. Elysia's
`.get("/:id", ...)`) as a **callable function** on the segment, not a
bracket-indexable record. Bracket access (`client.api.suppliers[id].get()`)
fails type-checking with [TS7053][ts7053] because the route is typed as
`(params: { id: string | number }) => { get, put, patch, delete }`. The
correct call shape:

```ts
const response = await client.api.suppliers({ id }).get();
//                              ^^^^^^^^^^^^^^^^^ function call, not index
```

When a `params` object has multiple keys (e.g. `/:templateId/steps/:stepId`),
spread them in the same call: `client.api.workflowTemplates({ templateId, stepId }).get()`.

This pattern is the proven fix from `apps/api`'s test suite (SUP-9b/c) and
the same approach is being rolled out in `apps/web` production code under
SUP-10. It eliminates the `as any` previously required to silence TS7053.

[ts7053]: https://typescript.tv/errors/#ts7053

### Eden Treaty: `fetch` vs `fetcher`

Eden 1.4.x's `Treaty.Config` has **two** fetch-related slots, with very
different meanings:

| Slot | Type | Purpose |
| --- | --- | --- |
| `fetch` | `Omit<RequestInit, 'headers' \| 'method'>` | **Default `RequestInit` options** spread into every request (e.g. `credentials: "include"`, `cache: "no-store"`). |
| `fetcher` | `typeof fetch` | **Custom fetch implementation** that Eden calls instead of `globalThis.fetch`. |

Passing a function to the `fetch` slot is a silent no-op: Eden destructures
it as `let { fetch: _ } = config` and spreads it into per-request init via
`{ ..._ }`, but spread of a function value yields no own enumerable
properties, so the function is dropped and `globalThis.fetch` is used.
Symptom: any wrapping the developer added (auth-error redirects, logging,
mock injection) **never runs**.

Always use `fetcher` for custom fetch implementations:

```ts
return treaty<App>(API_URL, {
  fetcher: fetchWithAuthErrorHandler,
});
```

If your project includes `bun-types` transitively (e.g. via Elysia's `.d.ts`
references), `typeof fetch` carries Bun-specific surface (`preconnect`,
`BunFetchRequestInit`) that a plain Node/browser wrapper can't satisfy. A
single `as typeof fetch` cast at declaration is acceptable here — it is
substantially narrower than `as any` and the inner arrow function still
enforces a fetch-shaped parameter contract.

## Debugging Checklist

Before escalating a tricky issue, verify:

- auth and role checks include null safety
- route prefixes and parameter names are consistent
- schema fields exist in the current schema package
- browser-side code is not using server-only globals
- route data flow follows the standards docs

## When To Update This File

Add to this file only when an issue is likely to recur and the guidance will help future contributors make faster, safer fixes.
