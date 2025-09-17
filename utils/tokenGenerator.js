// utils/tokenGenerator.js
const crypto = require('crypto');

const generateShareToken = () => {
  // Generate a URL-safe token
  return crypto.randomBytes(32).toString('base64url');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const validateTokenFormat = (token) => {
  // Check if token is valid base64url and correct length
  return /^[A-Za-z0-9_-]{43}$/.test(token);
};

module.exports = {
  generateShareToken,
  hashToken,
  validateTokenFormat
};