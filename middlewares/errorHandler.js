const { createError } = require('../utils/errors');

const handleDatabaseError = (err) => {
  if (err.code === '23505') { // Unique violation
    return createError('Duplicate entry found', 409, 'DUPLICATE_ERROR');
  }
  if (err.code === '23503') { // Foreign key violation
    return createError('Referenced record not found', 400, 'REFERENCE_ERROR');
  }
  if (err.code === '23502') { // Not null violation
    return createError('Required field missing', 400, 'REQUIRED_FIELD_ERROR');
  }
  return createError('Database operation failed', 500, 'DATABASE_ERROR');
};

const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return createError('Invalid token', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return createError('Token expired', 401, 'TOKEN_EXPIRED');
  }
  return createError('Authentication failed', 401, 'AUTH_ERROR');
};

const sendErrorDev = (err, req, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  });
};

const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString(),
    });
  }
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err, message: err.message };

    // Handle specific database errors
    if (err.code && err.code.startsWith('23')) {
      error = handleDatabaseError(err);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      error = handleJWTError(err);
    }

    sendErrorProd(error, req, res);
  }
};

module.exports = globalErrorHandler;