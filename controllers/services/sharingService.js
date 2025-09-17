// services/sharingService.js
const { executeQuery } = require('../config/database');
const { generateShareToken, hashToken } = require('../utils/tokenGenerator');

const createSharingToken = async (sourceSchema, tableName, createdBy, options = {}) => {
  // First verify the table exists in the source schema
  const tableExistsQuery = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = $2
    )
  `;
  
  const tableCheck = await executeQuery(tableExistsQuery, [sourceSchema, tableName]);
  if (!tableCheck.rows[0].exists) {
    return {
      success: false,
      error: `Table '${tableName}' not found in schema '${sourceSchema}'`
    };
  }

  const token = generateShareToken();
  const tokenHash = hashToken(token);
  
  const permissions = {
    structure: options.includeStructure !== false, 
    data: options.includeData || false,
    maxRows: options.maxRows || null
  };
  
  const expiresAt = options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const query = `
    INSERT INTO sharing_tokens (token, source_schema, table_name, created_by, permissions, expires_at, max_uses)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at, expires_at
  `;

  const params = [tokenHash, sourceSchema, tableName, createdBy,JSON.stringify(permissions), expiresAt, options.maxUses || 10];

  try {
    const result = await executeQuery(query, params);
    return {
      success: true,
      data: {
        ...result.rows[0],
        shareableToken: token,
        shareableUrl: `${process.env.BASE_URL}/api/share/${token}`,
        tableName,
        sourceSchema,
        permissions
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Rest remains the same...
const getTokenInfo = async (token) => {
  const tokenHash = hashToken(token);
  
  const query = `
    SELECT *, 
           CASE 
             WHEN expires_at < NOW() THEN 'expired'
             WHEN current_uses >= max_uses THEN 'exhausted'
             WHEN NOT is_active THEN 'revoked'
             ELSE 'valid'
           END as status
    FROM sharing_tokens 
    WHERE token = $1
  `;

  try {
    const result = await executeQuery(query, [tokenHash]);
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Token not found' };
    }

    const tokenData = result.rows[0];
    
    if (tokenData.status !== 'valid') {
      return { success: false, error: `Token is ${tokenData.status}` };
    }

    return { success: true, data: tokenData };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
s


module.exports = {
  createSharingToken,
  getTokenInfo
};

