// middlewares/teamMemberAuth.js
const pool = require("../database/databaseConnection");

exports.getTeamMemberAccess = async (req, res, next) => {
  try {
    // Try to get user from req.user (if auth middleware exists)
    let userId = req.user?.id;
    let userEmail = req.user?.email;
    
    // FALLBACK: Get from request body if no auth middleware
    if (!userId) {
      userId = req.body?.userId || req.query?.userId;
      userEmail = req.body?.userEmail || req.query?.userEmail;
      console.log('⚠️ [MIDDLEWARE] No req.user found, using body params');
      console.log('⚠️ [MIDDLEWARE] userId from body:', userId);
      console.log('⚠️ [MIDDLEWARE] userEmail from body:', userEmail);
    }
    
    const schemaName = req.body?.schemaName || req.query?.schemaName;
    const tableName = req.body?.tableName || req.query?.tableName;

    console.log('🔍 [MIDDLEWARE] Checking access for:', {
      userId,
      userEmail,
      schemaName,
      tableName
    });

    // If no user or schema, skip access check (full access)
    if (!userId || !schemaName) {
      console.log('⚠️ [MIDDLEWARE] No user/schema - granting full access');
      req.teamMemberAccess = null;
      return next();
    }

    // Query to find role restrictions for this user
    const query = `
      SELECT 
        rs.table_name,
        rs.role_name,
        rs.role_config
      FROM public.team_member_roles tmr
      JOIN public.roles_setup rs ON tmr.role_setup_id = rs.id
      WHERE tmr.schema_name = $1
        AND tmr.team_member_id = $2
        AND rs.is_active = true
    `;

    let params = [schemaName, userId];

    if (tableName) {
      const queryWithTable = query + ` AND rs.table_name = $3`;
      params.push(tableName);
      
      console.log('🔍 [MIDDLEWARE] Executing query:', queryWithTable);
      console.log('🔍 [MIDDLEWARE] With params:', params);
      
      const result = await pool.query(queryWithTable, params);
      console.log('🔍 [MIDDLEWARE] Query result rows:', result.rows.length);
      
      if (result.rows.length > 0) {
        processRoles(result.rows, req);
      } else {
        console.log('✅ [MIDDLEWARE] No restrictions found - full access');
        req.teamMemberAccess = null;
      }
    }

    next();
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error:', error);
    req.teamMemberAccess = null;
    next();
  }
};

function processRoles(rows, req) {
  const accessRules = {};
  
  rows.forEach(row => {
    console.log(`🔒 [MIDDLEWARE] Processing role: ${row.role_name}`);
    console.log(`🔒 [MIDDLEWARE] Table: ${row.table_name}`);
    console.log(`🔒 [MIDDLEWARE] Config:`, row.role_config);
    
    if (accessRules[row.table_name]) {
      // Merge columns
      const existingColumns = accessRules[row.table_name].columns || [];
      const newColumns = row.role_config.columns || [];
      accessRules[row.table_name].columns = [...new Set([...existingColumns, ...newColumns])];
      
      // Merge conditions
      const existingConditions = accessRules[row.table_name].conditions || [];
      const newConditions = row.role_config.conditions || [];
      
      if (existingConditions.length > 0 && newConditions.length > 0) {
        existingConditions[existingConditions.length - 1].logicalOperator = 'OR';
      }
      
      accessRules[row.table_name].conditions = [...existingConditions, ...newConditions];
    } else {
      accessRules[row.table_name] = {
        columns: row.role_config.columns || [],
        conditions: row.role_config.conditions || []
      };
    }
  });

  req.teamMemberAccess = accessRules;
  console.log('🔒 [MIDDLEWARE] Final access rules:', JSON.stringify(accessRules, null, 2));
}