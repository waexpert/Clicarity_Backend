const pool = require("../database/databaseConnection");
const queries = require("../database/queries/dataQueries");
const userQueries = require("../database/queries/userQueries");

exports.createRecord = async (req, res) => {
    const { schemaName, tableName, record } = req.body;
  
    if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
      return res.status(400).json({ error: 'Invalid schema name' });
    }
  
    try {
        // First ensure the unique constraint exists
        await queries.ensureUniqueConstraint(pool, schemaName, tableName, 'us_id');
        
        // Then create the record with date formatting
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

exports.createBulkRecord = async(req, res) => {
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

exports.updateRecord = async (req, res) => {
    const { schemaName, tableName, recordId, columnName, value, ownerId } = req.query;
  
    if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
      return res.status(400).json({ error: 'Invalid schema name' });
    }
  
    try {
        // Format date values if column name contains 'date'
        let formattedValue = value;
        if (columnName.toLowerCase().includes('date')) {
            formattedValue = queries.toPostgresDate(value);
        }
        
        await pool.query(queries.updateRecord(schemaName, tableName, recordId, columnName, formattedValue)); 
        await pool.query(userQueries.updateApi, [ownerId]);
        
        res.status(200).json({ message: `Record updated to Table ${schemaName}.${tableName} successfully.` });
    } catch (err) {
        console.error('Error Updating the Record:', err);
        res.status(500).json({ 
            error: 'Failed to Update Record',
            details: err.message
        });
    }  
};


exports.getAllData = async(req,res) =>{
    const {schemaName,tableName} = req.body;

    if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
        return res.status(400).json({ error: 'Invalid schema name' });
      }

      try {
        const query = `SELECT * FROM ${schemaName}.${tableName};`;
        const result = await pool.query(query);
        // return result.rows;
        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Error Retriving the Records:', err);
        res.status(500).json({ 
            error: 'Failed to Get Record',
            details: err.message
        });
    }
    
    
}


exports.updateRecordWithTimeStamp = async (req, res) => {
  const { schemaName, tableName, recordId, columnName, value, ownerId } = req.query;
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

    // Step 2: Extract previous value safely
    const previousValue = result.rows[0][columnName] || '';


    const clearval = value.replace("'",'');
    // Step 3: Create new value with timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newValue = `${timestamp} --- ${clearval}\n${previousValue}`;

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

exports.updateMultipleColumns = async (req, res) => {
  const {
    schemaName,
    tableName,
    recordId,
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

