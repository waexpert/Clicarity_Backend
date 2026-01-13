exports.authenticate = (req, res, next) => {
  // For now, just attach a mock user for testing
  // REPLACE THIS with your actual JWT verification later
  
  // Check if user info is in headers (temporary solution)
  const userId = req.headers['x-user-id'];
  const userEmail = req.headers['x-user-email'];
  const schemaName = req.headers['x-schema-name'];
  
  if (userId) {
    req.user = {
      id: userId,
      email: userEmail,
      schema_name: schemaName
    };
    console.log('✅ [AUTH] User set from headers:', req.user);
  } else {
    console.log('⚠️ [AUTH] No user info - proceeding without auth');
    req.user = null;
  }
  
  next();
};