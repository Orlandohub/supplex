# Supplex API

Backend API built with ElysiaJS and Bun runtime.

## ⚠️ Critical: Windows Development Requirements

**ElysiaJS requires Bun runtime, which ONLY runs on Windows via WSL2.**

### Running on Windows

```bash
# From project root - uses dev:wsl automatically
pnpm dev

# Or run API directly with WSL
pnpm --filter @supplex/api dev:wsl
```

### Running on macOS/Linux

```bash
# Bun runs natively
pnpm --filter @supplex/api dev:bun
```

## Scripts Explained

- `dev` - Node.js with tsx (fallback, not recommended for production)
- `dev:wsl` - **Use this on Windows** - Runs Bun via WSL2
- `dev:bun` - Direct Bun execution (macOS/Linux only)
- `build` - TypeScript compilation (Node.js target)
- `build:wsl` - Bun build via WSL2 (optimized)

## ⚠️ DO NOT Change

**DO NOT modify the root `package.json` dev script to use `dev` instead of `dev:wsl` on Windows.**

The configuration is intentionally set this way because:
1. ElysiaJS is designed for Bun and uses Bun-specific APIs
2. Bun does not run natively on Windows
3. Running via WSL2 is the official workaround

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (auto-restart on changes)
pnpm dev:wsl  # Windows
pnpm dev:bun  # macOS/Linux

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Tech Stack

- **Runtime**: Bun 1.1+
- **Framework**: ElysiaJS 1.0+
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Drizzle
- **Validation**: Zod
- **Testing**: Vitest

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_KEY` - Service role key (keep secret!)
- `JWT_SECRET` - For token signing

See `.env.example` for full list.

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts          # Main entry point
│   ├── lib/              # Shared utilities
│   │   ├── db.ts         # Database connection
│   │   ├── supabase.ts   # Supabase client
│   │   ├── rate-limiter.ts
│   │   ├── rbac/         # Role-based access control
│   │   └── audit/        # Audit logging
│   └── routes/           # API routes
│       ├── auth/         # Authentication endpoints
│       └── users/        # User management
├── package.json
└── tsconfig.json
```

## API Endpoints

- `GET /` - API info
- `GET /health` - Health check
- `/api/auth/*` - Authentication routes
- `/api/users/*` - User management (protected)

Full API documentation: See `docs/architecture/api-specification.md`

