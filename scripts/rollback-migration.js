#!/usr/bin/env node

/**
 * Rollback Script - Rollback a specific migration from tenant schemas
 *
 * Usage:
 *   npm run migration:rollback <migration-version>            - Rollback from all tenants
 *   npm run migration:rollback <migration-version> <schema>   - Rollback from specific tenant
 *
 * Example:
 *   npm run migration:rollback 20241218_initial_schema
 *   npm run migration:rollback 20241218_initial_schema john_12345678
 */

const migrationService = require('../controllers/services/migrationService');

async function main() {
  const args = process.argv.slice(2);
  const migrationVersion = args[0];
  const schemaName = args[1];

  if (!migrationVersion) {
    console.error(`\n❌ Missing migration version`);
    console.log(`\nUsage:`);
    console.log(`  npm run migration:rollback <migration-version>`);
    console.log(`  npm run migration:rollback <migration-version> <schema>\n`);

    // Show available migrations
    const migrations = await migrationService.getAllMigrations();
    if (migrations.length > 0) {
      console.log(`Available migrations:`);
      migrations.forEach(m => console.log(`  - ${m}`));
      console.log('');
    }

    process.exit(1);
  }

  try {
    if (schemaName) {
      // Rollback from specific tenant
      console.log(`\n⎌ Rolling back migration from specific tenant\n`);
      console.log(`Migration: ${migrationVersion}`);
      console.log(`Schema: ${schemaName}\n`);

      const schemas = await migrationService.getAllTenantSchemas();
      if (!schemas.includes(schemaName)) {
        console.error(`❌ Schema "${schemaName}" not found`);
        console.log(`\nAvailable schemas:`);
        schemas.forEach(s => console.log(`  - ${s}`));
        process.exit(1);
      }

      const result = await migrationService.rollbackMigration(schemaName, migrationVersion);

      if (result.success && !result.skipped) {
        console.log(`\n✅ Rollback complete for ${schemaName}`);
        process.exit(0);
      } else if (result.skipped) {
        console.log(`\n⊘ Migration was not applied to ${schemaName}`);
        process.exit(0);
      } else {
        console.error(`\n❌ Rollback failed for ${schemaName}`);
        process.exit(1);
      }
    } else {
      // Rollback from all tenants
      console.log(`\n⎌ Rolling back migration from all tenants\n`);
      console.log(`Migration: ${migrationVersion}\n`);

      const schemas = await migrationService.getAllTenantSchemas();

      if (schemas.length === 0) {
        console.log('⚠️  No tenant schemas found');
        process.exit(0);
      }

      console.log(`Found ${schemas.length} tenant schema(s)\n`);

      // Confirm with user
      console.log(`⚠️  WARNING: This will rollback the migration from ALL tenant schemas.`);
      console.log(`This action cannot be undone automatically.\n`);

      // In a real scenario, you'd want to add confirmation here
      // For now, we'll proceed

      let successful = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < schemas.length; i++) {
        const schema = schemas[i];
        console.log(`[${i + 1}/${schemas.length}] Rolling back from: ${schema}`);

        try {
          const result = await migrationService.rollbackMigration(schema, migrationVersion);

          if (result.success && !result.skipped) {
            console.log(`  ✓ Rolled back`);
            successful++;
          } else if (result.skipped) {
            console.log(`  ⊘ Not applied`);
            skipped++;
          }
        } catch (error) {
          console.error(`  ✗ Error: ${error.message}`);
          failed++;
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`Rollback Summary:`);
      console.log(`  Total Schemas: ${schemas.length}`);
      console.log(`  ✓ Rolled Back: ${successful}`);
      console.log(`  ⊘ Skipped (not applied): ${skipped}`);
      console.log(`  ✗ Failed: ${failed}`);
      console.log(`${'═'.repeat(60)}\n`);

      if (failed === 0) {
        console.log(`✅ Rollback completed successfully!\n`);
        process.exit(0);
      } else {
        console.error(`⚠️  Some rollbacks failed. Check logs above.\n`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`\n❌ Rollback error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
