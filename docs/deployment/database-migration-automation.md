# Database Migration Automation

This guide covers automated database migrations for Supplex using Drizzle ORM and Drizzle Kit.

## Overview

Database migrations run automatically during deployment via Fly.io's `release_command` feature. This ensures the database schema is always in sync with the application code.

## Migration Workflow

### Development Workflow

```mermaid
graph LR
    A[Modify Schema] --> B[Generate Migration]
    B --> C[Review Migration SQL]
    C --> D[Test Locally]
    D --> E[Commit Migration]
    E --> F[Push to GitHub]
    F --> G[Deploy to Production]
    G --> H[Auto-run Migration]
```

### Step-by-Step Process

#### 1. Modify Database Schema

Edit schema files in `packages/db/src/schema/`:

```typescript
// packages/db/src/schema/suppliers.ts
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Add new column
  website: text("website"),
  // ...
});
```

#### 2. Generate Migration

```bash
# From project root
pnpm --filter @supplex/db db:generate

# This creates a new migration file in packages/db/migrations/
# Example: packages/db/migrations/0001_add_website_to_suppliers.sql
```

#### 3. Review Migration SQL

Always review generated SQL before committing:

```bash
# View the migration file
cat packages/db/migrations/0001_*.sql
```

Example output:
```sql
ALTER TABLE "suppliers" ADD COLUMN "website" text;
```

#### 4. Test Migration Locally

```bash
# Apply migration to local database
pnpm --filter @supplex/db db:migrate

# Verify schema
pnpm --filter @supplex/db db:studio
```

#### 5. Commit Migration Files

```bash
git add packages/db/migrations/
git add packages/db/src/schema/
git commit -m "feat: Add website column to suppliers table"
```

#### 6. Deploy

Push to GitHub, and migrations run automatically on deployment.

## Automated Migration on Deployment

### How It Works

The `fly.toml` configuration includes:

```toml
[deploy]
  release_command = "bun run db:migrate"
  strategy = "immediate"
```

**Deployment sequence:**
1. Code is built
2. Release command runs migrations
3. If migrations succeed → Deploy new version
4. If migrations fail → Deployment aborted, previous version continues running

### Migration Scripts

#### Production Migration Script

Located at `packages/db/scripts/migrate-production.ts`

**Features:**
- Pre-flight environment validation
- Database connectivity check
- Migration directory verification
- Detailed progress logging
- Error handling and rollback on failure

**Usage:**
```bash
# Via package.json script
pnpm --filter @supplex/db db:migrate:prod

# Or directly
bun run packages/db/scripts/migrate-production.ts
```

#### Standard Migration

Uses Drizzle Kit directly:

```bash
pnpm --filter @supplex/db db:migrate
```

### Configuration

**Drizzle Kit Configuration** (`packages/db/drizzle.config.ts`):

```typescript
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (required)

## Migration Best Practices

### 1. Always Make Backward-Compatible Changes

**Good:**
```sql
-- Add nullable column
ALTER TABLE suppliers ADD COLUMN website text;

-- Add column with default
ALTER TABLE suppliers ADD COLUMN status text DEFAULT 'active';
```

**Avoid:**
```sql
-- Drop column (breaking change)
ALTER TABLE suppliers DROP COLUMN name;

-- Make existing column NOT NULL (breaking change if data exists)
ALTER TABLE suppliers ALTER COLUMN email SET NOT NULL;
```

### 2. Split Breaking Changes into Multiple Deployments

**Example: Renaming a column**

**Deployment 1:** Add new column
```sql
ALTER TABLE suppliers ADD COLUMN contact_email text;
UPDATE suppliers SET contact_email = email;
```

**Deployment 2:** Update application to use `contact_email`

**Deployment 3:** Remove old column
```sql
ALTER TABLE suppliers DROP COLUMN email;
```

### 3. Test Migrations Against Production-Like Data

```bash
# 1. Export production schema (metadata only)
pg_dump --schema-only $PRODUCTION_DATABASE_URL > prod_schema.sql

# 2. Create test database
psql $LOCAL_DATABASE_URL < prod_schema.sql

# 3. Generate sample data
pnpm --filter @supplex/db db:seed

# 4. Test migration
pnpm --filter @supplex/db db:migrate

# 5. Verify application works
pnpm --filter @supplex/api dev
```

### 4. Include Data Migrations When Needed

```sql
-- Schema change
ALTER TABLE suppliers ADD COLUMN status text DEFAULT 'active';

-- Data migration
UPDATE suppliers 
SET status = CASE 
  WHEN is_active = true THEN 'active'
  WHEN is_active = false THEN 'inactive'
  ELSE 'pending'
END;

-- Clean up
ALTER TABLE suppliers DROP COLUMN is_active;
```

### 5. Always Include Rollback Plan

Document rollback steps in migration commit message:

```bash
git commit -m "feat: Add supplier status column

Migration adds 'status' column to suppliers table.

Rollback plan:
1. Revert deployment: flyctl releases rollback <version>
2. Create reverse migration:
   ALTER TABLE suppliers DROP COLUMN status;
