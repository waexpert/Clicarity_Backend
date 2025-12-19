#!/usr/bin/env node

/**
 * Migration Status Script - Check migration status for tenant schemas
 *
 * Usage:
 *   npm run migration:status           - Show status for all tenants
 *   npm run migration:status <schema>  - Show status for specific tenant
 */

const migrationService = require('../controllers/services/migrationService');

async function main() {
  const args = process.argv.slice(2);
  const schemaName = args[0];

  try {
    if (schemaName) {
      // Show status for specific tenant
      console.log(`\n📊 Migration Status for: ${schemaName}\n`);

      const schemas = await migrationService.getAllTenantSchemas();
      if (!schemas.includes(schemaName)) {
        console.error(`❌ Schema "${schemaName}" not found`);
        console.log(`\nAvailable schemas:`);
        schemas.forEach(s => console.log(`  - ${s}`));
        process.exit(1);
      }

      const status = await migrationService.getMigrationStatus(schemaName);

      console.log(`Schema: ${status.schema}`);
      console.log(`${'─'.repeat(60)}`);
      console.log(`Migrations: ${status.applied}/${status.total} applied`);
      console.log(`Pending: ${status.pending}`);
      console.log(`\nRequired Tables (${status.requiredTables.existing.length}/4):`);
      console.log(`  ✓ ${status.requiredTables.existing.join(', ')}`);

      if (status.requiredTables.missing.length > 0) {
        console.log(`  ✗ Missing: ${status.requiredTables.missing.join(', ')}`);
      }

      if (status.appliedList.length > 0) {
        console.log(`\nApplied Migrations:`);
        status.appliedList.forEach(m => console.log(`  ✓ ${m}`));
      }

      if (status.pendingList.length > 0) {
        console.log(`\nPending Migrations:`);
        status.pendingList.forEach(m => console.log(`  ⧗ ${m}`));
        console.log(`\n💡 Run: npm run migration:deploy-all`);
      } else {
        console.log(`\n✅ Schema is up to date!`);
      }

      process.exit(0);
    } else {
      // Show status for all tenants
      console.log(`\n📊 Migration Status - All Tenants\n`);

      const schemas = await migrationService.getAllTenantSchemas();

      if (schemas.length === 0) {
        console.log('⚠️  No tenant schemas found');
        process.exit(0);
      }

      console.log(`Total Schemas: ${schemas.length}\n`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`${'Schema'.padEnd(30)} ${'Migrations'.padEnd(15)} ${'Tables'.padEnd(10)} ${'Status'}`);
      console.log(`${'─'.repeat(80)}`);

      let needsAttention = 0;

      for (const schema of schemas) {
        const status = await migrationService.getMigrationStatus(schema);

        const migrationStr = `${status.applied}/${status.total}`;
        const tableStr = `${status.requiredTables.existing.length}/4`;
        const isHealthy = status.pending === 0 && status.requiredTables.hasAll;
        const statusIcon = isHealthy ? '✅' : '⚠️ ';

        if (!isHealthy) needsAttention++;

        console.log(
          `${schema.padEnd(30)} ${migrationStr.padEnd(15)} ${tableStr.padEnd(10)} ${statusIcon}`
        );
      }

      console.log(`${'─'.repeat(80)}`);
      console.log(`\nSummary:`);
      console.log(`  ✅ Healthy: ${schemas.length - needsAttention}`);
      console.log(`  ⚠️  Needs Attention: ${needsAttention}`);

      if (needsAttention > 0) {
        console.log(`\n💡 Run: npm run migration:deploy-all`);
      } else {
        console.log(`\n✅ All schemas are up to date!`);
      }

      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
