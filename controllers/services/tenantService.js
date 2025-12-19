// controllers/services/tenantService.js
const pool = require('../../database/databaseConnection');
const path = require('path');
const fs = require('fs');
const migrationService = require('./migrationService');

class TenantService {
  
  /**
   * Create a new tenant schema with all migrations applied
   */
  async createTenantSchema(schemaName, userData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log(`\n🏗️  Creating tenant schema: ${schemaName}`);

      // 1. Create schema
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      console.log(`  ✓ Schema created`);

      // 2. Enable UUID extension for this schema
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "${schemaName}"`);
      console.log(`  ✓ UUID extension enabled`);

      // 3. Ensure migration tracking table exists
      await migrationService.ensureMigrationsTable(schemaName, client);

      // 4. Apply all pending migrations
      await migrationService.applyAllPendingMigrations(schemaName, client);

      // 5. Ensure all required tables are present (backfill if needed)
      await migrationService.backfillRequiredTables(schemaName, client);

      // 6. Insert initial data (user as first team member)
      await this.insertInitialTeamMember(schemaName, userData, client);

      await client.query('COMMIT');
      console.log(`✅ Tenant schema ${schemaName} created successfully\n`);

      return { success: true, schemaName };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed to create tenant schema ${schemaName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Apply all Prisma migrations to a specific schema
   */
  async applyMigrationsToSchema(schemaName, client = null) {
    const shouldReleaseClient = !client;
    if (!client) {
      client = await pool.connect();
    }
    
    try {
      const migrationsDir = path.join(__dirname, '../../prisma/migrations');
      
      if (!fs.existsSync(migrationsDir)) {
        console.log('⚠️  No migrations directory found');
        console.log('💡 Run: npm run migration:init');
        return;
      }
      
      // Get all migration folders sorted by timestamp
      const migrationFolders = fs.readdirSync(migrationsDir)
        .filter(f => {
          const fullPath = path.join(migrationsDir, f);
          return fs.statSync(fullPath).isDirectory();
        })
        .sort();
      
      if (migrationFolders.length === 0) {
        console.log('⚠️  No migrations found');
        console.log('💡 Run: npm run migration:init');
        return;
      }
      
      console.log(`  📦 Applying ${migrationFolders.length} migration(s)...`);
      
      // Apply each migration
      for (const folder of migrationFolders) {
        const migrationFile = path.join(migrationsDir, folder, 'migration.sql');
        
        if (!fs.existsSync(migrationFile)) {
          console.log(`  ⊘ Skipping ${folder} (no migration.sql)`);
          continue;
        }
        
        let sql = fs.readFileSync(migrationFile, 'utf8');
        
        // Replace public schema with tenant schema
        sql = this.adaptSQLForSchema(sql, schemaName);
        
        try {
          // Execute migration
          await client.query(sql);
          console.log(`    ✓ ${folder}`);
        } catch (migrationError) {
          console.error(`    ✗ Failed: ${folder}`);
          throw migrationError;
        }
      }
      
    } catch (error) {
      console.error('❌ Error applying migrations:', error.message);
      throw error;
    } finally {
      if (shouldReleaseClient) {
        client.release();
      }
    }
  }
  
  /**
   * Adapt SQL migration for specific schema
   */
  adaptSQLForSchema(sql, schemaName) {
    // Replace public schema references with tenant schema
    const replacements = [
      // CREATE TABLE statements
      [/CREATE TABLE IF NOT EXISTS "public"\./g, `CREATE TABLE IF NOT EXISTS "${schemaName}".`],
      [/CREATE TABLE "public"\./g, `CREATE TABLE "${schemaName}".`],
      [/CREATE TABLE IF NOT EXISTS (?!")/g, `CREATE TABLE IF NOT EXISTS "${schemaName}".`],
      [/CREATE TABLE (?!")(?!IF)/g, `CREATE TABLE "${schemaName}".`],
      
      // ALTER TABLE statements
      [/ALTER TABLE "public"\./g, `ALTER TABLE "${schemaName}".`],
      [/ALTER TABLE (?!")(?!ONLY)/g, `ALTER TABLE "${schemaName}".`],
      
      // CREATE INDEX statements
      [/CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?("?\w+"? )?ON "public"\./g, 
       `CREATE $1INDEX $2$3ON "${schemaName}".`],
      [/CREATE (UNIQUE )?INDEX (IF NOT EXISTS )?("?\w+"? )?ON (?!")(?!ONLY)/g, 
       `CREATE $1INDEX $2$3ON "${schemaName}".`],
      
      // DROP statements
      [/DROP TABLE "public"\./g, `DROP TABLE "${schemaName}".`],
      [/DROP TABLE (?!")(?!IF)/g, `DROP TABLE "${schemaName}".`],
      [/DROP INDEX "public"\./g, `DROP INDEX "${schemaName}".`],
      
      // ALTER INDEX statements
      [/ALTER INDEX "public"\./g, `ALTER INDEX "${schemaName}".`],
      
      // CONSTRAINT statements
      [/REFERENCES "public"\./g, `REFERENCES "${schemaName}".`],
    ];
    
    let adaptedSQL = sql;
    replacements.forEach(([pattern, replacement]) => {
      adaptedSQL = adaptedSQL.replace(pattern, replacement);
    });
    
    return adaptedSQL;
  }
  
  /**
   * Insert initial team member (the user who registered)
   */
  async insertInitialTeamMember(schemaName, userData, client) {
    const fullName = `${userData.first_name} ${userData.last_name || ''}`.trim();
    const currentDate = new Date().toISOString().split('T')[0];
    const empId = `EMP${Math.floor(1000 + Math.random() * 9000)}`;
    const usId = `user_${userData.first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const query = `
      INSERT INTO "${schemaName}"."team_member" (
        id, name, phone_number, empid, department, manager_name, 
        birthday, us_id, email, first_name, last_name, role, 
        created_at, updated_at
      ) VALUES (
        uuid_generate_v4(),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        NOW(), NOW()
      )
    `;
    
    await client.query(query, [
      fullName,                       // name
      userData.phone_number || '',    // phone_number
      empId,                          // empid
      'General',                      // department
      userData.first_name,            // manager_name
      currentDate,                    // birthday
      usId,                           // us_id
      userData.email,                 // email
      userData.first_name,            // first_name
      userData.last_name || null,     // last_name
      'admin'                         // role (first user is admin)
    ]);
    
    console.log(`  ✓ Initial team member inserted`);
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
    return result.rows.map(r => r.schema_name);
  }
  
  /**
   * Check if schema exists
   */
  async schemaExists(schemaName) {
    const result = await pool.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );
    return result.rows.length > 0;
  }
  
  /**
   * Check schema health - verify all required tables exist
   */
  async checkSchemaHealth(schemaName) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name IN ('team_member', 'reminders', 'vendor', 'contact')
        ORDER BY table_name
      `, [schemaName]);
      
      const existingTables = result.rows.map(r => r.table_name);
      const requiredTables = ['team_member', 'reminders', 'vendor', 'contact'];
      const missingTables = requiredTables.filter(t => !existingTables.includes(t));
      
      return {
        schema: schemaName,
        healthy: missingTables.length === 0,
        existingTables,
        missingTables,
        tableCount: existingTables.length
      };
    } finally {
      client.release();
    }
  }
  
  /**
   * Migrate all existing tenant schemas
   * Delegates to MigrationService for proper migration tracking
   */
  async migrateAllTenants() {
    return await migrationService.migrateAllTenants();
  }

  /**
   * Verify all tenant schemas health
   * Delegates to MigrationService for comprehensive health checks
   */
  async verifyAllTenantsHealth() {
    return await migrationService.verifyAllTenantsHealth();
  }
}

module.exports = new TenantService();