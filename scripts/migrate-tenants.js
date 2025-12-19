#!/usr/bin/env node

/**
 * Migration Script - Apply all pending migrations to tenant schemas
 *
 * Usage:
 *   npm run migration:deploy-all           - Migrate all tenants
 *   npm run migration:deploy -- <schema>   - Migrate specific tenant
 */

const migrationService = require('../controllers/services/migrationService');

async function main() {
  const args = process.argv.slice(2);
  const schemaName = args[0];

  try {
    if (schemaName) {
      // Migrate specific tenant
      console.log(`\n🎯 Migrating specific tenant: ${schemaName}\n`);

      const schemas = await migrationService.getAllTenantSchemas();
      if (!schemas.includes(schemaName)) {
        console.error(`❌ Schema "${schemaName}" not found`);
        console.log(`\nAvailable schemas:`);
        schemas.forEach(s => console.log(`  - ${s}`));
        process.exit(1);
      }

      // Backfill required tables
      await migrationService.backfillRequiredTables(schemaName);

      // Apply pending migrations
      const result = await migrationService.applyAllPendingMigrations(schemaName);

      if (result.success) {
        console.log(`\n✅ Migration complete for ${schemaName}`);
        console.log(`   Applied: ${result.applied} migration(s)`);
        process.exit(0);
      } else {
        console.error(`\n❌ Migration failed for ${schemaName}`);
        process.exit(1);
      }
    } else {
      // Migrate all tenants
      console.log(`\n🚀 Migrating all tenant schemas...\n`);

      const result = await migrationService.migrateAllTenants();

      if (result.failed === 0) {
        console.log(`\n✅ All migrations completed successfully!`);
        process.exit(0);
      } else {
        console.error(`\n⚠️  Some migrations failed. Check logs above.`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`\n❌ Migration error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

main();
