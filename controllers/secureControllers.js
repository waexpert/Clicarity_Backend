const pool = require("../database/databaseConnection");

// Create Schema
const queries = require("../database/queries/secureQueries");
exports.createSchema = async (req, res) => {
  const { schemaName,id } = req.body;

  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }

  try {
    await pool.query(queries.createSchema(schemaName));
    await pool.query(queries.updateSchema,[schemaName,id]);
    res.status(200).json({ message: `Schema "${schemaName}" created successfully.` });
  } catch (err) {
    console.error('Error creating schema:', err);
    res.status(500).json({ error: 'Failed to create schema' });
  }
};

// Create User
exports.createUser = async (req, res) => {
  const { userName, password,schemaName } = req.body;

  if (!userName || !password) {
    res.status(400).json({ message: `userName or password missing` });
  }

  try {
    
    await pool.query(queries.createUser(userName, password));
    
    res.status(200).json({ message: `User "${userName}" created succesfully` });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

exports.createProductTable = async(req,res)=>{
  const {query,productName,schemaName} = req.body;
  if(!query){
    res.status(400).json({message : "Invalid Query" })
  }

  try{
  await pool.query(query);
  res.status(200).json({message : `Table created succesfully for the Product ${productName}`});
  }catch(err){
  console.error('Error Creating Table',err);
  res.status(500).json({error :'Failed to create Table'})
  }
}

function generateCreateTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
  if (!fields || fields.length === 0) {
    throw new Error("Fields array cannot be empty or null.");
  }
  if (!tableName || tableName.trim() === "") {
    throw new Error("Table name cannot be empty or null.");
  }

  const columns = fields.map((field) => {
    let columnDefinition = `"${field.name}"`;

    // Determine SQL type
    switch (field.type.toLowerCase()) {
      case 'number':
        columnDefinition += ' INTEGER';
        break;
      case 'text':
        columnDefinition += ' TEXT';
        break;
      case 'date':
        columnDefinition += ' DATE';
        break;
      case 'boolean':
        columnDefinition += ' BOOLEAN';
        break;
      default:
        columnDefinition += ' TEXT';
    }

    // Special handling for UUID-based id
    if (field.name === 'id' && useUUID) {
      columnDefinition = `"id" UUID PRIMARY KEY DEFAULT uuid_generate_v4()`;
    } else {
      if (field.defaultValue !== null && field.defaultValue !== undefined) {
        if (typeof field.defaultValue === 'string') {
          columnDefinition += ` DEFAULT '${field.defaultValue}'`;
        } else {
          columnDefinition += ` DEFAULT ${field.defaultValue}`;
        }
      }

      if (field.locked) {
        columnDefinition += ' NOT NULL';
      }
    }

    return columnDefinition;
  });

  // Sanitize schema name and combine it with the table name
  const fullTableName = `"${schemaName}"."${tableName}"`;

  const query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')})`;
  return query;
}

exports.createTable = async(req,res)=>{
  const {fields,table_name,schema_name,id} = req.body;
  const createTableQuery = generateCreateTableQuery(fields, table_name, true,schema_name);
  try{
    await pool.query(createTableQuery);
    res.status(200).json({message : `Table created succesfully in schema ${schema_name} of name ${table_name}`});
  }catch(err){
    console.error('Error Creating Table',err);
    res.status(500).json({error :'Failed to create Table'})
  }

} 