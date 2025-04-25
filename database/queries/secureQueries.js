function createSchema(schemaName) {
  return `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
}

function createUser(userName, password) {
  return  `CREATE USER ${userName} WITH PASSWORD '${password}'`;

}
const updateSchema = "UPDATE users SET schema_name = $1 WHERE id = $2";

module.exports = {
  createSchema,
  createUser,
  updateSchema
};
