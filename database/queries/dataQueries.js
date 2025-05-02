function createRecord(schemaName, tableName, record) {
    const columns = Object.keys(record); 
    const values = Object.values(record); 
    const placeholders = columns.map((_, idx) => `$${idx + 1}`);
  
    const query = `
      INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *;
    `;
  
    return { query, values };
  }

  function updateRecord(schemaName, tableName, recordId, columnName, value) {
    const formattedValue = typeof value === 'string' ? `'${value}'` : value;
    return `
      UPDATE "${schemaName}"."${tableName}" 
      SET "${columnName}" = ${formattedValue} 
      WHERE id = '${recordId}';
    `;
  }
  
  
  module.exports = {
  createRecord,
  updateRecord
  }