# Migration System Guide

## Overview

This project uses a **custom migration system** designed for multi-tenant database architecture. Each user gets their own PostgreSQL schema with isolated tables, and migrations are tracked and applied independently per tenant.

## Architecture

### Key Components

1. **MigrationService** ([migrationService.js](controllers/services/migrationService.js))
   - Manages migration lifecycle
   - Tracks applied migrations per tenant
   - Handles rollbacks and backfills

2. **TenantService** ([tenantService.js](controllers/services/tenantService.js))
   - Creates new tenant schemas
   - Integrates with MigrationService
   - Ensures schema consistency

3. **Prisma Integration**
   - Uses Prisma for schema definition
   - Generates SQL migration files
   - Custom adapter applies migrations to tenant schemas

### Required Tables

Every tenant schema MUST have these 4 tables:

1. **team_member** - Team/user management
2. **vendor** - Vendor information
3. **contact** - Contact management
4. **reminders** - Payment/notification reminders

### Migration Tracking

Each tenant schema has a `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64)
);
```

This tracks which migrations have been applied to each tenant.

---

## Common Workflows

### 1. Creating a New Migration

When you need to add/modify database schema:

```bash
# 1. Update prisma/schema.prisma with your changes
# 2. Generate migration
npm run migration:create <migration_name>

# Example:
npm run migration:create add_user_preferences
```

This will:
- Generate migration files in `prisma/migrations/<timestamp>_<name>/`
- Create `migration.sql` (up migration)
- You should manually create `rollback.sql` (down migration) if needed

### 2. Checking Migration Status

Check which migrations are applied:

```bash
# Check all tenants
npm run migration:status

# Check specific tenant
npm run migration:status <schema_name>

# Example:
npm run migration:status john_12345678
```

Output shows:
- Applied vs pending migrations
- Required tables status
- Overall health

### 3. Applying Migrations

Deploy migrations to tenant schemas:

```bash
# Apply to ALL tenants
npm run migration:deploy-all

# Apply to specific tenant
npm run migration:deploy <schema_name>

# Example:
npm run migration:deploy alice_87654321
```

### 4. Backfilling Missing Tables

If existing schemas are missing required tables:

```bash
npm run migration:backfill
```

This ensures all schemas have the 4 required tables.

### 5. Rolling Back Migrations

Revert a migration (requires `rollback.sql`):

```bash
# Rollback from all tenants
npm run migration:rollback <migration_version>

# Rollback from specific tenant
npm run migration:rollback <migration_version> <schema_name>

# Example:
npm run migration:rollback 20241218_initial_schema
npm run migration:rollback 20241220_add_preferences john_12345678
```

### 6. Health Checks

Verify schema integrity:

```bash
npm run migration:verify
```

Shows which schemas are healthy vs need attention.

---

## Development Workflow

### Adding a New Feature

**Example: Adding a `user_preferences` table**

1. **Update Prisma Schema**

   Edit `prisma/schema.prisma`:

   ```prisma
   model UserPreferences {
     id          String   @id @default(uuid()) @db.Uuid
     us_id       String   @unique
     theme       String   @default("light")
     language    String   @default("en")
     created_at  DateTime @default(now())
     updated_at  DateTime @default(now())

     @@map("user_preferences")
   }
   ```

2. **Create Migration**

   ```bash
   npm run migration:create add_user_preferences
   ```

3. **Create Rollback SQL** (optional but recommended)

   In `prisma/migrations/XXXXXX_add_user_preferences/rollback.sql`:

   ```sql
   DROP TABLE IF EXISTS "user_preferences";
   ```

4. **Test Migration Locally**

   ```bash
   # Check what will be applied
   npm run migration:status

   # Apply to all tenants
   npm run migration:deploy-all
   ```

5. **Verify Success**

   ```bash
   npm run migration:verify
   ```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Test migration on development database
- [ ] Review migration SQL for breaking changes
- [ ] Create rollback script (`rollback.sql`)
- [ ] Backup production database
- [ ] Schedule maintenance window if needed

### Deployment Steps

1. **Backup Database**

   ```bash
   pg_dump -h localhost -U postgres -d clicarity > backup_$(date +%Y%m%d).sql
   ```

2. **Check Current Status**

   ```bash
   npm run migration:status
   ```

3. **Deploy Migration**

   ```bash
   npm run migration:deploy-all
   ```

4. **Verify Deployment**

   ```bash
   npm run migration:verify
   ```

5. **Monitor for Issues**

   Check application logs for any errors related to new schema changes.

### Rollback Procedure (if needed)

1. **Identify Migration Version**

   ```bash
   npm run migration:status
   ```

2. **Rollback**

   ```bash
   npm run migration:rollback <version>
   ```

3. **Verify**

   ```bash
   npm run migration:verify
   ```

---

## How It Works Under the Hood

### New User Registration

When a user registers:

1. User record created in `users` table
2. Schema name generated: `{username}_{random8digits}`
3. `TenantService.createTenantSchema()` called:
   - Creates PostgreSQL schema
   - Enables UUID extension
   - Creates `schema_migrations` tracking table
   - Applies all pending migrations
   - Backfills required tables if needed
   - Inserts initial team member

### Applying Migrations

When you run `npm run migration:deploy-all`:

1. **Discovery**: Finds all tenant schemas
2. **For each schema**:
   - Read migration files from `prisma/migrations/`
   - Check `schema_migrations` table for applied migrations
   - Calculate pending migrations
   - **Adapt SQL**: Replace `public` with tenant schema name
   - **Apply**: Execute SQL in transaction
   - **Record**: Insert into `schema_migrations`
3. **Summary**: Report success/failure statistics

