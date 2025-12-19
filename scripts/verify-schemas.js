// scripts/verify-schemas.js
const tenantService = require('../controllers/services/tenantService');
const pool = require('../database/databaseConnection');

async function main() {
  try {
    console.log('═'.repeat(60));
    console.log('  TENANT SCHEMA HEALTH CHECK');
    console.log('═'.repeat(60));
    
    await tenantService.verifyAllTenantsHealth();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();