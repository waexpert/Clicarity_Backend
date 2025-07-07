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

// V1 Table creation Logic

// function generateCreateTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
//   if (!fields || fields.length === 0) {
//     throw new Error("Fields array cannot be empty or null.");
//   }
//   if (!tableName || tableName.trim() === "") {
//     throw new Error("Table name cannot be empty or null.");
//   }

//   const columns = fields.map((field) => {
//     let columnDefinition = `"${field.name}"`;

//     // Determine SQL type
//     switch (field.type.toLowerCase()) {
//       case 'number':
//         columnDefinition += ' INTEGER';
//         break;
//       case 'text':
//         columnDefinition += ' TEXT';
//         break;
//       case 'date':
//         columnDefinition += ' DATE';
//         break;
//       case 'boolean':
//         columnDefinition += ' BOOLEAN';
//         break;
//       default:
//         columnDefinition += ' TEXT';
//     }

//     // Special handling for UUID-based id
//     if (field.name === 'id' && useUUID) {
//       columnDefinition = `"id" UUID PRIMARY KEY DEFAULT uuid_generate_v4()`;
//     } else {
//       if (field.defaultValue !== null && field.defaultValue !== undefined) {
//         if (typeof field.defaultValue === 'string') {
//           columnDefinition += ` DEFAULT '${field.defaultValue}'`;
//         } else {
//           columnDefinition += ` DEFAULT ${field.defaultValue}`;
//         }
//       }

//       if (field.locked) {
//         columnDefinition += ' NOT NULL';
//       }
//     }

//     return columnDefinition;
//   });

//   // Sanitize schema name and combine it with the table name
//   const fullTableName = `"${schemaName}"."${tableName}"`;

//   const query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')})`;
//   return query;
// }

// exports.createTable = async(req,res)=>{
//   const {fields,table_name,schema_name,id} = req.body;
//   const createTableQuery = generateCreateTableQuery(fields, table_name, true,schema_name);
//   try{
//     await pool.query(createTableQuery);
//     res.status(200).json({message : `Table created succesfully in schema ${schema_name} of name ${table_name}`});
//   }catch(err){
//     console.error('Error Creating Table',err);
//     res.status(500).json({error :'Failed to create Table'})
//   }

// } 


// V2 column creation Logic

// function generateCreateTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
//   if (!fields || fields.length === 0) {
//     throw new Error("Fields array cannot be empty or null.");
//   }
//   if (!tableName || tableName.trim() === "") {
//     throw new Error("Table name cannot be empty or null.");
//   }

//   const columns = [];

//   fields.forEach((field) => {
//     let baseColumnDefinition;

//     // Special handling for UUID-based id
//     if (field.name === 'id' && useUUID) {
//       baseColumnDefinition = `"id" UUID PRIMARY KEY DEFAULT uuid_generate_v4()`;
//       columns.push(baseColumnDefinition);
//       return; // Skip adding *_date and *_comment for UUID primary key
//     }

//     // Define base column
//     baseColumnDefinition = `"${field.name}"`;

//     // Determine SQL type
//     switch (field.type.toLowerCase()) {
//       case 'number':
//         baseColumnDefinition += ' INTEGER';
//         break;
//       case 'text':
//         baseColumnDefinition += ' TEXT';
//         break;
//       case 'date':
//         baseColumnDefinition += ' DATE';
//         break;
//       case 'boolean':
//         baseColumnDefinition += ' BOOLEAN';
//         break;
//       default:
//         baseColumnDefinition += ' TEXT';
//     }

//     // Add default value if present
//     if (field.defaultValue !== null && field.defaultValue !== undefined) {
//       if (typeof field.defaultValue === 'string') {
//         baseColumnDefinition += ` DEFAULT '${field.defaultValue}'`;
//       } else {
//         baseColumnDefinition += ` DEFAULT ${field.defaultValue}`;
//       }
//     }

//     if (field.locked) {
//       baseColumnDefinition += ' NOT NULL';
//     }

//     columns.push(baseColumnDefinition);

//     // Add *_date column
//     columns.push(`"${field.name}_date" DATE`);

//     // Add *_comment column
//     columns.push(`"${field.name}_comment" TEXT`);
//   });

//   // Sanitize schema name and combine it with the table name
//   const fullTableName = `"${schemaName}"."${tableName}"`;

//   const query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')})`;
//   return query;
// }

function generateCreateTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
  if (!fields || fields.length === 0) {
    throw new Error("Fields array cannot be empty or null.");
  }
  if (!tableName || tableName.trim() === "") {
    throw new Error("Table name cannot be empty or null.");
  }

  const columns = [];

  // Always include UUID 'id' column
  const hasIdField = fields.some(f => f.name === 'id');
  if (!hasIdField && useUUID) {
    columns.push(`"id" UUID PRIMARY KEY DEFAULT uuid_generate_v4()`);
  }

  // Always include 'us_id' column as UNIQUE NOT NULL
  const hasUsIdField = fields.some(f => f.name === 'us_id');
  if (!hasUsIdField) {
    columns.push(`"us_id" TEXT UNIQUE NOT NULL`);
  }

  fields.forEach((field) => {
    // Skip 'id' and 'us_id' if already handled
    if ((field.name === 'id' && useUUID) || field.name === 'us_id') {
      return;
    }

    let columnDef = `"${field.name}"`;

    // Determine data type
    switch (field.type.toLowerCase()) {
      case 'number':
        columnDef += ' INTEGER';
        break;
      case 'text':
        columnDef += ' TEXT';
        break;
      case 'date':
        columnDef += ' DATE';
        break;
      case 'boolean':
        columnDef += ' BOOLEAN';
        break;
      default:
        columnDef += ' TEXT'; // fallback
    }

    // Handle default values
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        columnDef += ` DEFAULT '${field.defaultValue}'`;
      } else {
        columnDef += ` DEFAULT ${field.defaultValue}`;
      }
    }

    // Handle NOT NULL
    if (field.locked) {
      columnDef += ' NOT NULL';
    }

    columns.push(columnDef);

    // Add *_date and *_comment columns
    columns.push(`"${field.name}_date" DATE`);
    columns.push(`"${field.name}_comment" TEXT`);
  });

  const fullTableName = `"${schemaName}"."${tableName}"`;
  const query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')})`;

  return query;
}


