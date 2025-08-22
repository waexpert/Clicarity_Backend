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




exports.generateAlterTableQuery=(newFields, tableName, schemaName = 'public')=>{
  if (!newFields || newFields.length === 0) {
    throw new Error("New fields array cannot be empty.");
  }
  if (!tableName || tableName.trim() === "") {
    throw new Error("Table name cannot be empty.");
  }

  const alterStatements = [];
  const fullTableName = `"${schemaName}"."${tableName}"`;

  newFields.forEach((field) => {
    // Skip system fields that should already exist
    if (field.systemField || field.name === 'id' || field.name === 'us_id') {
      return;
    }

    let columnDef = `"${field.name}"`;

    // Determine column type
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
      case 'uuid':
        columnDef += ' UUID';
        break;
      default:
        columnDef += ' TEXT';
    }

    // Add default value
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        columnDef += ` DEFAULT '${field.defaultValue}'`;
      } else {
        columnDef += ` DEFAULT ${field.defaultValue}`;
      }
    }

    // Add the main column
    alterStatements.push(`ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS ${columnDef}`);
    
    // Add associated date and comment columns
    alterStatements.push(`ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${field.name}_date" DATE`);
    alterStatements.push(`ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${field.name}_comment" TEXT`);
  });

  return alterStatements;
}

// Backend endpoint function
async function addColumnsToTable(req, res) {
  try {
    const { table_name, fields, schema_name, id } = req.body;
    
    // First check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )
    `;
    
    const tableExists = await db.query(tableExistsQuery, [schema_name, table_name]);
    
    if (!tableExists.rows[0].exists) {
      return res.status(400).json({ 
        success: false, 
        message: "Table does not exist. Create the table first." 
      });
    }

    // Get existing columns
    const existingColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
    `;
    
    const existingColumns = await db.query(existingColumnsQuery, [schema_name, table_name]);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);

    // Filter out fields that already exist
    const newFields = fields.filter(field => !existingColumnNames.includes(field.name));

    if (newFields.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No new columns to add. All fields already exist." 
      });
    }

    // Generate ALTER TABLE statements
    const alterStatements = generateAlterTableQuery(newFields, table_name, schema_name);

    // Execute each ALTER statement
    for (const statement of alterStatements) {
      await db.query(statement);
    }

    res.status(200).json({ 
      success: true, 
      message: `Successfully added ${newFields.length} new columns to table ${table_name}`,
      addedColumns: newFields.map(f => f.name)
    });

  } catch (error) {
    console.error('Error adding columns to table:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add columns to table',
      error: error.message 
    });
  }
}



// function generateCreateTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
//   if (!fields || fields.length === 0) {
//     throw new Error("Fields array cannot be empty or null.");
//   }
//   if (!tableName || tableName.trim() === "") {
//     throw new Error("Table name cannot be empty or null.");
//   }

//   const columns = [];

//   const normalizedFields = [...fields];

//   // Add id field if not included
//   const hasId = normalizedFields.some(f => f.name === 'id');
//   if (!hasId && useUUID) {
//     normalizedFields.unshift({ name: 'id', type: 'uuid', systemField: true });
//   }

//   // Add us_id field if not included
//   const hasUsId = normalizedFields.some(f => f.name === 'us_id');
//   if (!hasUsId) {
//     normalizedFields.push({ name: 'us_id', type: 'text', systemField: true });
//   }

//   normalizedFields.forEach((field) => {
//     let columnDef = `"${field.name}"`;

//     // Force override for 'id'
//     if (field.name === 'id' && useUUID) {
//       columnDef = `"id" UUID PRIMARY KEY DEFAULT uuid_generate_v4()`;
//       columns.push(columnDef);
//       return;
//     }

//     // Force override for 'us_id'
//     if (field.name === 'us_id') {
//       columnDef = `"us_id" TEXT UNIQUE NOT NULL`;
//       columns.push(columnDef);
//       return;
//     }

//     // Determine column type
//     switch (field.type.toLowerCase()) {
//       case 'number':
//         columnDef += ' INTEGER';
//         break;
//       case 'text':
//         columnDef += ' TEXT';
//         break;
//       case 'date':
//         columnDef += ' DATE';
//         break;
//       case 'boolean':
//         columnDef += ' BOOLEAN';
//         break;
//       case 'uuid':
//         columnDef += ' UUID';
//         break;
//       default:
//         columnDef += ' TEXT'; // fallback
//     }

