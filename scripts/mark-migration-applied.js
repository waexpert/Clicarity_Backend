#!/usr/bin/env node

/**
 * Mark Migration as Applied - Manually record a migration without executing it
 *
 * Use this when tables already exist but migration tracking needs to be updated
 *
 * Usage:
 *   npm run migration:mark-applied <version>           - Mark for all tenants
 *   npm run migration:mark-applied <version> <schema>  - Mark for specific tenant
 */

const migrationService = require('../controllers/services/migrationService');
const pool = require('../database/databaseConnection');

async function markMigrationAsApplied(schemaName, migrationVersion) {
    const client = await pool.connect();

    try {
        // Ensure migrations table exists
        await migrationService.ensureMigrationsTable(schemaName, client);

        // Check if already applied
        const applied = await migrationService.getAppliedMigrations(schemaName, client);
        if (applied.includes(migrationVersion)) {
            console.log(`  ⊘ Already marked: ${schemaName}`);
            return { success: true, skipped: true };
        }

        // Extract description from migration name
        const description = migrationVersion.split('_').slice(1).join(' ');

        // Mark as applied without running SQL
        await client.query(
            `INSERT INTO "${schemaName}".schema_migrations (version, description)
             VALUES ($1, $2)
             ON CONFLICT (version) DO NOTHING`,
            [migrationVersion, description]
        );

        console.log(`  ✓ Marked applied: ${schemaName}`);
        return { success: true, skipped: false };
    } finally {
        client.release();
    }
}

async function main() {
    const args = process.argv.slice(2);
    const migrationVersion = args[0];
    const specificSchema = args[1];

    if (!migrationVersion) {
        console.error(`\n❌ Missing migration version`);
        console.log(`\nUsage:`);
        console.log(`  npm run migration:mark-applied <migration-version>`);
        console.log(`  npm run migration:mark-applied <migration-version> <schema>\n`);

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
        if (specificSchema) {
            // Mark for specific schema
            console.log(`\n📝 Marking migration as applied for specific schema\n`);
            console.log(`Migration: ${migrationVersion}`);
            console.log(`Schema: ${specificSchema}\n`);

            const schemas = await migrationService.getAllTenantSchemas();
            if (!schemas.includes(specificSchema)) {
                console.error(`❌ Schema "${specificSchema}" not found`);
                console.log(`\nAvailable schemas:`);
                schemas.forEach(s => console.log(`  - ${s}`));
                process.exit(1);
            }

            const result = await markMigrationAsApplied(specificSchema, migrationVersion);

            if (result.success) {
                console.log(`\n✅ Migration marked as applied for ${specificSchema}`);
                process.exit(0);
            }
        } else {
            // Mark for all schemas
            console.log(`\n📝 Marking migration as applied for ALL schemas\n`);
            console.log(`Migration: ${migrationVersion}\n`);

            const schemas = await migrationService.getAllTenantSchemas();

            if (schemas.length === 0) {
                console.log('⚠️  No tenant schemas found');
                process.exit(0);
            }

            console.log(`Found ${schemas.length} tenant schema(s)\n`);
            console.log(`${'─'.repeat(60)}\n`);

            let successful = 0;
            let skipped = 0;
            let failed = 0;

            for (let i = 0; i < schemas.length; i++) {
                const schema = schemas[i];
                console.log(`[${i + 1}/${schemas.length}] ${schema}`);

                try {
                    const result = await markMigrationAsApplied(schema, migrationVersion);

                    if (result.skipped) {
                        skipped++;
                    } else {
                        successful++;
                    }
                } catch (error) {
                    console.error(`  ✗ Error: ${error.message}`);
                    failed++;
                }
            }

            console.log(`\n${'═'.repeat(60)}`);
            console.log(`Summary:`);
            console.log(`  Total Schemas: ${schemas.length}`);
            console.log(`  ✓ Marked: ${successful}`);
            console.log(`  ⊘ Already Applied: ${skipped}`);
            console.log(`  ✗ Failed: ${failed}`);
            console.log(`${'═'.repeat(60)}\n`);

            if (failed === 0) {
                console.log(`✅ Migration marked as applied for all schemas!\n`);
                process.exit(0);
            } else {
                console.error(`⚠️  Some operations failed. Check logs above.\n`);
                process.exit(1);
            }
        }
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