exports.createTable = async(req,res)=>{
  const {fields, table_name, schema_name} = req.body;
  const createTableQuery = generateCreateTableQuery(fields, table_name, true, schema_name);
  try {
    await pool.query(createTableQuery);
    res.status(200).json({ message: `Table created successfully in schema ${schema_name} with name ${table_name}` });
  } catch(err) {
    console.error('Error Creating Table', err);
    res.status(500).json({ error: 'Failed to create Table' });
  }
}


exports.createRoles = async(req,res) =>{
  const {name,permissions,schemaName} = req.body;

  try{
    await pool.query(queries.createRole(schemaName,name,permissions));
    res.status(200).json({message : `Role Created successfully with the name ${name}`});
  }catch(err){
    console.error('Error Creating Role',err);
    res.status(500).json({error :'Failed to create Table'})
  }


}

exports.getAllRoles = async(req,res) =>{
  
  const {schemaName} = req.body;
 try{
 const result = await pool.query(queries.getAllRoles(schemaName));
res.status(200).json({message: `All Roles Retrived`,result:result.rows});
 }catch(err){
console.error('Error Retriving the Roles')
res.status(500).json({error:'Failed to retrive Roles'})
 }
}

exports.createTeamMember = async(req,res) =>{
  const {schemaName,userData,owner} = req.body;
  const {first_name,last_name,email,password,phone_number,role} = userData; 

  const teamMemberUserValues = [
    first_name,
    last_name,
    email,
    password,
    phone_number,
    owner.country,
    owner.currency,
    true,
    owner.schemaName,
    role,
    owner.first_name,
    owner.id
  ];

  const teamMemberValues = [
    first_name,
    last_name,
    email,
    password,
    role,
    phone_number,
    owner.id,
    owner.first_name
  ];
  

  try{
  // creating user in the user table
  const result = await pool.query(queries.createTeamMemberUser(schemaName),teamMemberUserValues)
  // creating user in team Member table
  await pool.query(queries.createTeamMember,teamMemberValues)
  res.status(201).json({message:`team Member created sucessfully`})
  }catch(e){
    console.error('Error creating new team Member')
    res.status(500).json({error:'Failed to create new team Member'})
  }
}

exports.getAllTeamMembers = async(req,res)=>{
  const {schemaName,tableName} = req.body;
  const query = `SELECT * FROM ${schemaName}.${tableName};`;
  const result = await pool.query(query);
  res.status(200).json({result});
}


exports.createView = async (req, res) => {
  const { viewName, schemaName, sourceTable, columns, whereCondition, username } = req.body;
  
  // Validation
  if (!schemaName || /[^a-zA-Z0-9_]/.test(schemaName)) {
    return res.status(400).json({ error: 'Invalid schema name' });
  }
  
  if (!viewName || /[^a-zA-Z0-9_]/.test(viewName)) {
    return res.status(400).json({ error: 'Invalid view name' });
  }
  
  if (!username || /[^a-zA-Z0-9_]/.test(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  
  // Generate the CREATE VIEW query
  const columnsList = Array.isArray(columns) ? columns.join(', ') : '*';
  const whereClause = whereCondition ? `WHERE ${whereCondition}` : '';
  
  // Create queries
  const createViewQuery = `
    CREATE OR REPLACE VIEW ${schemaName}.${viewName} AS
    SELECT ${columnsList}
    FROM ${schemaName}.${sourceTable}
    ${whereClause};
  `;
  
  // Set permissions
  const revokePublicQuery = `REVOKE ALL ON ${schemaName}.${viewName} FROM PUBLIC;`;
  const grantUserQuery = `GRANT SELECT ON ${schemaName}.${viewName} TO ${username};`;
  
  try {
    // Execute queries in a transaction
    await pool.query('BEGIN');
    
    await pool.query(createViewQuery);
    await pool.query(revokePublicQuery);
    await pool.query(grantUserQuery);
    
    await pool.query('COMMIT');
    
    res.status(200).json({ 
      message: `View ${viewName} created successfully in schema ${schemaName} with access granted to user ${username}` 
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error Creating View:', err);
    res.status(500).json({ error: 'Failed to create View' });
  }
};

exports.getTableStructure = async(req,res)=>{

const {schemaName,tableName} = req.body;
const query = `SELECT DATA_TYPE,COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schemaName}' AND TABLE_NAME = '${tableName}'`;

try{
  const result = await pool.query(query);
  res.status(200).json({data : result.rows})
  console.log("getting structure")
}catch(e){
  res.status(400).json({error:'Error Encountered while getting the structure of the Table'})
}
}

