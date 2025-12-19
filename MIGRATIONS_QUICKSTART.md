# Migrations Quick Start

## 🚀 Common Commands

```bash
# Check migration status
npm run migration:status

# Create new migration
npm run migration:create <name>

# Deploy to all tenants
npm run migration:deploy-all

# Backfill missing tables
npm run migration:backfill

# Rollback migration
npm run migration:rollback <version>

# Health check
npm run migration:verify
```

## 📋 Typical Workflow

### 1. Making Schema Changes

```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npm run migration:create my_feature

# 3. Check what will be applied
npm run migration:status

# 4. Deploy to all tenants
npm run migration:deploy-all

# 5. Verify success
npm run migration:verify
```

### 2. Fixing Existing Schemas

If schemas are missing required tables:

```bash
npm run migration:backfill
```

## 🔍 Checking Current State

```bash
# Overview of all tenants
npm run migration:status

# Specific tenant details
npm run migration:status john_12345678
```

## ⚠️ Emergency Rollback

```bash
# Rollback from all tenants
npm run migration:rollback 20241220_feature_name

# Rollback from specific tenant only
npm run migration:rollback 20241220_feature_name alice_87654321
```

## 📚 Full Documentation

See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for complete documentation.

## 🔧 Required Tables

Every tenant must have:
- `team_member`
- `vendor`
- `contact`
- `reminders`

Use `npm run migration:backfill` if any are missing.
