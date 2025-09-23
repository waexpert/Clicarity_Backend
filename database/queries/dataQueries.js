function toPostgresDate(inputDate) {
  // If already a Date object, format it and return
  if (inputDate instanceof Date) {
    if (isNaN(inputDate.getTime())) return null; // Invalid date
    return inputDate.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  // If not a string, return null
  if (typeof inputDate !== 'string') return null;
  
  // Trim the input
  const trimmed = inputDate.trim();
  if (!trimmed) return null;
  
  // Try to detect the format and parse
  let date;
  
  // Check common formats
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2}$/.test(trimmed)) {
    // Format: DD/MM/YY - first number is always day
    const parts = trimmed.split(/[\/\-\.]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
    const year = parseInt('20' + parts[2], 10); // Assuming 20xx for 2-digit years
    
    date = new Date(year, month, day);
  } 
  else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(trimmed)) {
    // Format: DD/MM/YYYY - first number is always day
    const parts = trimmed.split(/[\/\-\.]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
    const year = parseInt(parts[2], 10);
    
    date = new Date(year, month, day);
  }
  else if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(trimmed)) {
    // Format: YYYY/MM/DD
    const parts = trimmed.split(/[\/\-\.]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
    const day = parseInt(parts[2], 10);
    
    date = new Date(year, month, day);
  }
  else {
    // For all other formats, try creating a temporary date
    // that we can parse correctly afterward
    const tempDate = new Date(trimmed);
    if (!isNaN(tempDate.getTime())) {
      date = tempDate;
    } else {
      return null; // If we can't parse it, return null
    }
  }
  
  // Check if we got a valid date
  if (isNaN(date.getTime())) return null;
  
  // Format as YYYY-MM-DD for PostgreSQL
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Helper function to validate dates (used in more extensive validation)
function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}


// OLD Logic with out json validation

// function createRecord(schemaName, tableName, record) {
//   // Process each field, converting date fields with toPostgresDate
//   const processedRecord = {};
  
//   for (const [key, value] of Object.entries(record)) {
//     // Check if the column name contains "date"
//     if (key.toLowerCase().includes("date")) {
//       processedRecord[key] = toPostgresDate(value);
//     } else {
//       processedRecord[key] = value;
//     }
//   }
  
//   const columns = Object.keys(processedRecord); 
//   const values = Object.values(processedRecord); 
//   const placeholders = columns.map((_, idx) => `$${idx + 1}`);
  
//   // Create SET clause for UPDATE part of upsert
//   const updateSetClause = columns
//     .map(col => `"${col}" = EXCLUDED."${col}"`)
//     .join(', ');

//   const query = `
//     INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')})
//     VALUES (${placeholders.join(', ')})
//     ON CONFLICT (us_id) DO UPDATE SET ${updateSetClause}
//     RETURNING *`;
//   ;

//   return { query, values };
// }

