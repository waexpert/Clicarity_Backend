// Without Middleware Logic

// const pool = require("../database/databaseConnection");

// exports.handleSearch = async (req, res) => {

//     const { schemaName, tableName, query } = req.query

//     try {
//         const result = await pool.query(
//                     `
//         SELECT us_id
//         FROM ${schemaName}.${tableName}
//         WHERE us_id ILIKE $1
//         ORDER BY us_id
//         LIMIT 10
//         `,
//             [`${query}%`]
//         );

//         res.status(200).json({
//             success: true,
//             data :result
//         })

//     } catch (error) {      
//         res.status(500).json({
//             success: false,
//             error: "Failed to Search",
//             details: error.message
//         });
//     }


// }


// With MiddleWare Logic
const pool = require("../database/databaseConnection");

// exports.handleSearch = async (req, res) => {
//     // ✅ Read from req.body for POST requests
//     const { schemaName, tableName, query } = req.body;

//     try {
//         // Get access rules from middleware
//         const accessRules = req.teamMemberAccess;
//         const tableAccess = accessRules?.[tableName];

//         console.log('🔍 [CONTROLLER] Access rules:', tableAccess);

//         // Build base query
//         let sqlQuery = `
//             SELECT us_id
//             FROM "${schemaName}"."${tableName}"
//             WHERE us_id ILIKE $1
//         `;

//         const queryParams = [`${query}%`];
//         let paramCounter = 2;

//         // ✅ ADD ACCESS RESTRICTIONS
//         if (tableAccess?.conditions && tableAccess.conditions.length > 0) {
//             sqlQuery += ' AND (';
            
//             tableAccess.conditions.forEach((condition, index) => {
//                 const { column, operator, value, logicalOperator } = condition;
                
//                 // Add logical operator BEFORE this condition (except for first)
//                 if (index > 0) {
//                     // Use the PREVIOUS condition's logicalOperator, defaulting to AND
//                     const previousCondition = tableAccess.conditions[index - 1];
//                     const connector = previousCondition.logicalOperator || 'AND';
//                     sqlQuery += ` ${connector} `;
//                 }
                
//                 // Add the condition
//                 sqlQuery += `"${column}" ${operator} $${paramCounter}`;
//                 queryParams.push(value);
//                 paramCounter++;
//             });
            
//             sqlQuery += ')';
//         }

//         sqlQuery += `
//             ORDER BY us_id
//             LIMIT 10
//         `;

//         console.log('🔍 [CONTROLLER] Final SQL:', sqlQuery);
//         console.log('🔍 [CONTROLLER] Query params:', queryParams);

//         const result = await pool.query(sqlQuery, queryParams);

//         console.log('✅ [CONTROLLER] Found rows:', result.rows.length);

//         res.status(200).json({
//             success: true,
//             data: result.rows
//         });

//     } catch (error) {
//         console.error('❌ [CONTROLLER] Error:', error);
//         res.status(500).json({
//             success: false,
//             error: "Failed to Search",
//             details: error.message
//         });
//     }
// };



const getTablesWithUsId = async (schemaName) => {
  const sql = `
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND column_name = 'us_id'
  `;
  const result = await pool.query(sql, [schemaName]);
  return result.rows.map(r => r.table_name);
};

exports.handleSearch = async (req, res) => {
  const { schemaName, query } = req.body;
  const accessRules = req.teamMemberAccess;
  
  try {
    const tables = await getTablesWithUsId(schemaName);

    if (!tables.length) {
      return res.json({ success: true, data: [] });
    }

    const excludedTables = ["vendor", "reminders", "team_member", "contact"];
    const unionQueries = [];
    const queryParams = [];
    let paramCounter = 1;
    console.log("table Names"+tables);
    for (const tableName of tables.filter(table => !excludedTables.includes(table))) {
      const tableAccess = accessRules?.[tableName];
      let whereClause = `us_id ILIKE $${paramCounter}`;
      queryParams.push(`${query}%`);
      paramCounter++;

      // 🔐 Apply access rules per table
      if (tableAccess?.conditions?.length) {
        const conditionsSql = [];

        tableAccess.conditions.forEach((cond, idx) => {
          conditionsSql.push(
            `"${cond.column}" ${cond.operator} $${paramCounter}`
          );
          queryParams.push(cond.value);
          paramCounter++;
        });

        whereClause += ` AND (${conditionsSql.join(' AND ')})`;
      }

      unionQueries.push(`
        SELECT 
          us_id,
          '${tableName}' AS table_name
        FROM "${schemaName}"."${tableName}"
        WHERE ${whereClause}
      `);
    }

    const finalQuery = `
      ${unionQueries.join(' UNION ALL ')}
      ORDER BY us_id
      LIMIT 5
    `;

    console.log('🔍 Final SQL:', finalQuery);
    console.log('🔍 Params:', queryParams);

    const result = await pool.query(finalQuery, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      details: error.message
    });
  }
};