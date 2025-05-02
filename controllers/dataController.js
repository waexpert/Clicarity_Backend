const pool = require("../database/databaseConnection");
const queries = require("../database/queries/dataQueries");

exports.createRecord = async (req, res) => {
    const { schemaName,tableName,record } = req.body;
  
    if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
      return res.status(400).json({ error: 'Invalid schema name' });
    }
  
    try {
        const { query, values } = queries.createRecord(schemaName, tableName, record);
        await pool.query(query, values); // OR: await pool.query({ text: query, values })
        
        res.status(200).json({ message: `Record Inserted to Table ${tableName} successfully.` });
      } catch (err) {
        console.error('Error Inserting the Record:', err);
        res.status(500).json({ error: 'Failed to Insert Record' });
      }  
  };
  

  exports.updateRecord = async (req, res) => {
    const { schemaName, tableName, recordId, columnName, value } = req.query;
  
    if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
      return res.status(400).json({ error: 'Invalid schema name' });
    }
  
    try {
      
        await pool.query(queries.updateRecord(schemaName, tableName, recordId, columnName, value)); 
        
        res.status(200).json({ message: `Record updated to Table ${schemaName}.${tableName} successfully.` });
      } catch (err) {
        console.error('Error Updating the Record:', err);
        res.status(500).json({ error: 'Failed to Update Record' });
      }  
  };