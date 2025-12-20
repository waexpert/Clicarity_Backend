const pool = require('../../database/databaseConnection');
const fs = require('fs').promises;
const path = require('path');

/**
 * MigrationService - Handles database migrations for multi-tenant schemas
 *
 * Features:
 * - Tracks applied migrations per tenant schema
 * - Applies pending migrations automatically
 * - Supports rollback with down migrations
 * - Auto-backfills required tables (team_member, vendor, contact, reminders)
 */
class MigrationService {
    constructor() {
        this.migrationsDir = path.join(__dirname, '../../prisma/migrations');
        this.requiredTables = ['team_member', 'vendor', 'contact', 'reminders'];
    }

    /**
     * Ensure schema_migrations table exists in a tenant schema
     */
    async ensureMigrationsTable(schemaName, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS "${schemaName}".schema_migrations (
                    id SERIAL PRIMARY KEY,
                    version VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    checksum VARCHAR(64)
                );

                CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
                ON "${schemaName}".schema_migrations(version);
            `;

            await conn.query(createTableSQL);
            console.log(`✓ Migrations table ready in schema: ${schemaName}`);
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Get list of all migration directories sorted by version
     */
    async getAllMigrations() {
        try {
            const entries = await fs.readdir(this.migrationsDir, { withFileTypes: true });

            const migrations = entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)
                .sort();

            return migrations;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn('⚠ No migrations directory found. Creating...');
                await fs.mkdir(this.migrationsDir, { recursive: true });
                return [];
            }
            throw error;
        }
    }

    /**
     * Get applied migrations for a specific schema
     */
    async getAppliedMigrations(schemaName, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            await this.ensureMigrationsTable(schemaName, conn);

            const result = await conn.query(
                `SELECT version, description, applied_at
                 FROM "${schemaName}".schema_migrations
                 ORDER BY version ASC`
            );

            return result.rows.map(row => row.version);
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Get pending migrations for a schema
     */
    async getPendingMigrations(schemaName, client = null) {
        const allMigrations = await this.getAllMigrations();
        const appliedMigrations = await this.getAppliedMigrations(schemaName, client);

        return allMigrations.filter(version => !appliedMigrations.includes(version));
    }

    /**
     * Read migration SQL file and adapt it for target schema
     */
    async readMigrationSQL(migrationVersion, type = 'up') {
        const fileName = type === 'up' ? 'migration.sql' : 'rollback.sql';
        const filePath = path.join(this.migrationsDir, migrationVersion, fileName);

        try {
            const sql = await fs.readFile(filePath, 'utf8');
            return sql;
        } catch (error) {
            if (type === 'down' && error.code === 'ENOENT') {
                console.warn(`⚠ No rollback.sql found for ${migrationVersion}`);
                return null;
            }
            throw error;
        }
    }

    /**
     * Adapt SQL from public schema to tenant schema
     */
    adaptSQLForSchema(sql, schemaName) {
        let adaptedSQL = sql;

        // Set search_path to include both tenant schema and public (for extensions like uuid-ossp)
        adaptedSQL = `SET search_path TO "${schemaName}", public;\n\n${adaptedSQL}`;

        // Replace explicit public schema references
        adaptedSQL = adaptedSQL.replace(/CREATE TABLE IF NOT EXISTS "public"\."(\w+)"/gi,
            `CREATE TABLE IF NOT EXISTS "${schemaName}"."$1"`);
        adaptedSQL = adaptedSQL.replace(/CREATE TABLE "public"\."(\w+)"/gi,
            `CREATE TABLE "${schemaName}"."$1"`);

        // Replace table references without schema (keep quotes)
        adaptedSQL = adaptedSQL.replace(/CREATE TABLE IF NOT EXISTS "(\w+)"/gi,
            `CREATE TABLE IF NOT EXISTS "${schemaName}"."$1"`);
        adaptedSQL = adaptedSQL.replace(/CREATE TABLE "(\w+)"/gi,
            `CREATE TABLE "${schemaName}"."$1"`);

        // Replace ALTER TABLE statements
        adaptedSQL = adaptedSQL.replace(/ALTER TABLE "public"\."(\w+)"/gi,
            `ALTER TABLE "${schemaName}"."$1"`);
        adaptedSQL = adaptedSQL.replace(/ALTER TABLE "(\w+)"/gi,
            `ALTER TABLE "${schemaName}"."$1"`);

        // Replace CREATE INDEX statements
        adaptedSQL = adaptedSQL.replace(/CREATE INDEX (IF NOT EXISTS )?(\w+) ON "public"\."(\w+)"/gi,
            `CREATE INDEX $1$2 ON "${schemaName}"."$3"`);
        adaptedSQL = adaptedSQL.replace(/CREATE INDEX (IF NOT EXISTS )?("?\w+"?) ON "(\w+)"/gi,
            `CREATE INDEX $1$2 ON "${schemaName}"."$3"`);

        // Replace CREATE UNIQUE INDEX statements
        adaptedSQL = adaptedSQL.replace(/CREATE UNIQUE INDEX (IF NOT EXISTS )?(\w+) ON "public"\."(\w+)"/gi,
            `CREATE UNIQUE INDEX $1$2 ON "${schemaName}"."$3"`);
        adaptedSQL = adaptedSQL.replace(/CREATE UNIQUE INDEX (IF NOT EXISTS )?("?\w+"?) ON "(\w+)"/gi,
            `CREATE UNIQUE INDEX $1$2 ON "${schemaName}"."$3"`);

        // Replace DROP TABLE statements
        adaptedSQL = adaptedSQL.replace(/DROP TABLE IF EXISTS "public"\."(\w+)"/gi,
            `DROP TABLE IF EXISTS "${schemaName}"."$1"`);
        adaptedSQL = adaptedSQL.replace(/DROP TABLE "public"\."(\w+)"/gi,
            `DROP TABLE "${schemaName}"."$1"`);

        // Replace CREATE TRIGGER statements
        adaptedSQL = adaptedSQL.replace(/CREATE TRIGGER (\w+)\s+BEFORE UPDATE ON "(\w+)"/gi,
            `CREATE TRIGGER $1 BEFORE UPDATE ON "${schemaName}"."$2"`);

        // Remove CREATE EXTENSION statements (they should be at schema level, not in migrations)
        adaptedSQL = adaptedSQL.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";?/gi, '');

        return adaptedSQL;
    }

    /**
     * Calculate checksum for migration file (for integrity verification)
     */
    async calculateChecksum(sql) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(sql).digest('hex');
    }

    /**
     * Apply a single migration to a schema
     */
    async applyMigration(schemaName, migrationVersion, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            // Check if already applied
            const applied = await this.getAppliedMigrations(schemaName, conn);
            if (applied.includes(migrationVersion)) {
                console.log(`⊘ Migration ${migrationVersion} already applied to ${schemaName}`);
                return { success: true, skipped: true };
            }

            // Read and adapt SQL
            const originalSQL = await this.readMigrationSQL(migrationVersion, 'up');
            const adaptedSQL = this.adaptSQLForSchema(originalSQL, schemaName);
            const checksum = await this.calculateChecksum(originalSQL);

            // Extract description from migration name
            const description = migrationVersion.split('_').slice(1).join(' ');

            // Begin transaction
            await conn.query('BEGIN');

            try {
                // Apply migration
                await conn.query(adaptedSQL);

                // Record migration
                await conn.query(
                    `INSERT INTO "${schemaName}".schema_migrations (version, description, checksum)
                     VALUES ($1, $2, $3)`,
                    [migrationVersion, description, checksum]
                );

                await conn.query('COMMIT');
                console.log(`✓ Applied migration ${migrationVersion} to ${schemaName}`);

                return { success: true, skipped: false };
            } catch (error) {
                await conn.query('ROLLBACK');
                throw error;
            }
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Apply all pending migrations to a schema
     */
    async applyAllPendingMigrations(schemaName, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            const pendingMigrations = await this.getPendingMigrations(schemaName, conn);

            if (pendingMigrations.length === 0) {
                console.log(`✓ Schema ${schemaName} is up to date`);
                return { success: true, applied: 0, migrations: [] };
            }

            console.log(`⟳ Applying ${pendingMigrations.length} migrations to ${schemaName}...`);

            const results = [];
            for (const migration of pendingMigrations) {
                const result = await this.applyMigration(schemaName, migration, conn);
                results.push({ migration, ...result });
            }

            const appliedCount = results.filter(r => !r.skipped).length;
            console.log(`✓ Applied ${appliedCount} migrations to ${schemaName}`);

            return {
                success: true,
                applied: appliedCount,
                migrations: results
            };
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Rollback a specific migration from a schema
     */
    async rollbackMigration(schemaName, migrationVersion, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            // Check if migration is applied
            const applied = await this.getAppliedMigrations(schemaName, conn);
            if (!applied.includes(migrationVersion)) {
                console.log(`⊘ Migration ${migrationVersion} not applied to ${schemaName}`);
                return { success: true, skipped: true };
            }

            // Read rollback SQL
            const rollbackSQL = await this.readMigrationSQL(migrationVersion, 'down');
            if (!rollbackSQL) {
                throw new Error(`No rollback script found for ${migrationVersion}`);
            }

            const adaptedSQL = this.adaptSQLForSchema(rollbackSQL, schemaName);

            // Begin transaction
            await conn.query('BEGIN');

            try {
                // Apply rollback
                await conn.query(adaptedSQL);

                // Remove migration record
                await conn.query(
                    `DELETE FROM "${schemaName}".schema_migrations WHERE version = $1`,
                    [migrationVersion]
                );

                await conn.query('COMMIT');
                console.log(`✓ Rolled back migration ${migrationVersion} from ${schemaName}`);

                return { success: true, skipped: false };
            } catch (error) {
                await conn.query('ROLLBACK');
                throw error;
            }
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Check if schema has all required tables
     */
    async checkRequiredTables(schemaName, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            const result = await conn.query(
                `SELECT table_name
                 FROM information_schema.tables
                 WHERE table_schema = $1
                 AND table_name = ANY($2)`,
                [schemaName, this.requiredTables]
            );

            const existingTables = result.rows.map(row => row.table_name);
            const missingTables = this.requiredTables.filter(
                table => !existingTables.includes(table)
            );

            return {
                hasAll: missingTables.length === 0,
                existing: existingTables,
                missing: missingTables
            };
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Backfill required tables for a schema
     * Only creates missing tables, doesn't modify existing ones
     */
    async backfillRequiredTables(schemaName, client = null) {
        const shouldCloseConnection = !client;
        const conn = client || await pool.connect();

        try {
            const { hasAll, missing } = await this.checkRequiredTables(schemaName, conn);

            if (hasAll) {
                console.log(`✓ Schema ${schemaName} has all required tables`);
                return { success: true, backfilled: [] };
            }

            console.log(`⟳ Backfilling ${missing.length} missing tables in ${schemaName}: ${missing.join(', ')}`);

            // Instead of applying full migration, create only missing tables
            for (const tableName of missing) {
                await this.createSingleTable(schemaName, tableName, conn);
            }

            // Verify backfill
            const verification = await this.checkRequiredTables(schemaName, conn);

            if (!verification.hasAll) {
                throw new Error(`Backfill incomplete. Still missing: ${verification.missing.join(', ')}`);
            }

            console.log(`✓ Backfilled ${missing.length} tables in ${schemaName}`);
            return { success: true, backfilled: missing };
        } finally {
            if (shouldCloseConnection) {
                conn.release();
            }
        }
    }

    /**
     * Create a single table in a schema
     */
    async createSingleTable(schemaName, tableName, client) {
        const tableDefinitions = {
            team_member: `
                CREATE TABLE IF NOT EXISTS "${schemaName}"."team_member" (
                    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    "name" TEXT NOT NULL,
                    "phone_number" TEXT,
                    "empid" TEXT,
                    "department" TEXT,
                    "manager_name" TEXT,
                    "birthday" DATE,
                    "us_id" TEXT UNIQUE NOT NULL,
                    "email" TEXT,
                    "first_name" TEXT,
                    "last_name" TEXT,
                    "role" TEXT DEFAULT 'member',
                    "password" TEXT,
                    "owner_id" TEXT,
                    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS "team_member_email_idx" ON "${schemaName}"."team_member"("email");
                CREATE INDEX IF NOT EXISTS "team_member_phone_number_idx" ON "${schemaName}"."team_member"("phone_number");
                CREATE INDEX IF NOT EXISTS "team_member_role_idx" ON "${schemaName}"."team_member"("role");
            `,
            vendor: `
                CREATE TABLE IF NOT EXISTS "${schemaName}"."vendor" (
                    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    "us_id" TEXT UNIQUE NOT NULL,
                    "name" TEXT NOT NULL,
                    "process_name" TEXT,
                    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS "vendor_process_name_idx" ON "${schemaName}"."vendor"("process_name");
            `,
            contact: `
                CREATE TABLE IF NOT EXISTS "${schemaName}"."contact" (
                    "id" SERIAL PRIMARY KEY,
                    "name" TEXT NOT NULL,
                    "email" TEXT,
                    "phone" TEXT,
                    "source" TEXT,
                    "details" TEXT,
                    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "deleted_at" TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS "contact_email_idx" ON "${schemaName}"."contact"("email");
                CREATE INDEX IF NOT EXISTS "contact_phone_idx" ON "${schemaName}"."contact"("phone");
                CREATE INDEX IF NOT EXISTS "contact_source_idx" ON "${schemaName}"."contact"("source");
            `,
            reminders: `
                CREATE TABLE IF NOT EXISTS "${schemaName}"."reminders" (
                    "reminder_id" SERIAL PRIMARY KEY,
                    "sender_name" TEXT,
                    "sender_phone" TEXT UNIQUE,
                    "us_id" TEXT UNIQUE,
                    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            `
        };

        const sql = tableDefinitions[tableName];
        if (!sql) {
            throw new Error(`No table definition found for: ${tableName}`);
        }

        await client.query(sql);
        console.log(`  ✓ Created table: ${tableName}`);
    }

    /**
     * Get migration status for a schema
     */
    async getMigrationStatus(schemaName) {
        const client = await pool.connect();

        try {
            const allMigrations = await this.getAllMigrations();
            const appliedMigrations = await this.getAppliedMigrations(schemaName, client);
            const pendingMigrations = allMigrations.filter(
                v => !appliedMigrations.includes(v)
            );
            const tableCheck = await this.checkRequiredTables(schemaName, client);

            return {
                schema: schemaName,
                total: allMigrations.length,
                applied: appliedMigrations.length,
                pending: pendingMigrations.length,
                appliedList: appliedMigrations,
                pendingList: pendingMigrations,
                requiredTables: tableCheck
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get all tenant schemas
     */
    async getAllTenantSchemas() {
        const result = await pool.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public', 'pg_toast')
            AND schema_name LIKE '%_%'
            ORDER BY schema_name
        `);

        return result.rows.map(row => row.schema_name);
    }

    /**
     * Apply all pending migrations to all tenant schemas
     */
    async migrateAllTenants() {
        const schemas = await this.getAllTenantSchemas();
        console.log(`\n⟳ Starting migration for ${schemas.length} tenant schemas...\n`);

        const results = [];

        for (const schema of schemas) {
            try {
                // Backfill missing tables first
                await this.backfillRequiredTables(schema);

                // Apply pending migrations
                const result = await this.applyAllPendingMigrations(schema);

                results.push({
                    schema,
                    success: true,
                    ...result
                });
            } catch (error) {
                console.error(`✗ Failed to migrate ${schema}: ${error.message}`);
                results.push({
                    schema,
                    success: false,
                    error: error.message
                });
            }
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalApplied = results.reduce((sum, r) => sum + (r.applied || 0), 0);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Migration Summary:`);
        console.log(`  Total schemas: ${schemas.length}`);
        console.log(`  Successful: ${successful}`);
        console.log(`  Failed: ${failed}`);
        console.log(`  Total migrations applied: ${totalApplied}`);
        console.log(`${'='.repeat(60)}\n`);

        return {
            totalSchemas: schemas.length,
            successful,
            failed,
            totalApplied,
            results
        };
    }

    /**
     * Verify health of all tenant schemas
     */
    async verifyAllTenantsHealth() {
        const schemas = await this.getAllTenantSchemas();
        console.log(`\n⟳ Checking health of ${schemas.length} tenant schemas...\n`);

        const results = [];

        for (const schema of schemas) {
            try {
                const status = await this.getMigrationStatus(schema);
                results.push(status);

                const icon = status.pending === 0 && status.requiredTables.hasAll ? '✓' : '⚠';
                console.log(`${icon} ${schema}: ${status.applied}/${status.total} migrations, ` +
                    `tables: ${status.requiredTables.existing.length}/4`);
            } catch (error) {
                console.error(`✗ ${schema}: ${error.message}`);
                results.push({
                    schema,
                    error: error.message
                });
            }
        }

        const healthy = results.filter(r =>
            !r.error && r.pending === 0 && r.requiredTables.hasAll
        ).length;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Health Check Summary:`);
        console.log(`  Total schemas: ${schemas.length}`);
        console.log(`  Healthy: ${healthy}`);
        console.log(`  Needs attention: ${schemas.length - healthy}`);
        console.log(`${'='.repeat(60)}\n`);

        return results;
    }
}

module.exports = new MigrationService();
