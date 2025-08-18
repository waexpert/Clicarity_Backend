const rateLimit = require('express-rate-limit');
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { 
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Different limits for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests
  'API rate limit exceeded'
);

const strictLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 requests
  'Rate limit exceeded for this operation'
);

// For webhook endpoints - even stricter
const webhookLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  100, // 100 requests per minute
  'Webhook rate limit exceeded'
);

module.exports = { authLimiter, apiLimiter, strictLimiter, webhookLimiter };