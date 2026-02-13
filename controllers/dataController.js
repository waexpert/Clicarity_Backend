const axios = require("axios");
const pool = require("../database/databaseConnection");
const queries = require("../database/queries/dataQueries");
const userQueries = require("../database/queries/userQueries");
const { generateAlterTableQuery } = require("./secureControllers");
const { table } = require("pdfkit");
const CryptoJS = require('crypto-js');

exports.getRecordById = async (req, res) => {
  try {
    const { id, schemaName, tableName } = req.body;
    const query = `SELECT * FROM ${schemaName}.${tableName} WHERE us_id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching record by ID:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// With out Team Member Auth
// exports.getRecordByTarget = async (req, res) => {
//   try {
//     const { targetColumn, targetValue, schemaName, tableName } = req.body;
//     const query = `SELECT * FROM ${schemaName}.${tableName} WHERE ${targetColumn} = $1`;
//     const result = await pool.query(query, [targetValue]);

//     // If no record found → return false
//     if (result.rows.length === 0) {
//       return res.status(200).json(false);
//     }

//     // If record found → return the record
//     return res.status(200).json(result.rows[0]);

//   } catch (error) {
//     console.error('Error fetching record by target:', error.message);
//     // If any error → also return false instead of crashing
//     return res.status(200).json(false);
//   }
// };

exports.getRecordByTarget = async (req, res) => {
  try {
    const { targetColumn, targetValue, schemaName, tableName } = req.body;

    // Get access rules from middleware
    const accessRules = req.teamMemberAccess;
    const tableAccess = accessRules?.[tableName];

    console.log('🔍 [GET_RECORD] Access rules:', tableAccess);

    // Determine which columns to select
    let selectColumns = '*';
    
    if (tableAccess?.columns && tableAccess.columns.length > 0) {
      selectColumns = tableAccess.columns.map(col => `"${col}"`).join(', ');
    }

    // Build base query
    let query = `SELECT ${selectColumns} FROM "${schemaName}"."${tableName}" WHERE "${targetColumn}" = $1`;
    const queryParams = [targetValue];
    let paramCounter = 2;

    // ✅ ADD ACCESS RESTRICTIONS
    if (tableAccess?.conditions && tableAccess.conditions.length > 0) {
      query += ' AND (';
      
      tableAccess.conditions.forEach((condition, index) => {
        const { column, operator, value, logicalOperator } = condition;
        
        // Add logical operator BEFORE this condition (except for first)
        if (index > 0) {
          const previousCondition = tableAccess.conditions[index - 1];
          const connector = previousCondition.logicalOperator || 'AND';
          query += ` ${connector} `;
        }
        
        // Add the condition
        query += `"${column}" ${operator} $${paramCounter}`;
        queryParams.push(value);
        paramCounter++;
      });
      
      query += ')';
    }

    console.log('🔍 [GET_RECORD] Final query:', query);
    console.log('🔍 [GET_RECORD] Query params:', queryParams);

    const result = await pool.query(query, queryParams);

    // If no record found → return false
    if (result.rows.length === 0) {
      console.log('❌ [GET_RECORD] No record found or access denied');
      return res.status(200).json(false);
    }

    // If record found → return the record
    console.log('✅ [GET_RECORD] Record found:', result.rows[0]);
    return res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error('❌ [GET_RECORD] Error:', error.message);
    return res.status(200).json(false);
  }
};

exports.getRecordByCondition = async (req, res) => {
  try {
    const { targetColumn, targetWithCondition, schemaName, tableName } = req.body;
    const query = `SELECT * FROM ${schemaName}.${tableName} WHERE ${targetWithCondition}`;
    const result = await pool.query(query);

    // If no record found → return false
    if (result.rows.length === 0) {
      return res.status(200).json(false);
    }

    // If record found → return the record
    return res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching record by target:', error.message);
    // If any error → also return false instead of crashing
    return res.status(200).json(false);
  }
};



exports.getRecordByTargetAll = async (req, res) => {
  try {
    const { targetColumn, targetValue, schemaName, tableName } = req.body;
    const query = `SELECT * FROM ${schemaName}.${tableName} WHERE ${targetColumn} = $1`;
    const result = await pool.query(query, [targetValue]);

    // If no record found → return false
    if (result.rows.length === 0) {
      return res.status(200).json(false);
    }

    // If record found → return the record
    return res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching record by target:', error.message);
    // If any error → also return false instead of crashing
    return res.status(200).json(false);
  }
};

// exports.createRecord = async (req, res) => {
//   const { schemaName, tableName, record } = req.body;

//   if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
//     return res.status(400).json({ error: 'Invalid schema name' });
//   }

//   try {
//     // First ensure the unique constraint exists
//     await queries.ensureUniqueConstraint(pool, schemaName, tableName, 'us_id');

//     // Then create the record with date formatting
//     const { query, values } = queries.createRecord(schemaName, tableName, record);
//     const result = await pool.query(query, values);

//     res.status(200).json({
//       message: `Record Inserted to Table ${tableName} successfully.`,
//       data: result.rows[0]
//     });
//   } catch (err) {
//     console.error('Error Inserting the Record:', err);
//     res.status(500).json({
//       error: 'Failed to Insert Record',
//       details: err.message
//     });
//   }
// };


exports.createRecord = async (req, res) => {
  // ADD THIS DEBUG LOG FIRST
  console.log('======= CONTROLLER RECEIVED =======');
  console.log('req.body:', req.body);
  console.log('schemaName:', req.body?.schemaName);
  console.log('tableName:', req.body?.tableName);
  console.log('record:', req.body?.record);
  console.log('===================================');

  const { schemaName, tableName, record } = req.body;

  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  // ADD THIS CHECK
  if (!record || typeof record !== 'object') {
    console.error('Invalid record received:', record);
    return res.status(400).json({ error: 'Invalid record data' });
  }

  try {
    await queries.ensureUniqueConstraint(pool, schemaName, tableName, 'us_id');
    const { query, values } = queries.createRecord(schemaName, tableName, record);
    const result = await pool.query(query, values);

    res.status(200).json({
      message: `Record Inserted to Table ${tableName} successfully.`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error Inserting the Record:', err);
    res.status(500).json({
      error: 'Failed to Insert Record',
      details: err.message
    });
  }
};


exports.createBulkRecord = async (req, res) => {
  const { schemaName, tableName, records } = req.body;

  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  try {
    // First ensure the unique constraint exists
    await queries.ensureUniqueConstraint(pool, schemaName, tableName, 'us_id');

    // Then create the bulk records with date formatting
    const { query, values } = queries.createBulkInsertQuery(schemaName, tableName, records);
    const result = await pool.query(query, values);

    console.log(result)

    res.status(200).json({
      message: `Records Inserted to Table ${tableName} successfully.`,
      count: result.rowCount
    });
  } catch (err) {
    console.error('Error Inserting the Records:', err);
    res.status(500).json({
      error: 'Failed to insert records',
      details: err.message
    });
  }
};

// This is a final version of the update record with process steps column alteration and also send the webhook notification
exports.updateRecord = async (req, res) => {
  const { schemaName, tableName, recordId, columnName, value, ownerId, vname, wid, userTableName, userSchemaName } = req.query;
  const vendorTable = `${schemaName}.vendor`; 

  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  try {
    let formattedValue = value;

    // Handle date formatting
    if (columnName.toLowerCase().includes('date')) {
      formattedValue = queries.toPostgresDate(value);
    }

    // Handle array values (for process_steps or similar columns)
    if (columnName === 'process_steps' || columnName.endsWith('_steps') || columnName.endsWith('_array')) {
      try {
        if (typeof value === 'string') {
          // Remove surrounding quotes if present
          let cleanValue = value.replace(/^["']|["']$/g, '').trim();

          console.log('Original value:', value);
          console.log('Cleaned value:', cleanValue);

          if (cleanValue.startsWith('[')) {
            // Parse JSON array
            formattedValue = JSON.parse(decodeURIComponent(cleanValue));
          } else {
            // Parse comma-separated and clean each item
            formattedValue = cleanValue
              .split(',')
              .map(item => item.trim().replace(/^["']|["']$/g, '')) 
              .filter(item => item.length > 0);
          }

          console.log('Final formatted value:', formattedValue);
        }

        // If columnName is process_steps, create columns for each element
        if (columnName === 'process_steps' && Array.isArray(formattedValue)) {
          // Validate userSchemaName and userTableName
          if (!userSchemaName || !userTableName) {
            console.error('Missing userSchemaName or userTableName for process_steps alteration');
            return res.status(400).json({ 
              error: 'userSchemaName and userTableName are required for process_steps updates' 
            });
          }

          // Use schemaName as fallback if userSchemaName is invalid
          const targetSchema = (userSchemaName && userSchemaName !== 'true' && userSchemaName !== 'false') 
            ? userSchemaName 
            : schemaName;
          
          const targetTable = userTableName || tableName;

          console.log('Target schema:', targetSchema);
          console.log('Target table:', targetTable);

          const client = await pool.connect();
          
          try {
            await client.query('BEGIN');
            
            // Generate fields for each process step element
            const fields = [];
            formattedValue.forEach((element) => {
              const sanitizedElement = element.replace(/[^a-zA-Z0-9_]/g, '_');
              
              fields.push(
                { name: `${sanitizedElement}`, type: 'text', required: false, systemField: false },
                { name: `${sanitizedElement}_balance`, type: 'number', required: false, systemField: false },
                { name: `${sanitizedElement}_quantity_received`, type: 'number', required: false, systemField: false },
                { name: `${sanitizedElement}_wastage`, type: 'number', required: false, systemField: false }
              );
            });

            // Generate ALTER statements using the helper function
            const alterStatements = generateAlterTableQuery(fields, targetTable,targetSchema);
            
            console.log('Executing ALTER statements for process_steps:', alterStatements);
            
            // Execute each ALTER statement, ignoring errors for columns that already exist
            for (const statement of alterStatements) {
              try {
                await client.query(statement);
              } catch (alterErr) {
                // Ignore "column already exists" errors (PostgreSQL error code 42701)
                if (alterErr.code !== '42701') {
                  throw alterErr;
                }
                console.log('Column already exists, skipping:', statement);
              }
            }
            
            await client.query('COMMIT');
            console.log('Successfully created columns for process_steps elements');
            
          } catch (alterError) {
            await client.query('ROLLBACK');
            console.error('Error altering table for process_steps:', alterError);
            // Continue with the update even if alter fails
          } finally {
            client.release();
          }
        }
        
      } catch (parseError) {
        console.error('Error parsing array value:', parseError);
        return res.status(400).json({ error: 'Invalid array format' });
      }
    }
    
    const query = queries.updateRecord(schemaName, tableName, recordId, columnName, formattedValue);
    console.log(query);
    await pool.query(query.text, query.values);
    await pool.query(userQueries.updateApi, [ownerId]);

    if (vname) {
      const vendorResult = await pool.query(`SELECT * FROM ${vendorTable} WHERE name = $1`, [vname]);
      await axios.post(`https://webhooks.wa.expert/webhook/${wid}`, vendorResult.rows);
    }

    res.status(200).json({
      message: `Record updated to Table ${schemaName}.${tableName} successfully.`,
      updatedValue: formattedValue
    });
  } catch (err) {
    console.error('Error Updating the Record:', err);
    res.status(500).json({
      error: 'Failed to Update Record',
      details: err.message
    });
  }
};



