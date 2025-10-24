# Supplex - Supplier Management Platform

A modern, cloud-native supplier management platform built for pharmaceutical and medical device companies to streamline supplier lifecycle management, qualification workflows, and compliance tracking.

## 📊 Status

[![CI](https://github.com/supplex/supplex/actions/workflows/ci.yml/badge.svg)](https://github.com/supplex/supplex/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/supplex/supplex/branch/main/graph/badge.svg)](https://codecov.io/gh/supplex/supplex)
[![Deployment](https://img.shields.io/badge/deployment-active-success)](https://github.com/supplex/supplex/deployments)

**Deployments:**
- 🌐 Frontend: [supplex.vercel.app](https://supplex.vercel.app) 
- 🔌 Backend API: [supplex-api.fly.dev](https://supplex-api.fly.dev)
- 🏥 Health Check: [supplex-api.fly.dev/api/health](https://supplex-api.fly.dev/api/health)

## 🚀 Quick Start

```bash
# Install all dependencies
pnpm install

# Start development servers
pnpm dev

# Windows users: If you get "bun not recognized" error after installing Bun:
# Option 1: Use the wrapper script
.\dev.ps1

# Option 2: Restart your terminal/IDE (recommended)
```

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/health

## 📋 Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.15.0
- **Bun** >= 1.1.0 (for backend API)
- **PostgreSQL** (via Supabase)

### Installing Prerequisites

**pnpm:**
```bash
npm install -g pnpm@8.15.0
```

**Bun:**
```bash
# Windows
powershell -c "irm bun.sh/install.ps1|iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

**Important for Windows users**: After installing Bun, you need to either:
1. Restart your terminal/IDE (recommended), OR
2. Use the included `dev.ps1` wrapper script

## 📁 Project Structure

```
supplex/
├── apps/
│   ├── api/          # Backend API (Bun + ElysiaJS)
│   └── web/          # Frontend (Remix + React)
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

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Remix + React + TypeScript | SSR web application |
| **Backend** | Bun + ElysiaJS + TypeScript | High-performance REST API |
| **Database** | PostgreSQL + Supabase | Managed database with RLS |
| **ORM** | Drizzle | Type-safe database queries |
| **Styling** | Tailwind CSS + shadcn/ui | Utility-first CSS + components |
| **Auth** | Supabase Auth | Email/password + OAuth |
| **State** | Zustand | Lightweight state management |
| **Forms** | React Hook Form + Zod | Form handling + validation |
| **Testing** | Vitest + Playwright | Unit + E2E testing |
| **Package Manager** | pnpm workspaces | Monorepo management |

See [docs/architecture/tech-stack.md](./docs/architecture/tech-stack.md) for detailed rationale.

## 📦 Available Scripts

### Root Level

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript checks
pnpm format           # Format code with Prettier

# Database
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed database
```

### Package Specific

```bash
# Backend API
cd apps/api
bun run dev           # Start API server
bun test              # Run API tests
bun run build         # Build for production

# Frontend
cd apps/web
pnpm dev              # Start Remix dev server
pnpm test             # Run frontend tests
pnpm build            # Build for production
```

## 🔧 Configuration

### Environment Variables

Copy the example files and configure:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

See [SETUP.md](./SETUP.md) for detailed configuration instructions.

### Key Environment Variables

**Backend (`apps/api/.env`):**
- `PORT` - API server port (default: 3001)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `CORS_ORIGIN` - Frontend URL (default: http://localhost:5173)

**Frontend (`apps/web/.env`):**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SESSION_SECRET` - Remix session secret

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm --filter @supplex/api test:watch
pnpm --filter @supplex/web test:watch

# Run E2E tests
pnpm playwright test

# Run with coverage
pnpm --filter @supplex/api test:coverage
```

## 🏗️ Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   pnpm dev          # Start servers
   pnpm test         # Run tests
   pnpm lint         # Check code style
   ```

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```
   
   Pre-commit hooks will automatically:
   - Run ESLint and auto-fix issues
   - Format code with Prettier
   - Run TypeScript checks

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[docs/architecture/](./docs/architecture/)** - Architecture documentation
- **[docs/prd/](./docs/prd/)** - Product requirements
- **[docs/stories/](./docs/stories/)** - User stories & tasks
- **[apps/api/README.md](./apps/api/README.md)** - Backend API documentation

### Key Documents

- [Coding Standards](./docs/architecture/coding-standards.md)
- [Tech Stack Rationale](./docs/architecture/tech-stack.md)
- [Database Schema](./docs/architecture/database-schema.md)
- [API Specification](./docs/architecture/api-specification.md)
- [Testing Strategy](./docs/architecture/testing-strategy.md)

## 🐛 Troubleshooting

### "bun not recognized" Error (Windows)

After installing Bun, you must either:
1. **Restart your terminal/IDE** (recommended)
2. **Use the wrapper script**: `.\dev.ps1`

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3001 | xargs kill -9
```

### TypeScript Errors

```bash
# Rebuild types package
pnpm --filter @supplex/types build

# Restart TypeScript server in your IDE
```

### Database Connection Issues

1. Verify Supabase project is running
2. Check `DATABASE_URL` in `apps/api/.env`
3. Ensure IP is whitelisted in Supabase (or disable restrictions for development)

### Frontend Not Loading

1. Check that port 5173 is not in use
2. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `apps/web/.env`
3. Clear Vite cache: `rm -rf apps/web/node_modules/.vite`

## 🤝 Contributing

1. Follow the [Coding Standards](./docs/architecture/coding-standards.md)
2. Write tests for new features
3. Ensure all tests pass: `pnpm test`
4. Ensure no linting errors: `pnpm lint`
5. Use conventional commit messages

## 📄 License

Private - Supplex Platform

## 🆘 Getting Help

- Check [SETUP.md](./SETUP.md) for setup issues
- Review [docs/architecture/](./docs/architecture/) for technical details
- Check individual package READMEs for specific issues

---

**Built with ❤️ using modern web technologies**
