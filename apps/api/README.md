# Supplex API

High-performance REST API built with Bun + ElysiaJS for the Supplex supplier management platform.

## 🚀 Quick Start

### Prerequisites

- **Bun** >= 1.1.0 (install via `powershell -c "irm bun.sh/install.ps1|iex"`)
- **PostgreSQL** database (via Supabase)

### Installation

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Edit .env with your actual credentials
```

### Development

```bash
# Start development server with hot reload
bun run dev

# Server will start at http://localhost:3001
```

### Available Scripts

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run test` - Run tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage
- `bun run lint` - Lint code
- `bun run lint:fix` - Lint and auto-fix issues
- `bun run type-check` - TypeScript type checking
- `bun run clean` - Clean build artifacts and dependencies

## 📁 Project Structure

```
apps/api/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── config.ts         # Centralized configuration
│   ├── lib/              # Shared utilities
│   │   ├── db.ts         # Database client
│   │   ├── supabase.ts   # Supabase client
│   │   ├── rbac/         # Role-based access control
│   │   ├── audit/        # Audit logging
│   │   └── rate-limiter.ts
│   └── routes/           # API routes
│       ├── auth/         # Authentication routes
│       ├── users/        # User management
│       └── suppliers/    # Supplier management
├── bunfig.toml           # Bun configuration
├── tsconfig.json         # TypeScript configuration
├── .env                  # Environment variables (not in git)
└── .env.example          # Example environment variables

```

## 🔧 Configuration

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL=your_postgres_connection_string

# Security
JWT_SECRET=your_secret_min_32_chars
CORS_ORIGIN=http://localhost:5173

# Optional: Redis (for rate limiting)
REDIS_URL=your_redis_url
```

### bunfig.toml

The `bunfig.toml` file configures Bun runtime behavior:
- Hot reload enabled in development
- Watch paths configured for `src/` directory
- Test coverage threshold set to 80%

## 🏗️ Architecture

### Tech Stack

- **Runtime**: Bun 1.3+
- **Framework**: ElysiaJS 1.0+
- **Database**: PostgreSQL 15+ via Supabase
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Type Safety**: End-to-end with Eden Treaty

### Key Features

1. **Configuration Management**
   - Centralized in `src/config.ts`
   - Environment validation with Zod
   - Type-safe access throughout the app

2. **Error Handling**
   - Global error handler with proper status codes
   - Development vs production error messages
   - Structured error responses

3. **Request Logging**
   - Automatic request logging in development
   - ISO timestamp + method + URL format

4. **Graceful Shutdown**
   - Handles SIGTERM, SIGINT signals
   - Closes connections cleanly
   - Catches uncaught exceptions

5. **CORS Configuration**
   - Configurable origins
   - Credentials support
   - Proper headers and methods

## 🧪 Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage
```

Tests are located alongside source files with `.test.ts` extension.

## 📊 API Endpoints

### Health Check

```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2025-10-22T00:00:00.000Z",
  "uptime": 123.456,
  "memory": { ... }
}
```

### Root

```bash
GET /

Response:
{
  "message": "Supplex API",
  "version": "1.0.0",
  "status": "healthy",
  "environment": "development"
}
```

### API Routes

API routes are mounted under `/api`:
- `/api/auth/*` - Authentication
- `/api/users/*` - User management
- `/api/suppliers/*` - Supplier management

## 🔒 Security

- **CORS**: Configured for specific origins
- **JWT**: Token-based authentication
- **RLS**: Row-level security via Supabase
- **Rate Limiting**: (Optional) Redis-based rate limiting
- **Input Validation**: Zod schema validation

## 🚀 Deployment

### Build

```bash
bun run build
```

This creates an optimized bundle in `./dist/`.

### Production

```bash
NODE_ENV=production bun run start
```

### Environment Variables

Ensure all required environment variables are set in your production environment:
- Never commit `.env` to git
- Use secure secrets management
- Rotate JWT secrets regularly
- Use strong database passwords

## 🐛 Debugging

### Enable Debug Logging

Set environment variable:
```bash
NODE_ENV=development bun run dev
```

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change PORT in .env or kill the process
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

2. **Database Connection Failed**
   - Check `DATABASE_URL` in `.env`
   - Verify Supabase project is running
   - Check network connectivity

3. **Module Not Found**
   ```bash
   # Reinstall dependencies
   bun run clean
   bun install
   ```

## 📝 Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with `@supplex/config`
- **Prettier**: Auto-formatting on save
- **Import Order**: External → Internal → Types

## 🤝 Contributing

1. Follow the coding standards in `docs/architecture/coding-standards.md`
2. Write tests for new features
3. Run `bun run lint` before committing
4. Use conventional commits

## 📚 Resources

- [Bun Documentation](https://bun.sh/docs)
- [ElysiaJS Documentation](https://elysiajs.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Supabase Documentation](https://supabase.com/docs)

## 📄 License

Private - Supplex Platform