3. Apply reverse migration
"
```

## Rollback Procedures

### Automatic Rollback (Recommended)

If a migration fails, Fly.io automatically aborts deployment and keeps the previous version running.

**No action needed** - the database and application remain in sync.

### Manual Rollback

#### Option 1: Reverse Migration (Preferred)

1. **Create reverse migration:**
   ```bash
   # Edit schema to undo changes
   # Then generate new migration
   pnpm --filter @supplex/db db:generate
   ```

2. **Review reverse migration SQL:**
   ```bash
   cat packages/db/migrations/0002_*.sql
   ```

3. **Apply reverse migration:**
   ```bash
   pnpm --filter @supplex/db db:migrate
   ```

4. **Deploy:**
   ```bash
   git add packages/db/migrations/
   git commit -m "revert: Rollback supplier status column"
   git push origin main
   ```

#### Option 2: Use Rollback Helper Script

```bash
# View migration history
pnpm --filter @supplex/db db:rollback

# Follow instructions in output to create reverse migration
```

#### Option 3: Database Restore (Last Resort)

**For critical failures only:**

1. **Go to Supabase Dashboard:**
   - Project → Database → Backups
   - Select backup from before failed migration

2. **Restore backup:**
   - Click "Restore" on chosen backup
   - Confirm restoration

3. **Rollback application:**
   ```bash
   flyctl releases rollback <version> -a supplex-api
   ```

⚠️ **Warning:** This loses all data changes since the backup.

## Monitoring Migrations

### Via Health Check Endpoint

The health check endpoint verifies database connectivity:

```bash
curl https://supplex-api.fly.dev/api/health
```

Expected response:
```json
{
  "status": "ok",
  "checks": {
    "database": "connected"
  }
}
```

### Via Fly.io Logs

```bash
# View migration logs during deployment
flyctl logs -a supplex-api

# Filter for migration logs
flyctl logs -a supplex-api | grep "migration"
```

### Via Drizzle Studio

```bash
# Connect to production database
DATABASE_URL="postgresql://..." pnpm --filter @supplex/db db:studio

# View __drizzle_migrations table
```

### Via PostgreSQL

```bash
# Connect to database
psql $DATABASE_URL

# View migration history
SELECT id, hash, created_at, success
FROM __drizzle_migrations
ORDER BY created_at DESC
LIMIT 10;

# Exit
\q
```

## Troubleshooting

### Migration Fails: "relation already exists"

**Cause:** Migration was partially applied or schema drift

**Fix:**
```bash
# 1. Check current schema
psql $DATABASE_URL -c "\d suppliers"

# 2. If column exists, mark migration as applied manually
psql $DATABASE_URL -c "
  INSERT INTO __drizzle_migrations (hash, created_at, success)
  VALUES ('migration_hash', NOW(), true);
"

# 3. Or reset and reapply
# WARNING: Only do this in development
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm --filter @supplex/db db:migrate
```

### Migration Fails: "permission denied"

**Cause:** Database user lacks permissions

**Fix:**
```bash
# Verify user has necessary permissions
psql $DATABASE_URL -c "
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
"
```

### Deployment Fails: "migration timeout"

**Cause:** Migration taking too long (> 60 seconds)

**Fix:**
1. Split large migration into smaller chunks
2. Run data-heavy migrations separately:
   ```bash
   # SSH into Fly.io machine
   flyctl ssh console -a supplex-api
   
   # Run migration manually
   cd /app
   bun run db:migrate
   
   # Exit
   exit
   ```

### Migration Succeeds but Application Breaks

**Cause:** Code not compatible with new schema

**Fix:**
```bash
# Rollback deployment (code only)
flyctl releases rollback <version> -a supplex-api

# Database remains on new schema
# Create hotfix to make code compatible
# Deploy hotfix
```

## CI/CD Integration

### GitHub Actions

Migrations are NOT run in CI. They run only on deployment to prevent:
- Modifying production database during tests
- Race conditions with multiple CI runs

### Deployment Flow

```yaml
# .github/workflows/deploy-backend.yml
- Deploy to Fly.io
  ↓
- Fly.io runs release_command
  ↓
- Migrations apply automatically
  ↓
- Health check verifies success
  ↓
- Traffic routes to new version
```

## Security Considerations

1. **Never expose `DATABASE_URL`** - Store as secret in Fly.io
2. **Use separate databases** - Dev, staging, production
3. **Limit migration user permissions** - Only grant necessary privileges
4. **Audit migration history** - Monitor `__drizzle_migrations` table
5. **Backup before migrations** - Supabase auto-backups daily, verify schedule

## Performance Considerations

### Index Creation

**Bad:** Blocks table during index creation
```sql
CREATE INDEX idx_supplier_name ON suppliers(name);
```

**Good:** Creates index without blocking
```sql
CREATE INDEX CONCURRENTLY idx_supplier_name ON suppliers(name);
```

### Large Data Migrations

For tables with >1M rows:
```sql
-- Bad: Locks entire table
UPDATE suppliers SET status = 'active';

-- Good: Batch updates
DO $$
DECLARE
  batch_size INT := 1000;
BEGIN
  LOOP
    UPDATE suppliers 
    SET status = 'active' 
    WHERE id IN (
      SELECT id FROM suppliers 
      WHERE status IS NULL 
      LIMIT batch_size
    );
    
    EXIT WHEN NOT FOUND;
    COMMIT;
  END LOOP;
END $$;
```

## Next Steps

- [Rollback Procedures](./rollback-procedure.md)
- [Fly.io Deployment Setup](./flyio-deployment-setup.md)
- [Environment Variables Configuration](./environment-variables.md)

