# Supplex - Supplier Management Platform

A comprehensive supplier management and quality control platform, built with modern TypeScript stack.

## 🏗️ Tech Stack

- **Frontend**: Remix 2.8+ with React 18, TypeScript, Tailwind CSS
- **Backend**: ElysiaJS 1.0+ on Bun runtime
- **Database**: PostgreSQL 15+ with Drizzle ORM (via Supabase)
- **Monorepo**: pnpm workspaces
- **Testing**: Vitest (frontend), Bun Test (backend), Playwright (E2E)
- **Code Quality**: ESLint, Prettier, TypeScript strict mode, Husky pre-commit hooks

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or higher - [Download](https://nodejs.org/)
- **Bun** 1.1.x or higher - [Install](https://bun.sh/)
- **pnpm** 8.15.x or higher - [Install](https://pnpm.io/installation)

Verify installations:

```bash
node --version  # Should be v20.x.x or higher
bun --version   # Should be 1.1.x or higher
pnpm --version  # Should be 8.15.x or higher
```

### Platform Requirements

- **macOS**: Fully supported
- **Linux**: Fully supported
- **Windows**: Use WSL2 (Bun has experimental native Windows support)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/supplex/supplex.git
cd supplex

# Install all dependencies
pnpm install

# This will install dependencies for all workspaces
```

### 2. Configure Environment Variables

Create `.env` files from examples:

```bash
# Frontend environment
cp apps/web/.env.example apps/web/.env

# Backend environment
cp apps/api/.env.example apps/api/.env
```

**Frontend (`apps/web/.env`):**
```env
API_URL=http://localhost:3001
NODE_ENV=development
```

**Backend (`apps/api/.env`):**
```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

> **Note**: Database and authentication environment variables will be added in Stories 1.2 and 1.3

### 3. Start Development Servers

```bash
# Start both frontend and backend concurrently
pnpm dev
```

This starts:
- **Frontend**: http://localhost:3000 (Remix dev server with HMR)
- **Backend**: http://localhost:3001 (ElysiaJS with Bun watch mode)

Both servers support hot module reload and will restart on file changes.

## 📦 Monorepo Structure

```
supplex/
├── apps/
│   ├── web/              # Remix frontend application
│   │   ├── app/          # Remix routes and components
│   │   ├── public/       # Static assets
│   │   └── package.json
│   └── api/              # ElysiaJS backend application
│       ├── src/          # API source code
│       └── package.json
├── packages/
│   ├── types/            # Shared TypeScript types & Zod schemas
│   ├── ui/               # UI component library (Midday fork)
│   ├── db/               # Drizzle schema & migrations
│   └── config/           # Shared configs (ESLint, TypeScript, Prettier)
├── docs/                 # Documentation
├── .github/workflows/    # CI/CD pipelines
└── package.json          # Root workspace config
```

### Package Boundaries

- **`@supplex/types`**: Shared between web and api, zero dependencies on either
- **`@supplex/ui`**: Used only by web, no backend dependencies
- **`@supplex/db`**: Used only by api, web accesses via Supabase SDK
- **`@supplex/config`**: Shared tooling configs (linters, TS config)

## 🛠️ Available Scripts

### Root Scripts (run from project root)

```bash
# Development
pnpm dev              # Start all dev servers concurrently
pnpm build            # Build all packages and apps
pnpm test             # Run all tests across workspaces
pnpm lint             # Lint all workspaces
pnpm format           # Format all files with Prettier
pnpm type-check       # Type-check all workspaces

# Workspace-specific
pnpm --filter @supplex/web dev      # Start only frontend
pnpm --filter @supplex/api dev      # Start only backend
pnpm --filter @supplex/web test     # Test only frontend
```

### Frontend Scripts (from `apps/web/`)

```bash
pnpm dev              # Start Remix dev server (port 3000)
pnpm build            # Build for production
pnpm start            # Start production server
pnpm test             # Run Vitest tests
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Lint frontend code
pnpm type-check       # TypeScript type checking
```

### Backend Scripts (from `apps/api/`)

```bash
pnpm dev              # Start Bun dev server with watch mode (port 3001)
pnpm build            # Build for production
pnpm start            # Start production server
pnpm test             # Run Bun tests
pnpm lint             # Lint backend code
pnpm type-check       # TypeScript type checking
```

## 🧪 Testing

### Frontend Testing (Vitest)

```bash
# Run all frontend tests
pnpm --filter @supplex/web test

# Watch mode
pnpm --filter @supplex/web test:watch

# With coverage
pnpm --filter @supplex/web test -- --coverage
```

### Backend Testing (Bun Test)

```bash
# Run all backend tests
pnpm --filter @supplex/api test

# Specific test file
bun test src/index.test.ts
```

### Coverage Requirements

| Component Type | Coverage Target |
|----------------|-----------------|
| Services       | 80%+            |
| Repositories   | 90%+            |
| API Routes     | 80%+            |
| UI Components  | 70%+            |

## 🔧 Development Workflow

### Making Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Pre-commit hooks automatically run on `git commit`:
   - ESLint (with auto-fix)
   - Prettier (auto-format)
   - TypeScript type checking

### Type-Safe Development

All types are shared via `@supplex/types` package:

```typescript
// In any workspace
import type { User, ApiResponse } from "@supplex/types";
import { UserRoleSchema } from "@supplex/types";
```

### Adding Dependencies

```bash
# Add to specific workspace
pnpm --filter @supplex/web add react-query
pnpm --filter @supplex/api add @elysiajs/jwt

# Add dev dependency
pnpm --filter @supplex/web add -D @types/node

# Add to root (tooling only)
pnpm add -D -w husky
```

## 🏛️ Architecture

### High-Level Overview

Supplex follows a **monorepo architecture** with clear package boundaries:

1. **Frontend (Remix)**: Server-side rendered React application with loader/action patterns
2. **Backend (ElysiaJS)**: High-performance REST API with end-to-end type safety
3. **Shared Types**: Single source of truth for TypeScript types and Zod schemas
4. **Database**: PostgreSQL with Drizzle ORM, accessed via Supabase
5. **Multi-tenancy**: Row-level security enforced at database level

For detailed architecture documentation, see:
- [Architecture Overview](./docs/architecture/high-level-architecture.md)
- [Tech Stack Rationale](./docs/architecture/tech-stack.md)
- [Coding Standards](./docs/architecture/coding-standards.md)

### API Communication

The frontend communicates with the backend via **Eden Treaty** (type-safe REST client):

```typescript
// Type-safe API calls from frontend
import { edenTreaty } from "@elysiajs/eden";
import type { App } from "@supplex/api";

const api = edenTreaty<App>("http://localhost:3001");
const { data } = await api.health.get();
// 'data' is fully typed based on backend definition
```

## 📚 Documentation

- **PRD**: [Product Requirements Document](./docs/prd.md)
- **Architecture**: [Complete Architecture Docs](./docs/architecture/)
- **Frontend Spec**: [UI/UX Specifications](./docs/front-end-spec/)
- **Stories**: [User Stories](./docs/stories/)
- **QA**: [Test Scenarios](./docs/qa/)

### Epic Overview

This project is organized into 5 epics:

1. **Epic 1: Foundation** - Infrastructure, database, auth, base UI
2. **Epic 2: Supplier Qualification** - Onboarding workflows
3. **Epic 3: Performance Evaluation** - KPI tracking and scoring
4. **Epic 4: Complaints & CAPA** - Quality management
5. **Epic 5: Analytics & Reporting** - Dashboards and API platform

See [Epic List](./docs/prd/epic-list.md) for complete breakdown.

## 🚧 Troubleshooting

### pnpm not found

Install pnpm globally:

```bash
npm install -g pnpm@8.15.0
# or
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### Bun not found (Windows)

Bun requires WSL2 on Windows. Install WSL2:

```bash
wsl --install
```

Then install Bun inside WSL.

### Windows Development Setup (Dual Terminal)

On Windows, the backend and frontend run in separate terminals:

**Terminal 1 (WSL - Backend):**
```bash
# Open WSL terminal
wsl

# Navigate to project (adjust path as needed)
cd /mnt/c/Users/YourUser/path/to/supplex

# Run backend only
pnpm --filter @supplex/api dev
```

**Terminal 2 (PowerShell - Frontend):**
```powershell
# In Windows PowerShell
cd C:\Users\YourUser\path\to\supplex

# Run frontend only
pnpm --filter @supplex/web dev
```

**Or run both with root command** (frontend in PowerShell, backend must still run in WSL):
```bash
pnpm dev  # This starts both, but backend needs WSL
```

The backend API runs on `http://localhost:3001` (WSL), and frontend on `http://localhost:3000` (Windows), communicating via localhost network bridge.

### Port already in use

If ports 3000 or 3001 are in use:

```bash
# Change ports in .env files
# Frontend: PORT=3002
# Backend: PORT=3003
```

### TypeScript errors after install

Run type-check to verify:

```bash
pnpm type-check
```

If errors persist, try:

```bash
# Clean install
rm -rf node_modules
pnpm install
```

### Pre-commit hooks not running

Initialize Husky manually:

```bash
pnpm prepare
chmod +x .husky/pre-commit
```

## 🔐 Security

- All environment files are gitignored by default
- TypeScript strict mode catches potential bugs
- Pre-commit hooks prevent committing secrets or poorly formatted code
- Database queries enforce tenant isolation (Row-Level Security)

## 📝 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. For team members:

1. Follow the [Development Workflow](#-development-workflow)
2. Adhere to [Coding Standards](./docs/architecture/coding-standards.md)
3. Ensure all tests pass before opening PRs
4. Keep test coverage above requirements

## 📞 Support

For questions or issues:

- **Documentation**: Check `./docs/` directory
- **Architecture Questions**: See `./docs/architecture/`
- **Story Implementation**: See `./docs/stories/`

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-13  
**Status**: ✅ Development Environment Ready

