# Supplex - Supplier Management Platform

A modern, cloud-native supplier management platform built for pharmaceutical and medical device companies to streamline supplier lifecycle management, qualification workflows, and compliance tracking.

## 📊 Status

[![CI](https://github.com/Orlandohub/supplex/actions/workflows/ci.yml/badge.svg)](https://github.com/Orlandohub/supplex/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Orlandohub/supplex/branch/main/graph/badge.svg)](https://codecov.io/gh/Orlandohub/supplex)
[![Deployment](https://img.shields.io/badge/deployment-active-success)](https://github.com/Orlandohub/supplex/deployments)

**Deployments:**
- 🌐 Frontend: [supplex.vercel.app](https://supplex.vercel.app) 
- 🔌 Backend API: [supplex-api.fly.dev](https://supplex-api.fly.dev)
- 🏥 Health Check: [supplex-api.fly.dev/api/health](https://supplex-api.fly.dev/api/health)

## 🚀 Quick Start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/api/health

Prerequisites:
- Node.js 20+
- pnpm 8.15+
- Bun 1.1+
- Supabase project for local configuration

Use `.\dev.ps1` on Windows if Bun is not available in the current shell yet.

## 📁 Project Structure

```
supplex/
├── apps/
│   ├── api/          # Backend API (Bun + ElysiaJS)
│   └── web/          # Frontend (React Router v7 + React)
├── packages/
│   ├── config/       # Shared ESLint/Prettier configs
│   ├── db/           # Database schema & migrations (Drizzle)
│   ├── types/        # Shared TypeScript types
│   └── ui/           # Shared UI components
├── docs/             # Documentation
├── tests/            # E2E tests (Playwright)
├── dev.ps1           # Windows development launcher
└── dev.bat           # Windows CMD development launcher
```

## 🛠️ Stack

Supplex is a pnpm monorepo with:
- `apps/web` for the React Router v7 (Framework mode) + React frontend
- `apps/api` for the Bun + Elysia API
- `packages/db` for Drizzle schema and migrations
- `packages/types`, `packages/ui`, and `packages/config` for shared types, UI surface, and tooling

For enforced implementation standards, architecture decisions, and current stack expectations, start in [`docs/README.md`](./docs/README.md).

## 🏁 Local Setup

Use these docs instead of repeating the full setup guide here:
- [`docs/deployment.md`](./docs/deployment.md) for environment, release, and migration guidance
- [`apps/web/README.md`](./apps/web/README.md) for frontend environment behavior
- [`apps/api/README.md`](./apps/api/README.md) for backend setup and API details

## 🧪 Testing

```bash
pnpm test
pnpm lint
pnpm type-check
```

Browser-level coverage lives in `tests/e2e/` and `apps/web/tests/e2e/`.

## 🏗️ Development Workflow

1. Create a feature branch.
2. Run `pnpm dev` while developing.
3. Verify changes with `pnpm test`, `pnpm lint`, and `pnpm type-check`, then run any relevant browser coverage from `tests/e2e/` or `apps/web/tests/e2e/`.
4. Follow the standards and architecture docs before opening a PR.

## 📚 Documentation

Start with [`docs/README.md`](./docs/README.md), then jump to the area you need:
- [`docs/architecture.md`](./docs/architecture.md) for system structure and boundaries
- [`docs/standards.md`](./docs/standards.md) for implementation rules and conventions
- [`docs/frontend.md`](./docs/frontend.md) for UI and interaction guidance
- [`docs/deployment.md`](./docs/deployment.md) for environment, release, and migration guidance
- [`docs/troubleshooting.md`](./docs/troubleshooting.md) for known issues and operational fixes
- [`docs/adr-guidelines.md`](./docs/adr-guidelines.md) and [`docs/adr/`](./docs/adr) for durable architecture decisions
- [`apps/api/README.md`](./apps/api/README.md) for backend-specific details
- [`apps/web/README.md`](./apps/web/README.md) for frontend-specific setup

## 🤝 Contributing

1. Follow the [Standards](./docs/standards.md)
2. Write tests for new features
3. Ensure all tests pass: `pnpm test`
4. Ensure no linting errors: `pnpm lint`
5. Use conventional commit messages

## 📄 License

Private - Supplex Platform

## 🆘 Getting Help

- Start in [`docs/README.md`](./docs/README.md)
- Use the app-specific READMEs for frontend or backend setup questions
- Treat `packages/db/src/schema/` as the database schema source of truth

---

**Built with ❤️ using modern web technologies**
