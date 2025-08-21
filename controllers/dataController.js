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
  const { schemaName, tableName, recordId, columnName, value, ownerId, vname, wid } = req.query;
  const vendorTable = schemaName.vendors;
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

    if (vname) {
      const vendorResult = await pool.query(`SELECT * FROM $1 WHERE name = $2`, vendorTable, vname);
      axios.post(`https://webhooks.wa.expert/webhook/${wid}`, vendorResult.rows);
    }

    res.status(200).json({ message: `Record updated to Table ${schemaName}.${tableName} successfully.` });
  } catch (err) {
    console.error('Error Updating the Record:', err);
    res.status(500).json({
      error: 'Failed to Update Record',
      details: err.message
    });
  }
};


// exports.getAllData = async (req, res) => {
//   const { schemaName, tableName } = req.body;

//   if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
//     return res.status(400).json({ error: 'Invalid schema name' });
//   }

//   try {
//     const query = `SELECT * FROM ${schemaName}.${tableName};`;
//     const result = await pool.query(query);
//     // return result.rows;
//     res.status(200).json(result.rows);

//   } catch (err) {
//     console.error('Error Retriving the Records:', err);
//     res.status(500).json({
//       error: 'Failed to Get Record',
//       details: err.message
//     });
//   }
// }


// Modified getAllData Route to get the data along with the not null constrain
exports.getAllData = async (req, res) => {
  const { schemaName, tableName } = req.body;

  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  if (!tableName || /[^a-zA-Z0-9_]/.test(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    // Get the actual data
    const dataQuery = `SELECT * FROM "${schemaName}"."${tableName}";`;
    const dataResult = await pool.query(dataQuery);

    // Get column metadata with NOT NULL constraints
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

    res.status(200).json({
      success: true,
      data: dataResult.rows,
      columns: metadataResult.rows
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

exports.updateMultipleColumns = async (req, res) => {
  const {
    schemaName,
    tableName,
    recordId, vname, wid,
    ...rest
  } = req.query;
  const vendorTable = schemaName.vendors;
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

    if (vname) {
      const vendorResult = await pool.query(`SELECT * FROM $1 WHERE name = $2`, vendorTable, vname);
      axios.post(`https://webhooks.wa.expert/webhook/${wid}`, vendorResult.rows);
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
      data: formattedData
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

exports.createSubRecord = async(req,res)=>{
  try{
    const {schemaName,tableName} = req.query;
    const data = req.body;
    if(!pa_id){
      res.status(500).json({
        message: `Error Parent Id is required to create sub process`,
        error: err.message
      })
    }

    const result = await queries.createRecord(schemaName,tableName,data);
    res.status(200).json({
      message:"Sub Process created Successfully"
    }) 
    
  }catch(e){
    res.status(500).json({
      message: `Error while creating the sub process of the process`,
      error: err.message
    })
  }
}