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

exports.handleSearch = async (req, res) => {
    // ✅ Read from req.body for POST requests
    const { schemaName, tableName, query } = req.body;

    try {
        // Get access rules from middleware
        const accessRules = req.teamMemberAccess;
        const tableAccess = accessRules?.[tableName];

        console.log('🔍 [CONTROLLER] Access rules:', tableAccess);

        // Build base query
        let sqlQuery = `
            SELECT us_id
            FROM "${schemaName}"."${tableName}"
            WHERE us_id ILIKE $1
        `;

        const queryParams = [`${query}%`];
        let paramCounter = 2;

        // ✅ ADD ACCESS RESTRICTIONS
        if (tableAccess?.conditions && tableAccess.conditions.length > 0) {
            sqlQuery += ' AND (';
            
            tableAccess.conditions.forEach((condition, index) => {
                const { column, operator, value, logicalOperator } = condition;
                
                // Add logical operator BEFORE this condition (except for first)
                if (index > 0) {
                    // Use the PREVIOUS condition's logicalOperator, defaulting to AND
                    const previousCondition = tableAccess.conditions[index - 1];
                    const connector = previousCondition.logicalOperator || 'AND';
                    sqlQuery += ` ${connector} `;
                }
                
                // Add the condition
                sqlQuery += `"${column}" ${operator} $${paramCounter}`;
                queryParams.push(value);
                paramCounter++;
            });
            
            sqlQuery += ')';
        }

        sqlQuery += `
            ORDER BY us_id
            LIMIT 10
        `;

        console.log('🔍 [CONTROLLER] Final SQL:', sqlQuery);
        console.log('🔍 [CONTROLLER] Query params:', queryParams);

        const result = await pool.query(sqlQuery, queryParams);

        console.log('✅ [CONTROLLER] Found rows:', result.rows.length);

        res.status(200).json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('❌ [CONTROLLER] Error:', error);
        res.status(500).json({
            success: false,
            error: "Failed to Search",
            details: error.message
        });
    }
};