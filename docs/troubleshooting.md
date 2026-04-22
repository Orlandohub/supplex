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

## Debugging Checklist

Before escalating a tricky issue, verify:

- auth and role checks include null safety
- route prefixes and parameter names are consistent
- schema fields exist in the current schema package
- browser-side code is not using server-only globals
- route data flow follows the standards docs

## When To Update This File

Add to this file only when an issue is likely to recur and the guidance will help future contributors make faster, safer fixes.
