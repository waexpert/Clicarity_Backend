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