exports.updateMultipleColumnsBody = async (req, res) => {
  const {
    schemaName,
    tableName,
    recordId,
    ownerId,
    vname,
    wid,
    userTableName,
    userSchemaName,
    updates // Object containing column-value pairs: { columnName: value, ... }
  } = req.body;

  try {
    // Validate required fields
    if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
      return res.status(400).json({ error: 'Invalid schema name' });
    }

    if (!tableName || !recordId) {
      return res.status(400).json({ 
        error: 'Missing required fields: schemaName, tableName, or recordId' 
      });
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        error: 'No column-value pairs provided in updates object' 
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const columnValuePairs = [];
      let processStepsValue = null;

      // Process each update and build column-value pairs
      for (const [columnName, value] of Object.entries(updates)) {
        let formattedValue = value;

        // Handle date formatting
        if (columnName.toLowerCase().includes('date') || columnName.toLowerCase().endsWith('_date')) {
          // Skip empty/null date fields
          if (value === null || value === 'null' || value === '' || value === undefined) {
            continue;
          }

          // Validate and format date
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            console.warn(`Invalid date format for ${columnName}:`, value);
            continue;
          }
          
          formattedValue = queries.toPostgresDate(value);
        }
        // Handle array values (for process_steps or similar columns)
        else if (columnName === 'process_steps' || columnName.endsWith('_steps') || columnName.endsWith('_array')) {
          try {
            if (typeof value === 'string') {
              // Remove surrounding quotes if present
              let cleanValue = value.replace(/^["']|["']$/g, '').trim();

              console.log('Original value:', value);
              console.log('Cleaned value:', cleanValue);

              if (cleanValue.startsWith('[')) {
                // Parse JSON array
                formattedValue = JSON.parse(decodeURIComponent(cleanValue));
              } else {
                // Parse comma-separated and clean each item
                formattedValue = cleanValue
                  .split(',')
                  .map(item => item.trim().replace(/^["']|["']$/g, '')) 
                  .filter(item => item.length > 0);
              }

              console.log('Final formatted value:', formattedValue);
            } else if (Array.isArray(value)) {
              formattedValue = value;
            } else {
              formattedValue = [value];
            }

            // Store process_steps for column creation
            if (columnName === 'process_steps') {
              processStepsValue = formattedValue;
            }
            
          } catch (parseError) {
            console.error('Error parsing array value:', parseError);
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: `Invalid array format for ${columnName}`,
              details: parseError.message 
            });
          }
        }
        // Handle regular fields
        else {
          formattedValue = value === null || value === 'null' ? '' : value;
        }

        // Add to column-value pairs
        columnValuePairs.push([columnName, formattedValue]);
      }

      // If no valid column-value pairs after processing
      if (columnValuePairs.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'No valid column-value pairs to update after processing' 
        });
      }

      // If process_steps exists, create columns for each element
      if (processStepsValue && Array.isArray(processStepsValue)) {
        // Validate userSchemaName and userTableName
        if (!userSchemaName || !userTableName) {
          console.error('Missing userSchemaName or userTableName for process_steps alteration');
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: 'userSchemaName and userTableName are required for process_steps updates' 
          });
        }

        // Use schemaName as fallback if userSchemaName is invalid
        const targetSchema = (userSchemaName && userSchemaName !== 'true' && userSchemaName !== 'false') 
          ? userSchemaName 
          : schemaName;
        
        const targetTable = userTableName || tableName;

        console.log('Target schema:', targetSchema);
        console.log('Target table:', targetTable);

        try {
          // Generate fields for each process step element
          const fields = [];
          processStepsValue.forEach((element) => {
            const sanitizedElement = element.replace(/[^a-zA-Z0-9_]/g, '_');
            
            fields.push(
              { name: `${sanitizedElement}`, type: 'text', required: false, systemField: false },
              { name: `${sanitizedElement}_balance`, type: 'number', required: false, systemField: false },
              { name: `${sanitizedElement}_quantity_received`, type: 'number', required: false, systemField: false },
              { name: `${sanitizedElement}_wastage`, type: 'number', required: false, systemField: false }
            );
          });

          // Generate ALTER statements using the helper function
          const alterStatements = generateAlterTableQuery(fields, targetTable, targetSchema);
          
          console.log('Executing ALTER statements for process_steps:', alterStatements);
          
          // Execute each ALTER statement, ignoring errors for columns that already exist
          for (const statement of alterStatements) {
            try {
              await client.query(statement);
            } catch (alterErr) {
              // Ignore "column already exists" errors (PostgreSQL error code 42701)
              if (alterErr.code !== '42701') {
                throw alterErr;
              }
              console.log('Column already exists, skipping:', statement);
            }
          }
          
          console.log('Successfully created columns for process_steps elements');
          
        } catch (alterError) {
          console.error('Error altering table for process_steps:', alterError);
          // Continue with the update even if alter fails
        }
      }

      // Perform the multiple column update
      const { query, values } = queries.updateMultipleColumns({
        schemaName,
        tableName,
        recordId,
        columnValuePairs
      });

      console.log('Update query:', query);
      console.log('Update values:', values);

      const result = await client.query(query, values);

      // Update API usage if ownerId is provided
      if (ownerId) {
        await client.query(userQueries.updateApi, [ownerId]);
      }

      await client.query('COMMIT');

      // Send webhook notification if wid is provided
      if (wid) {
        try {
          const table = `${schemaName}.${tableName}`;
          const wResult = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [recordId]);
          console.log('Webhook data:', wResult.rows);
          await axios.post(`https://webhooks.wa.expert/webhook/${wid}`, wResult.rows);
        } catch (webhookError) {
          console.error('Webhook error:', webhookError);
          // Don't fail the entire operation if webhook fails
        }
      }

      res.status(200).json({
        message: `Multiple columns updated successfully in ${schemaName}.${tableName}`,
        recordId: recordId,
        updatedColumns: columnValuePairs.map(pair => pair[0]),
        data: result.rows[0]
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (e) {
    console.error('Error updating multiple columns:', e);
    res.status(500).json({
      error: 'Failed to update columns',
      details: e.message
    });
  }
};


// Modified getAllData Route to get the data along with the not null constrain
// exports.getAllData = async (req, res) => {
//   const { schemaName, tableName } = req.body;

//   if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
//     return res.status(400).json({ error: 'Invalid schema name' });
//   }

//   if (!tableName || /[^a-zA-Z0-9_]/.test(tableName)) {
//     return res.status(400).json({ error: 'Invalid table name' });
//   }

//   try {
//     // Get the actual data
//     const dataQuery = `SELECT * FROM "${schemaName}"."${tableName}";`;
//     const dataResult = await pool.query(dataQuery);

//     // Get column metadata with NOT NULL constraints
//     const metadataQuery = `
//       SELECT 
//         column_name,
//         data_type,
//         is_nullable,
//         CASE 
//           WHEN is_nullable = 'NO' THEN true 
//           ELSE false 
//         END as required,
//         column_default,
//         ordinal_position
//       FROM information_schema.columns 
//       WHERE table_schema = $1 AND table_name = $2
//       ORDER BY ordinal_position;
//     `;

//     const metadataResult = await pool.query(metadataQuery, [schemaName, tableName]);

//     res.status(200).json({
//       success: true,
//       data: dataResult.rows,
//       columns: metadataResult.rows
//     });

//   } catch (err) {
//     console.error('Error Retrieving the Records:', err);
//     res.status(500).json({
//       error: 'Failed to Get Record',
//       details: err.message
//     });
//   }
// };

// exports.getAllData = async (req, res) => {
//   const { schemaName, tableName } = req.body;
//   const teamMemberAccess = req.teamMemberAccess; // From middleware

//   if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
//     return res.status(400).json({ error: 'Invalid schema name' });
//   }

//   if (!tableName || /[^a-zA-Z0-9_]/.test(tableName)) {
//     return res.status(400).json({ error: 'Invalid table name' });
//   }

//   try {
//     let dataQuery;
//     let queryParams = [];
//     let allowedColumnsList = ['*']; // Default: all columns

//     // ============================================
//     // ROLE-BASED ACCESS CONTROL
//     // ============================================
//     if (teamMemberAccess && teamMemberAccess[tableName]) {
//       const access = teamMemberAccess[tableName];
      
//       console.log('🔒 Applying role restrictions for table:', tableName);
//       console.log('🔒 Access config:', access);

//       // COLUMN-LEVEL SECURITY: Select only allowed columns
//       if (access.columns && access.columns.length > 0) {
//         allowedColumnsList = access.columns;
//         const allowedColumns = access.columns
//           .map(col => `"${col}"`) // Quote column names for safety
//           .join(', ');
        
//         console.log('🔒 Allowed columns:', allowedColumns);
        
//         dataQuery = `SELECT ${allowedColumns} FROM "${schemaName}"."${tableName}"`;
//       } else {
//         // No column restriction, but still apply row filters
//         dataQuery = `SELECT * FROM "${schemaName}"."${tableName}"`;
//       }

//       // ROW-LEVEL SECURITY: Build WHERE clause from conditions
//       if (access.conditions && access.conditions.length > 0) {
//         const whereConditions = [];
        
//         access.conditions.forEach((condition, index) => {
//           const paramIndex = queryParams.length + 1;
          
//           // Build condition based on operator
//           const columnName = `"${condition.column}"`;
//           const operator = condition.operator;
          
//           whereConditions.push(`${columnName} ${operator} $${paramIndex}`);
//           queryParams.push(condition.value);
          
//           // Add logical operator (AND/OR) between conditions
//           if (condition.logicalOperator && index < access.conditions.length - 1) {
//             whereConditions.push(condition.logicalOperator);
//           }
//         });

//         const whereClause = ` WHERE ${whereConditions.join(' ')}`;
//         dataQuery += whereClause;
        
//         console.log('🔒 Row filters applied:', whereClause);
//         console.log('🔒 Filter values:', queryParams);
//       }

//       dataQuery += ';';
      
//       console.log('🔒 RESTRICTED QUERY:', dataQuery);
//     } else {
//       // ============================================
//       // FULL ACCESS (No restrictions)
//       // ============================================
//       dataQuery = `SELECT * FROM "${schemaName}"."${tableName}";`;
//       console.log('✅ FULL ACCESS QUERY:', dataQuery);
//     }

//     // Execute the data query (with or without restrictions)
//     const dataResult = await pool.query(dataQuery, queryParams);

//     // ============================================
//     // GET COLUMN METADATA
//     // ============================================
//     // Get metadata for ALL columns (for admin view)
//     const metadataQuery = `
//       SELECT 
//         column_name,
//         data_type,
//         is_nullable,
//         CASE 
//           WHEN is_nullable = 'NO' THEN true 
//           ELSE false 
//         END as required,
//         column_default,
//         ordinal_position
//       FROM information_schema.columns 
//       WHERE table_schema = $1 AND table_name = $2
//       ORDER BY ordinal_position;
//     `;

//     const metadataResult = await pool.query(metadataQuery, [schemaName, tableName]);

//     // ============================================
//     // FILTER METADATA FOR RESTRICTED USERS
//     // ============================================
//     let filteredMetadata = metadataResult.rows;
    
//     if (teamMemberAccess && teamMemberAccess[tableName]) {
//       const access = teamMemberAccess[tableName];
      
//       // Only return metadata for columns user has access to
//       if (access.columns && access.columns.length > 0) {
//         filteredMetadata = metadataResult.rows.filter(col => 
//           access.columns.includes(col.column_name)
//         );
        
//         console.log('🔒 Filtered metadata to allowed columns only');
//       }
//     }

//     // ============================================
//     // SEND RESPONSE
//     // ============================================
//     res.status(200).json({
//       success: true,
//       data: dataResult.rows,
//       columns: filteredMetadata,
//       // Additional info for frontend
//       restricted: !!(teamMemberAccess && teamMemberAccess[tableName]),
//       allowedColumns: allowedColumnsList,
//       recordCount: dataResult.rows.length
//     });

//   } catch (err) {
//     console.error('Error Retrieving the Records:', err);
//     res.status(500).json({
//       error: 'Failed to Get Record',
//       details: err.message
//     });
//   }
// };

exports.getAllData = async (req, res) => {
  const { schemaName, tableName, page = 1, limit = 50 } = req.body;
  const teamMemberAccess = req.teamMemberAccess; // From middleware

  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  if (!tableName || /[^a-zA-Z0-9_]/.test(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  // Validate pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'Invalid page number' });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
    return res.status(400).json({ error: 'Invalid limit (must be between 1 and 1000)' });
  }

  const offset = (pageNum - 1) * limitNum;

  try {
    let dataQuery;
    let countQuery;
    let queryParams = [];
    let countParams = [];
    let allowedColumnsList = ['*']; // Default: all columns

    // ============================================
    // ROLE-BASED ACCESS CONTROL
    // ============================================
    if (teamMemberAccess && teamMemberAccess[tableName]) {
      const access = teamMemberAccess[tableName];
      
      console.log('🔒 Applying role restrictions for table:', tableName);
      console.log('🔒 Access config:', access);

      // COLUMN-LEVEL SECURITY: Select only allowed columns
      if (access.columns && access.columns.length > 0) {
        allowedColumnsList = access.columns;
        const allowedColumns = access.columns
          .map(col => `"${col}"`) // Quote column names for safety
          .join(', ');
        
        console.log('🔒 Allowed columns:', allowedColumns);
        
        dataQuery = `SELECT ${allowedColumns} FROM "${schemaName}"."${tableName}"`;
      } else {
        // No column restriction, but still apply row filters
        dataQuery = `SELECT * FROM "${schemaName}"."${tableName}"`;
      }

      // Count query for total records
      countQuery = `SELECT COUNT(*) FROM "${schemaName}"."${tableName}"`;

      // ROW-LEVEL SECURITY: Build WHERE clause from conditions
      if (access.conditions && access.conditions.length > 0) {
        const whereConditions = [];
        
        access.conditions.forEach((condition, index) => {
          const paramIndex = queryParams.length + 1;
          
          // Build condition based on operator
          const columnName = `"${condition.column}"`;
          const operator = condition.operator;
          
          whereConditions.push(`${columnName} ${operator} $${paramIndex}`);
          queryParams.push(condition.value);
          countParams.push(condition.value); // Same params for count query
          
          // Add logical operator (AND/OR) between conditions
          if (condition.logicalOperator && index < access.conditions.length - 1) {
            whereConditions.push(condition.logicalOperator);
          }
        });

        const whereClause = ` WHERE ${whereConditions.join(' ')}`;
        dataQuery += whereClause;
        countQuery += whereClause;
        
        console.log('🔒 Row filters applied:', whereClause);
        console.log('🔒 Filter values:', queryParams);
      }

      // Add pagination
      const paginationParamStart = queryParams.length + 1;
      dataQuery += ` LIMIT $${paginationParamStart} OFFSET $${paginationParamStart + 1};`;
      queryParams.push(limitNum, offset);

      countQuery += ';';
      
      console.log('🔒 RESTRICTED QUERY:', dataQuery);
    } else {
      // ============================================
      // FULL ACCESS (No restrictions)
      // ============================================
      dataQuery = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT $1 OFFSET $2;`;
      queryParams = [limitNum, offset];
      
      countQuery = `SELECT COUNT(*) FROM "${schemaName}"."${tableName}";`;
      
      console.log('✅ FULL ACCESS QUERY:', dataQuery);
    }

    // Execute both queries in parallel for better performance
    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, queryParams),
      pool.query(countQuery, countParams)
    ]);

    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limitNum);

    // ============================================
    // GET COLUMN METADATA
    // ============================================
    // Get metadata for ALL columns (for admin view)
    const metadataQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        CASE 
          WHEN is_nullable = 'NO' THEN true 
          ELSE false 
        END as required,
        column_default,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const metadataResult = await pool.query(metadataQuery, [schemaName, tableName]);

    // ============================================
    // FILTER METADATA FOR RESTRICTED USERS
    // ============================================
    let filteredMetadata = metadataResult.rows;
    
    if (teamMemberAccess && teamMemberAccess[tableName]) {
      const access = teamMemberAccess[tableName];
      
      // Only return metadata for columns user has access to
      if (access.columns && access.columns.length > 0) {
        filteredMetadata = metadataResult.rows.filter(col => 
          access.columns.includes(col.column_name)
        );
        
        console.log('🔒 Filtered metadata to allowed columns only');
      }
    }

    // ============================================
    // SEND RESPONSE
    // ============================================
    res.status(200).json({
      success: true,
      data: dataResult.rows,
      columns: filteredMetadata,
      // Pagination info
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalRecords: totalRecords,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1
      },
      // Additional info for frontend
      restricted: !!(teamMemberAccess && teamMemberAccess[tableName]),
      allowedColumns: allowedColumnsList,
      recordCount: dataResult.rows.length
    });

  } catch (err) {
    console.error('Error Retrieving the Records:', err);
    res.status(500).json({
      error: 'Failed to Get Record',
      details: err.message
    });
  }
};

exports.updateRecordWithTimeStamp = async (req, res) => {
  const { schemaName, tableName, recordId, columnName, comment: value, ownerId, call } = req.body;
  console.log(req.query)

  // Validate schema name
  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  try {
    // Step 1: Get existing record using raw SQL

    const query = `SELECT * FROM ${schemaName}.${tableName} WHERE id = '${recordId}';`
    const result = await pool.query(query);


    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (call) {
      try {
        const result = await pool.query(
          queries.incrementByOne({ schemaName, tableName, recordId, columnName: "times_called" })
        );

        res.status(200).json({
          message: "Updated successfully",
          data: result.rows[0] || null
        });
      } catch (e) {
        console.error("Error updating:", e.message);
        res.status(500).json({
          message: "Updating failed",
          error: e.message
        });
      }
    }




    // Step 2: Extract previous value safely
    const previousValue = result.rows[0][columnName] || '';
    const callValue = call ? "Call-" + (result.rows[0].times_called + 1) : '';




    const clearval = value.replace("'", '');
    // Step 3: Create new value with timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newValue = `${callValue} ${timestamp} --- ${clearval}\n${previousValue}`;

    // Step 4: Update record using raw SQL
    const updateQuery = queries.updateRecord(schemaName, tableName, recordId, columnName, newValue);
    await pool.query(updateQuery);

    res.status(200).json({
      message: `Record in table ${schemaName}.${tableName} updated successfully.`,
      result
    });
  } catch (err) {
    console.error('Error Updating the Record:', err);
    res.status(500).json({
      error: 'Failed to Update Record',
      details: err.message
    });
  }
};

// url?schemaName=wa_expert&tableName=tasks&recordId=0d70b71c-4c2a-4d2d-82b5-dac08a72ecde&ownerId=73421c55-3152-455a-99e8-e09fbb00d9b8&col1=notes&val1=testing&col2

const SECRET_KEY = process.env.CRYPTO_SECRET_KEY;
// Working UpdateMultipleColumns without url approch
// exports.updateMultipleColumns = async (req, res) => {
//   const {
//     schemaName,
//     tableName,
//     recordId, vname, wid,
//     ...rest
//   } = req.query;

//   try {
//     if (!schemaName || !tableName || !recordId) {
//       return res.status(400).json({ error: 'Missing schemaName, tableName, or recordId' });
//     }

//     // Extract colN and valN pairs
//     const columnValuePairs = [];
//     const keys = Object.keys(rest);
//     const colValPairs = keys.filter(k => k.startsWith('col')).length;

//     for (let i = 1; i <= colValPairs; i++) {
//       const colKey = `col${i}`;
//       const valKey = `val${i}`;

//       if (rest[colKey] && rest[valKey] !== undefined) {
//         columnValuePairs.push([rest[colKey], rest[valKey]]);
//       }
//     }

//     if (columnValuePairs.length === 0) {
//       return res.status(400).json({ error: 'No column-value pairs provided' });
//     }

//     const { query, values } = queries.updateMultipleColumns({
//       schemaName,
//       tableName,
//       recordId,
//       columnValuePairs
//     });

//     const result = await pool.query(query, values);

//     if (wid) {
//       const table = `${schemaName}.${tableName}`;
//       const wResult = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [recordId]);
//       console.log(wResult.rows);
//       axios.post(`https://webhooks.wa.expert/webhook/${wid}`, wResult.rows);
//     }

//     res.status(200).json({
//       message: 'Update successful',
//       data: result.rows[0]
//     });

//   } catch (e) {
//     console.error(e);
//     res.status(500).json({
//       error: 'Failed to update columns',
//       details: e.message
//     });
//   }
// };

// Convert URL-safe Base64 back to standard Base64 before decrypting
const fromUrlSafe = (urlSafe) => {
  let base64 = urlSafe.replace(/-/g, '+').replace(/_/g, '/');
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) base64 += '='.repeat(padding);
  return base64;
};

const decryptWebhookUrl = (encryptedText) => {
  const standardBase64 = fromUrlSafe(encryptedText);
  const bytes = CryptoJS.AES.decrypt(standardBase64, SECRET_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  if (!decrypted) {
    throw new Error('Decryption failed — key mismatch or corrupted data');
  }

  return decrypted;
};

exports.updateMultipleColumns = async (req, res) => {
  const {
    schemaName,
    tableName,
    recordId, vname, wid,
    ...rest
  } = req.query;

  try {
    if (!schemaName || !tableName || !recordId) {
      return res.status(400).json({ error: 'Missing schemaName, tableName, or recordId' });
    }

    // Extract colN and valN pairs
    const columnValuePairs = [];
    const keys = Object.keys(rest);
    const colValPairs = keys.filter(k => k.startsWith('col')).length;

    for (let i = 1; i <= colValPairs; i++) {
      const colKey = `col${i}`;
      const valKey = `val${i}`;

      if (rest[colKey] && rest[valKey] !== undefined) {
        columnValuePairs.push([rest[colKey], rest[valKey]]);
      }
    }

    if (columnValuePairs.length === 0) {
      return res.status(400).json({ error: 'No column-value pairs provided' });
    }

    const { query, values } = queries.updateMultipleColumns({
      schemaName,
      tableName,
      recordId,
      columnValuePairs
    });

    const result = await pool.query(query, values);

    if (wid) {
      // Decrypt wid to get the actual webhook URL
      const webhookUrl = decryptWebhookUrl(wid);
      console.log('Decrypted webhook URL:', webhookUrl);

      const table = `${schemaName}.${tableName}`;
      const wResult = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [recordId]);
      console.log(wResult.rows);
      console.log(webhookUrl);

      // Now post directly to the decrypted URL instead of constructing it
      axios.post(webhookUrl, wResult.rows);
    }

    res.status(200).json({
      message: 'Update successful',
      data: result.rows[0]
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Failed to update columns',
      details: e.message
    });
  }
};


exports.incrementByOne = async (req, res) => {
  const { schemaName, tableName, recordId, columnName } = req.query;

  if (!schemaName || !tableName || !recordId || !columnName) {
    return res.status(400).json({ message: "Missing required parameters." });
  }

  try {
    const result = await pool.query(
      queries.incrementByOne({ schemaName, tableName, recordId, columnName })
    );

    res.status(200).json({
      message: "Updated successfully",
      data: result.rows[0] || null
    });
  } catch (e) {
    console.error("Error updating:", e.message);
    res.status(500).json({
      message: "Updating failed",
      error: e.message
    });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    const { owner_id } = req.query;
    const result = await pool.query(
      queries.getAllPayments(), [owner_id]
    )
    console.log(result);
    res.status(200).json({
      message: "Fetched All Payments Data Successfully",
      data: result.rows || null
    });

  } catch (err) {
    console.error("Error Getting Payment Reminder Data");
    res.status(500).json({
      message: "Error Getting Data",
      error: err.message
    })
  }
}



exports.getAllTables = async (req, res) => {
  try {
    const { schemaName } = req.query;

    const systemField = ["reminders","schema_migrations","team_member"]

    const query = `
      SELECT 
          t.table_name,
          COUNT(c.column_name) AS fields_count,
          NULL::timestamp AS created_at, -- Placeholder unless tracked manually
          s.last_analyze AS updated_at
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
      LEFT JOIN pg_stat_all_tables s
        ON t.table_name = s.relname 
        AND t.table_schema = s.schemaname
      WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name, s.last_analyze
      ORDER BY t.table_name;
    `;

    const result = await pool.query(query, [schemaName]);

    const formattedData = result.rows.map((row, index) => ({
      id: (index + 1).toString(),
      title: row.table_name,
      fieldsCount: Number(row.fields_count),
      createdAt: row.created_at
        ? new Date(row.created_at).toISOString()
        : new Date().toISOString(), // fallback
      updatedAt: row.updated_at
        ? new Date(row.updated_at).toISOString()
        : new Date().toISOString()
    }));

    res.status(200).json({
      message: "Fetched All Table Name Successfully",
     data: formattedData.filter(
  table => !systemField.includes(table.title)
     )
    });

  } catch (err) {
    console.error("Error Getting Table Data", err);
    res.status(500).json({
      message: "Error Getting Data",
      error: err.message
    });
  }
};

exports.getTableColumns = async (req, res) => {
  try {
    const { schemaName, tableName } = req.query;

    const query = `
      SELECT 
          column_name,
          data_type,
          is_nullable,
          character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const result = await pool.query(query, [schemaName, tableName]);

    const formattedData = result.rows.map((col, index) => ({
      id: (index + 1).toString(),
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === "YES",
      maxLength: col.character_maximum_length
    }));

    res.status(200).json({
      message: `Fetched Columns for Table ${tableName}`,
      data: formattedData
    });

  } catch (err) {
    console.error("Error Getting Table Columns", err);
    res.status(500).json({
      message: "Error Getting Table Columns",
      error: err.message
    });
  }
};

exports.createSubRecord = async (req, res) => {
  try {
    const { schemaName, tableName } = req.query;
    const data = req.body;
    if (!pa_id) {
      res.status(500).json({
        message: `Error Parent Id is required to create sub process`,
        error: err.message
      })
    }

    const result = await queries.createRecord(schemaName, tableName, data);
    res.status(200).json({
      message: "Sub Process created Successfully"
    })

  } catch (e) {
    res.status(500).json({
      message: `Error while creating the sub process of the process`,
      error: err.message
    })
  }
}

exports.deleteRecord = async (req, res) => {
  try {
    const { id, schemaName, tableName } = req.query;

    // Validate required parameters
    if (!id || !schemaName || !tableName) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "id, schemaName, and tableName are required"
      });
    }

    // Sanitize inputs to prevent SQL injection
    const sanitizedSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '');
    const sanitizedTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Check if record exists before deletion
    const checkQuery = `SELECT id FROM ${sanitizedSchema}.${sanitizedTable} WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: "Record not found",
        message: `No record found with id: ${id}`
      });
    }

    // Delete the record
    const deleteQuery = `DELETE FROM ${sanitizedSchema}.${sanitizedTable} WHERE id = $1 RETURNING id`;
    const deleteResult = await pool.query(deleteQuery, [id]);

    if (deleteResult.rows.length > 0) {
      res.status(200).json({
        message: "Record deleted successfully",
        deletedId: deleteResult.rows[0].id
      });
    } else {
      res.status(404).json({
        error: "Delete operation failed",
        message: "No record was deleted"
      });
    }

  } catch (e) {
    console.error('Delete record error:', e);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete record",
      details: e.message
    });
  }
};


const updateWastageByUsId = async (schemaName, tableName, us_id) => {
  try {
    const fullTableName = `${schemaName}.${tableName}`;

    // Step 1: Sum all wastage where pa_id = us_id
    const sumQuery = `
      SELECT COALESCE(SUM(wastage), 0) as total_wastage
      FROM ${fullTableName}
      WHERE pa_id = $1
    `;

    const sumResult = await pool.query(sumQuery, [us_id]);
    const totalWastage = sumResult.rows[0].total_wastage;

    // Step 2: Update wastage where us_id matches
    const updateQuery = `
      UPDATE ${fullTableName}
      SET wastage = $1
      WHERE us_id = $2
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [totalWastage, us_id]);

    return {
      success: updateResult.rowCount > 0,
      updatedRecord: updateResult.rows[0] || null,
      totalWastage: totalWastage
    };

  } catch (error) {
    console.error('Error updating wastage:', error);
    throw error;
  }
};