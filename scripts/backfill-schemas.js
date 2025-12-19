#!/usr/bin/env node

/**
 * Backfill Script - Ensure all tenant schemas have required tables
 *
 * This script checks all existing tenant schemas and backfills
 * any missing required tables (team_member, vendor, contact, reminders)
 *
 * Usage:
 *   npm run migration:backfill
 */

const migrationService = require('../controllers/services/migrationService');

async function main() {
  try {
    console.log(`\n🔧 Backfilling Required Tables for All Tenants\n`);

    const schemas = await migrationService.getAllTenantSchemas();

    if (schemas.length === 0) {
      console.log('⚠️  No tenant schemas found');
      process.exit(0);
    }

    console.log(`Found ${schemas.length} tenant schema(s)\n`);
    console.log(`Required tables: team_member, vendor, contact, reminders\n`);
    console.log(`${'─'.repeat(60)}\n`);

    let backfilledCount = 0;
    let errorCount = 0;
    const results = [];

    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i];
      console.log(`[${i + 1}/${schemas.length}] Checking: ${schema}`);

      try {
        const result = await migrationService.backfillRequiredTables(schema);

        if (result.backfilled.length > 0) {
          console.log(`  ✓ Backfilled: ${result.backfilled.join(', ')}`);
          backfilledCount++;
        } else {
          console.log(`  ✓ All tables present`);
        }

        results.push({ schema, success: true, backfilled: result.backfilled });
      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        errorCount++;
        results.push({ schema, success: false, error: error.message });
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Backfill Summary:`);
    console.log(`  Total Schemas: ${schemas.length}`);
    console.log(`  Backfilled: ${backfilledCount}`);
    console.log(`  Already Complete: ${schemas.length - backfilledCount - errorCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`${'═'.repeat(60)}\n`);

    if (errorCount > 0) {
      console.log(`❌ Schemas with errors:`);
      results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.schema}: ${r.error}`));
      console.log('');
      process.exit(1);
    } else {
      console.log(`✅ All schemas now have required tables!\n`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ Backfill error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