function isJsonString(str) {
  if (typeof str !== "string") return false;
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

function createRecord(schemaName, tableName, record) {
  const processedRecord = {};

  for (const [key, value] of Object.entries(record)) {
    let newValue = value;

    // If value is JSON → replace with "-"
    if (typeof value === "string" && isJsonString(value)) {
      newValue = "-";
    } else if (key.toLowerCase().includes("date")) {
      // If column name contains "date", convert
      newValue = toPostgresDate(value);
    }

    processedRecord[key] = newValue;
  }

  const columns = Object.keys(processedRecord);
  const values = Object.values(processedRecord);
  const placeholders = columns.map((_, idx) => `$${idx + 1}`);

  const updateSetClause = columns
    .map(col => `"${col}" = EXCLUDED."${col}"`)
    .join(", ");

  const query = `
    INSERT INTO ${schemaName}.${tableName} (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    ON CONFLICT (us_id) DO UPDATE SET ${updateSetClause}
    RETURNING *`;

  return { query, values };
}


function createBulkInsertQuery(schemaName, tableName, records) {
  if (!records || !records.length) {
    throw new Error('Records array is empty or invalid');
  }
  
  // Process each record, converting date fields with toPostgresDate
  const processedRecords = records.map(record => {
    const processedRecord = {};
    
    for (const [key, value] of Object.entries(record)) {
      // Check if the column name contains "date"
      if (key.toLowerCase().includes("date")) {
        processedRecord[key] = toPostgresDate(value);
      } else {
        processedRecord[key] = value;
      }
    }
    
    return processedRecord;
  });
  
  // Extract column names from the first processed record
  const columns = Object.keys(processedRecords[0]);
  
  // Initialize values array and counter for parameterized values
  let allValues = [];
  let valueCounter = 1;
  let valuePlaceholders = [];
  
  // Process each record
  for (const record of processedRecords) {
    // Validate that record has the same columns
    if (!columns.every(col => Object.keys(record).includes(col))) {
      throw new Error('All records must have the same schema');
    }
    
    // Create placeholders for this record
    const recordPlaceholders = columns.map(() => `$${valueCounter++}`);
    valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
    
    // Add values in the correct order
    columns.forEach(col => {
      allValues.push(record[col]);
    });
  }
  
  // Create SET clause for UPDATE part of upsert
  const updateSetClause = columns
    .map(col => `"${col}" = EXCLUDED."${col}"`)
    .join(', ');
  
  // Construct the final query
  const query = `
    INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')})
    VALUES ${valuePlaceholders.join(', ')}
    ON CONFLICT (us_id) DO UPDATE SET ${updateSetClause}  
    RETURNING *;
  `;
  
  return { query, values: allValues };
}

function updateRecord(schemaName, tableName, recordId, columnName, value) {
  const formattedValue = typeof value === 'string' ? `'${value}'` : value;
  return `
    UPDATE "${schemaName}"."${tableName}" 
    SET "${columnName}" = ${formattedValue} 
    WHERE id = '${recordId}';
  `;
}

// Add a function to ensure the unique constraint exists
async function ensureUniqueConstraint(pool, schemaName, tableName, columnName) {
  const constraintName = `${tableName}_${columnName}_unique`;
  
  // Check if constraint already exists
  const checkQuery = `
    SELECT COUNT(*) as count
    FROM pg_constraint
    WHERE conname = $1;
  `;
  
  const checkResult = await pool.query(checkQuery, [constraintName]);
  
  if (checkResult.rows[0].count === 0) {
    // Constraint doesn't exist, create it
    const addConstraintQuery = `
      ALTER TABLE ${schemaName}.${tableName}
      ADD CONSTRAINT ${constraintName} UNIQUE (${columnName});
    `;
    
    await pool.query(addConstraintQuery);
    console.log(`Added unique constraint on ${columnName} column`);
  }
}

async function getAllData(schemaName,tableName){
  return`
  SELECT * FROM ${schemaName}.${tableName};
  `;
}

async function getRecordById(schemaName,tableName,recordId) {
  return `
  Select * From "${schemaName}"."${tableName}" Where recordId="${recordId}";
  `;
}



function updateMultipleColumns({ schemaName, tableName, recordId, columnValuePairs }) {
  const setClauses = [];
  const values = [];

  columnValuePairs.forEach(([col, val], index) => {
    setClauses.push(`"${col}" = $${index + 1}`);
    values.push(val);
  });

  // Add recordId to WHERE clause
  const recordIdIndex = values.length + 1;
  values.push(recordId);

  const query = `
    UPDATE "${schemaName}"."${tableName}"
    SET ${setClauses.join(', ')}
    WHERE id = $${recordIdIndex}
    RETURNING *;
  `;

  return { query, values };
}


function incrementByOne({ schemaName, tableName, recordId, columnName }) {
  return `
    UPDATE "${schemaName}"."${tableName}"
    SET "${columnName}" = "${columnName}" + 1
    WHERE id = '${recordId}'
    RETURNING *;
  `;
}

function getAllPayments(){
  return `
  SELECT * From payment_reminders WHERE owner_id = $1;
  `;
}







module.exports = {
  createRecord,
  updateRecord,
  createBulkInsertQuery,
  ensureUniqueConstraint,
  toPostgresDate,
  getAllData,
  getRecordById,
  updateMultipleColumns,
  incrementByOne,
  getAllPayments
};