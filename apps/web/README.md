# Supplex Web

Remix frontend for the Supplex supplier management platform.

Use this README for frontend-specific setup and environment behavior. Use the shared docs for architecture, standards, UX guidance, deployment, and troubleshooting.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8.15+

### Installation

```bash
pnpm install
cp .env.example .env
```

Fill in the values in `.env` before starting the app.

### Development

```bash
pnpm dev
```

Default local URL: `http://localhost:5173`

### Available Scripts

- `pnpm dev` - Start the Remix development server
- `pnpm build` - Build the production bundle
- `pnpm start` - Serve the production build
- `pnpm test` - Run tests once
- `pnpm test:watch` - Run tests in watch mode
- `pnpm lint` - Lint app files
- `pnpm type-check` - Run TypeScript checks

## Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env` and fill in the required values.

Treat `apps/web/.env.example` as the canonical variable list.

This README only keeps the behavior notes that are easy to miss:

- `API_URL` must point at the backend API used by the web app
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` must be present for both SSR and browser auth flows
- `SESSION_SECRET` is required for server-side session handling
- OAuth client IDs are optional and only needed when those login methods are enabled

## Frontend Env Architecture

The web app uses a three-source environment loading pattern to support SSR and browser execution:

1. `window.ENV` in the browser, injected from the server
2. `import.meta.env` at build time via Vite
3. `process.env` on the server

This pattern is used so the same configuration works in:

- Remix server loaders
- browser-only code
- build-time configuration

### Critical Files

- `apps/web/vite.config.ts`
- `apps/web/app/root.tsx`
- `apps/web/app/lib/auth/supabase-client.ts`

### Critical Rules

- Do not remove `SUPABASE_` or `API_` from Vite `envPrefix`
- Do not remove the `window.ENV` injection from `app/root.tsx`
- Do not replace the multi-source loading pattern with a single-source approach
- Do not introduce placeholder fallback URLs for Supabase config

## How It Works

### Vite exposure

`vite.config.ts` exposes `SUPABASE_*` and `API_*` variables to `import.meta.env`.

### Server-to-browser handoff

`app/root.tsx` reads server environment values and injects them into `window.ENV` for browser-side access.

### Client initialization

`app/lib/auth/supabase-client.ts` reads config in this order:

- `window.ENV`
- `import.meta.env`
- `process.env`

## Troubleshooting

### Placeholder values or missing Supabase config

Check:

1. `apps/web/.env` exists and contains real values
2. the dev server was restarted after editing `.env`
3. `vite.config.ts` still exposes `SUPABASE_` and `API_`
4. `window.ENV.SUPABASE_URL` is populated in the browser

### Auth works on server but fails in browser

Check:

1. `app/root.tsx` still injects `window.ENV`
2. `supabase-client.ts` still uses the multi-source loading pattern
3. `SUPABASE_ANON_KEY` is present in `apps/web/.env`

## Testing Notes

- Unit and component tests run through `pnpm test`
- Browser-focused coverage currently lives in `tests/e2e/` and `apps/web/tests/e2e/`

## Related Docs

- [`../../docs/README.md`](../../docs/README.md)
- [`../../docs/frontend.md`](../../docs/frontend.md)
- [`../../docs/standards.md`](../../docs/standards.md)
- [`../../docs/deployment.md`](../../docs/deployment.md)
- [`../../docs/troubleshooting.md`](../../docs/troubleshooting.md)
- [`../../README.md`](../../README.md)
- `apps/web/.env.example`