//     // Add default value
//     if (field.defaultValue !== null && field.defaultValue !== undefined) {
//       if (typeof field.defaultValue === 'string') {
//         columnDef += ` DEFAULT '${field.defaultValue}'`;
//       } else {
//         columnDef += ` DEFAULT ${field.defaultValue}`;
//       }
//     }

//     // NOT NULL for locked fields
//     if (field.locked) {
//       columnDef += ' NOT NULL';
//     }

//     columns.push(columnDef);

//     // Add *_date and *_comment columns for non-system fields
//     if (!field.systemField) {
//       columns.push(`"${field.name}_date" DATE`);
//       columns.push(`"${field.name}_comment" TEXT`);
//     }
//   });

//   const fullTableName = `"${schemaName}"."${tableName}"`;
//   const query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')})`;

//   return query;
// }

// exports.createTable = async(req,res)=>{
//   const {fields, table_name, schema_name} = req.body;
//   const createTableQuery = generateCreateTableQuery(fields, table_name, true, schema_name);
//   try {
//     await pool.query(createTableQuery);
//     res.status(200).json({ message: `Table created successfully in schema ${schema_name} with name ${table_name}` });
//   } catch(err) {
//     console.error('Error Creating Table', err);
//     res.status(500).json({ error: 'Failed to create Table' });
//   }
// }

function generateCreateTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
  if (!fields || fields.length === 0) {
    throw new Error("Fields array cannot be empty or null.");
  }
  if (!tableName || tableName.trim() === "") {
    throw new Error("Table name cannot be empty or null.");
  }

  const columns = [];

  const normalizedFields = [...fields];

  // Add id field if not included
  const hasId = normalizedFields.some(f => f.name === 'id');
  if (!hasId && useUUID) {
    normalizedFields.unshift({ name: 'id', type: 'uuid', systemField: true });
  }

  // Add us_id field if not included
  const hasUsId = normalizedFields.some(f => f.name === 'us_id');
  if (!hasUsId) {
    normalizedFields.push({ name: 'us_id', type: 'text', systemField: true });
  }

  normalizedFields.forEach((field) => {
    let columnDef = `"${field.name}"`;

    // Force override for 'id'
    if (field.name === 'id' && useUUID) {
      columnDef = `"id" UUID PRIMARY KEY DEFAULT uuid_generate_v4()`;
      columns.push(columnDef);
      return;
    }

    // Force override for 'us_id'
    if (field.name === 'us_id') {
      columnDef = `"us_id" TEXT UNIQUE NOT NULL`;
      columns.push(columnDef);
      return;
    }

    // Determine column type
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
      case 'uuid':
        columnDef += ' UUID';
        break;
      default:
        columnDef += ' TEXT'; // fallback
    }


        // Determine column NULL or NOT
    switch (field.required) {
      case true:
        columnDef += ' NOT NULL';
        break;
      default:
        columnDef += ' NULL';
    }

    // Add default value
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        columnDef += ` DEFAULT '${field.defaultValue}'`;
      } else {
        columnDef += ` DEFAULT ${field.defaultValue}`;
      }
    }

    // NOT NULL for locked fields
    if (field.locked) {
      columnDef += ' NOT NULL';
    }

    columns.push(columnDef);

    // Add *_date and *_comment columns for non-system fields
    if (!field.systemField) {
      columns.push(`"${field.name}_date" DATE`);
      columns.push(`"${field.name}_comment" TEXT`);
      columns.push(`"${field.name}_times_called" INT`);
    }
  });

  const fullTableName = `"${schemaName}"."${tableName}"`;
  const query = `CREATE TABLE IF NOT EXISTS ${fullTableName} (${columns.join(', ')})`;

  return query;
}

