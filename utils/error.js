const createError = (message, statusCode = 500, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
  error.isOperational = true;
  if (code) error.code = code;
  return error;
};

const createValidationError = (message, field = null) => {
  const error = createError(message, 400, 'VALIDATION_ERROR');
  if (field) error.field = field;
  return error;
};

const createAuthError = (message = 'Authentication failed') => {
  return createError(message, 401, 'AUTH_ERROR');
};

const createForbiddenError = (message = 'Access denied') => {
  return createError(message, 403, 'FORBIDDEN_ERROR');
};

const createNotFoundError = (message = 'Resource not found') => {
  return createError(message, 404, 'NOT_FOUND_ERROR');
};

const createDatabaseError = (message = 'Database operation failed') => {
  return createError(message, 500, 'DATABASE_ERROR');
};

module.exports = {
  createError,
  createValidationError,
  createAuthError,
  createForbiddenError,
  createNotFoundError,
  createDatabaseError,
};