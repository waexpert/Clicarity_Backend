function createSchema(schemaName) {
  return `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
}

function createUser(userName, password) {
  return `CREATE USER ${userName} WITH PASSWORD '${password}'`;

}
const updateSchema = "UPDATE users SET schema_name = $1 WHERE id = $2";


// Role And Permissions
function createRole(schemaName, name, permissions) {
  const formattedPermissions = `{${permissions.join(',')}}`;
  return `INSERT INTO "${schemaName}".roles (name, permissions) 
          VALUES ('${name}', '${formattedPermissions}')`;
}

function getAllRoles(schemaName) {
  return `SELECT * FROM "${schemaName}".roles`;
}

// Team Member
function createTeamMemberUser(schemaName) {
  return `
    INSERT INTO users (
      first_name,
      last_name,
      email,
      password,
      phone_number,
      country,
      currency,
      is_verified,
      schema_name,
      role,
      owner_first_name,
      owner_id
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12
    );
  `;
}


function createTeamMemberTable(schemaName) {
  return `
    CREATE TABLE IF NOT EXISTS ${schemaName}.teamMember (
      id SERIAL PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      password TEXT,
      role TEXT,
      phone_number TEXT,
      owner_id TEXT,
      owner_first_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );


  `;
}

function createTeamMember(schemaName){
  return`
      INSERT INTO ${schemaName}.teamMember (
      first_name, last_name, email, password, role, phone_number, owner_id, owner_first_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
  `;
}


module.exports = {
  createSchema,
  createUser,
  updateSchema,
  createRole,
  getAllRoles,
  createTeamMemberUser,
  createTeamMemberTable,
  createTeamMember
};
