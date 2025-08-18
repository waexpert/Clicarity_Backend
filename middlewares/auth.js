const jwt = require('jsonwebtoken');
const pool = require('../database/databaseConnection');
const { createAuthError, createForbiddenError } = require('../utils/errors');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(createAuthError('Access token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active
    const result = await pool.query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return next(createAuthError('Invalid or expired token'));
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(createAuthError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(createAuthError('Token expired'));
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(createForbiddenError('Insufficient permissions'));
    }
    next();
  };
};

const validateOwnership = (ownerField = 'owner_id') => {
  return (req, res, next) => {
    const ownerId = req.body[ownerField] || req.params[ownerField] || req.query[ownerField];
    
    if (req.user.role !== 'admin' && req.user.id !== ownerId) {
      return next(createForbiddenError('Access denied - not resource owner'));
    }
    next();
  };
};

module.exports = { authenticateToken, authorize, validateOwnership };