### SQL Adaptation

Original Prisma migration:

```sql
CREATE TABLE "public"."user_preferences" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "theme" TEXT
);
```

Adapted for tenant `john_12345678`:

```sql
CREATE TABLE "john_12345678"."user_preferences" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "theme" TEXT
);
```

---

## Troubleshooting

### Issue: "Migration already applied"

**Symptom**: Migration shows as applied but changes aren't visible

**Solution**:
```bash
# Check migration status
npm run migration:status <schema_name>

# If needed, manually inspect
psql -d clicarity -c "SELECT * FROM <schema_name>.schema_migrations;"
```

### Issue: "Missing required tables"

**Symptom**: Schema missing `vendor`, `contact`, or other required tables

**Solution**:
```bash
npm run migration:backfill
```

### Issue: "Migration failed midway"

**Symptom**: Some schemas migrated, others failed

**Solution**:
1. Check error logs to identify issue
2. Fix underlying problem
3. Re-run migration (it will skip already-applied migrations):
   ```bash
   npm run migration:deploy-all
   ```

### Issue: "Need to rollback migration"

**Symptom**: Migration caused issues in production

**Solution**:
```bash
# Rollback specific migration
npm run migration:rollback <version>

# Or rollback from specific tenant
npm run migration:rollback <version> <schema_name>
```

---

## Migration Best Practices

### DO ✅

- **Always test migrations locally first**
- **Create rollback scripts for destructive changes**
- **Use transactions** (already handled by MigrationService)
- **Backup before major migrations**
- **Use descriptive migration names** (`add_user_preferences`, not `migration1`)
- **Keep migrations small and focused** (one feature per migration)
- **Use `IF NOT EXISTS`** for idempotent operations

### DON'T ❌

- **Don't manually edit migration files after applying**
- **Don't delete migration files** (breaks version history)
- **Don't skip migrations** (apply in order)
- **Don't modify data in schema migrations** (use separate data migration scripts)
- **Don't deploy without testing**
- **Don't forget to run `migration:verify` after deployment**

---

## File Structure

```
Clicarity_Backend/
├── controllers/
│   └── services/
│       ├── migrationService.js     # Core migration logic
│       └── tenantService.js        # Tenant schema management
├── prisma/
│   ├── schema.prisma               # Prisma schema definition
│   └── migrations/                 # Migration files
│       └── YYYYMMDD_name/
│           ├── migration.sql       # Up migration
│           └── rollback.sql        # Down migration (optional)
├── scripts/
│   ├── migrate-tenants.js          # Deploy migrations
│   ├── migration-status.js         # Check status
│   ├── backfill-schemas.js         # Backfill required tables
│   └── rollback-migration.js       # Rollback utility
└── MIGRATION_GUIDE.md              # This file
```

---

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `npm run migration:create <name>` | Create new migration via Prisma |
| `npm run migration:status` | Show status for all tenants |
| `npm run migration:status <schema>` | Show status for specific tenant |
| `npm run migration:deploy-all` | Apply pending migrations to all tenants |
| `npm run migration:deploy <schema>` | Apply migrations to specific tenant |
| `npm run migration:backfill` | Backfill missing required tables |
| `npm run migration:rollback <version>` | Rollback migration from all tenants |
| `npm run migration:rollback <version> <schema>` | Rollback from specific tenant |
| `npm run migration:verify` | Health check for all schemas |

---

## Advanced Topics

### Custom Data Migrations

For data transformations that can't be expressed in SQL DDL:

1. Create migration normally
2. Add data transformation logic in `migration.sql`
3. Use `DO $$` blocks for complex operations

Example:

```sql
-- In migration.sql
CREATE TABLE "new_table" (...);

-- Migrate data
DO $$
BEGIN
  INSERT INTO "new_table" (...)
  SELECT ... FROM "old_table" WHERE ...;
END $$;
```

### Multi-Step Migrations

For breaking changes that require multiple steps:

1. **Step 1**: Add new column (nullable)
2. **Step 2**: Populate data
3. **Step 3**: Make column NOT NULL
4. **Step 4**: Remove old column

Create separate migrations for each step.

### Emergency Fixes

If a migration breaks production:

1. **Immediate**: Rollback if possible
   ```bash
   npm run migration:rollback <version>
   ```

2. **Fix Forward**: Create new migration to fix issue
   ```bash
   npm run migration:create fix_issue
   # Edit migration.sql with fix
   npm run migration:deploy-all
   ```

---

## FAQ

**Q: Can I manually edit a migration after it's applied?**
A: No. Once applied, migrations are immutable. Create a new migration for changes.

**Q: What if I need to modify data, not just schema?**
A: Include data modification SQL in your `migration.sql` using `INSERT`, `UPDATE`, `DELETE` statements.

**Q: How do I handle migrations for new vs existing tenants?**
A: The system handles this automatically. New tenants get all migrations applied during creation. Existing tenants only get pending migrations.

**Q: Can I run migrations selectively on some tenants?**
A: Yes, use `npm run migration:deploy <schema_name>` for specific tenants.

**Q: What happens if a migration fails halfway through?**
A: Each migration runs in a transaction. If it fails, changes are rolled back for that schema. Other schemas are unaffected.

**Q: How do I handle conflicts when multiple developers create migrations?**
A: Migrations are timestamped by Prisma. Merge conflicts should be resolved by renaming and ordering migrations properly.

---

## Support

For issues or questions:
1. Check this guide
2. Review error logs
3. Run `npm run migration:verify` to diagnose
4. Check [migrationService.js](controllers/services/migrationService.js) source code

## Changelog

- **2024-12-19**: Initial migration system implemented with tracking, rollback support, and auto-backfill
