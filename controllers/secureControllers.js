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

// exports.createTeamMember = async(req,res) =>{
//   const {schemaName,userData,owner} = req.body;
//   const {first_name,last_name,email,password,phone_number,role} = userData; 

//   const teamMemberUserValues = [
//     first_name,
//     last_name,
//     email,
//     password,
//     phone_number,
//     owner.country,
//     owner.currency,
//     true,
//     owner.schemaName,
//     role,
//     owner.first_name,
//     owner.id
//   ];

//   const teamMemberValues = [
//     first_name,
//     last_name,
//     email,
//     password,
//     role,
//     phone_number,
//     owner.id,
//     owner.first_name
//   ];
  

//   try{
//   // creating user in the user table
//   const result = await pool.query(queries.createTeamMemberUser(schemaName),teamMemberUserValues)
//   // creating user in team Member table
//   await pool.query(queries.createTeamMember,teamMemberValues)
//   res.status(201).json({message:`team Member created sucessfully`})
//   }catch(e){
//     console.error('Error creating new team Member')
//     res.status(500).json({error:'Failed to create new team Member'})
//   }
// }

exports.createTeamMember = async (req, res) => {
  const { schemaName, userData, owner } = req.body;
  const { first_name, last_name, email, password, phone_number, role } = userData;

  const postgresUsername = email.replace(/[^a-zA-Z0-9_]/g, '_');

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

  const productTables = ['product1', 'product2', 'product3', 'product4', 'product5'];

  try {
    // Insert into users table
    await pool.query(queries.createTeamMemberUser(schemaName), teamMemberUserValues);

    // Check if the team Member table exist and create if not exist
    await pool.query(queries.createTeamMemberTable(schemaName))
    // Create teamMember table if not exists and insert
    await pool.query(queries.createTeamMember(schemaName),teamMemberValues);

    // Create PostgreSQL user
    await pool.query(`CREATE USER ${postgresUsername} WITH PASSWORD '${password}';`);

    // Create product tables for the team member
    for (const table of productTables) {
      const tableName = `${table}_${postgresUsername}`;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.${tableName} (
          id SERIAL PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Revoke access from PUBLIC
      await pool.query(`REVOKE ALL ON ${schemaName}.${tableName} FROM PUBLIC;`);

      // Revoke access from all other team members
      const allUsers = await pool.query(`SELECT email FROM ${schemaName}.teamMember`);
      for (const otherUser of allUsers.rows) {
        const otherUsername = otherUser.email.replace(/[^a-zA-Z0-9_]/g, '_');
        if (otherUsername !== postgresUsername) {
          await pool.query(`REVOKE ALL ON ${schemaName}.${tableName} FROM ${otherUsername};`);
        }
      }

      // Grant access only to this user
      await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${schemaName}.${tableName} TO ${postgresUsername};`);
    }

    // Grant schema usage to this user
    await pool.query(`GRANT USAGE ON SCHEMA ${schemaName} TO ${postgresUsername};`);

    res.status(201).json({ message: `Team member created successfully` });
  } catch (e) {
    console.error('Error creating new team member', e);
    res.status(500).json({ error: 'Failed to create new team member' });
  }
};


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