function generateDummyInsertQuery(fields, tableName, schemaName = 'public') {
  const normalizedFields = [...fields];

  // Add id field if not included
  const hasId = normalizedFields.some(f => f.name === 'id');
  if (!hasId) {
    normalizedFields.unshift({ name: 'id', type: 'uuid', systemField: true });
  }

  // Add us_id field if not included
  const hasUsId = normalizedFields.some(f => f.name === 'us_id');
  if (!hasUsId) {
    normalizedFields.push({ name: 'us_id', type: 'text', systemField: true });
  }

  const insertColumns = [];
  const insertValues = [];

  normalizedFields.forEach((field) => {
    insertColumns.push(`"${field.name}"`);

    // Generate dummy values based on field type
    if (field.name === 'id') {
      insertValues.push('uuid_generate_v4()');
    } else if (field.name === 'us_id') {
      insertValues.push("'dummy_us_id'");
    } else {
      switch (field.type.toLowerCase()) {
        case 'number':
          insertValues.push('0');
          break;
        case 'text':
          insertValues.push(`'dummy_${field.name}'`);
          break;
        case 'date':
          insertValues.push('CURRENT_DATE');
          break;
        case 'boolean':
          insertValues.push('false');
          break;
        case 'uuid':
          insertValues.push('uuid_generate_v4()');
          break;
        default:
          insertValues.push(`'dummy_${field.name}'`);
      }
    }

    // ONLY add dummy values for *_date and *_comment columns for NON-SYSTEM fields
    // if (!field.systemField) {
    //   insertColumns.push(`"${field.name}_date"`);
    //   insertValues.push('CURRENT_DATE');
      
    //   insertColumns.push(`"${field.name}_comment"`);
    //   insertValues.push(`'dummy_comment_for_${field.name}'`);
    // }
  });

  const fullTableName = `"${schemaName}"."${tableName}"`;
  const query = `INSERT INTO ${fullTableName} (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`;

  return query;
}

exports.createTable = async(req, res) => {
  const {fields, table_name, schema_name} = req.body;
  
  try {
    // Create the table
    const createTableQuery = generateCreateTableQuery(fields, table_name, true, schema_name);
    await pool.query(createTableQuery);
    
    // Insert dummy entry
    const dummyInsertQuery = generateDummyInsertQuery(fields, table_name, schema_name);
    await pool.query(dummyInsertQuery);
    
    res.status(200).json({ 
      message: `Table created successfully in schema ${schema_name} with name ${table_name} and dummy entry inserted` 
    });
  } catch(err) {
    console.error('Error Creating Table or Inserting Dummy Data', err);
    res.status(500).json({ error: 'Failed to create Table or insert dummy data' });
  }
}

function generateAlterTableQuery(fields, tableName, useUUID = true, schemaName = 'public') {
  if (!fields || fields.length === 0) {
    throw new Error("Fields array cannot be empty or null.");
  }
  if (!tableName || tableName.trim() === "") {
    throw new Error("Table name cannot be empty or null.");
  }

  const alterStatements = [];
  const normalizedFields = [...fields];

  normalizedFields.forEach((field) => {
    let columnDef = `"${field.name}"`;

    // Determine column type
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
      case 'uuid':
        columnDef += ' UUID';
        break;
      default:
        columnDef += ' TEXT'; // fallback
    }

    // Determine column NULL or NOT NULL
    switch (field.required) {
      case true:
        columnDef += ' NOT NULL';
        break;
      default:
        // Don't add NULL explicitly - it's the default
        break;
    }

    // Add default value
    if (field.defaultValue !== null && field.defaultValue !== undefined) {
      if (typeof field.defaultValue === 'string') {
        columnDef += ` DEFAULT '${field.defaultValue}'`;
      } else {
        columnDef += ` DEFAULT ${field.defaultValue}`;
      }
    }

    // NOT NULL for locked fields (but avoid duplicate NOT NULL)
    if (field.locked && !field.required) {
      columnDef += ' NOT NULL';
    }

    // Add main column
    const fullTableName = `"${schemaName}"."${tableName}"`;
    alterStatements.push(`ALTER TABLE ${fullTableName} ADD COLUMN ${columnDef}`);

    // Add *_date and *_comment columns for non-system fields
    if (!field.systemField) {
      alterStatements.push(`ALTER TABLE ${fullTableName} ADD COLUMN "${field.name}_date" DATE`);
      alterStatements.push(`ALTER TABLE ${fullTableName} ADD COLUMN "${field.name}_comment" TEXT`);
    }
  });

  return alterStatements;
}

exports.alterTable = async (req, res) => {
  const { fields, table_name, schema_name } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Generate all ALTER statements
    const alterStatements = generateAlterTableQuery(fields, table_name, true, schema_name);
    
    console.log('Executing ALTER statements:', alterStatements);
    
    // Execute each ALTER statement
    for (const statement of alterStatements) {
      await client.query(statement);
    }
    
    await client.query('COMMIT');
    
    res.status(200).json({ 
      message: `Structure of Table Modified successfully in schema ${schema_name} with name ${table_name}`,
      statementsExecuted: alterStatements.length
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error Modifying Table Structure:', err);
    res.status(500).json({ 
      error: 'Failed to Modify Table Structure',
      details: err.message 
    });
  } finally {
    client.release();
  }
};

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

