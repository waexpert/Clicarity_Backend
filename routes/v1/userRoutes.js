const express = require('express');
const { 
  registerUser, 
  getUserDetails, 
  logout, 
  loginUser,
  refreshToken,
} = require('../../controllers/userController');
const { authenticateToken } = require('../../middleware/auth');
const { authLimiter, apiLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();
// Public routes
router.post('/register', 
  authLimiter,
  registerUser
);

router.post('/login', 
  authLimiter,
  loginUser
);

router.post('/refresh-token',
  authLimiter,
  refreshToken
);

// Protected routes
router.use(authenticateToken);
router.use(apiLimiter);

router.get('/profile', getUserDetails);
router.post('/logout', logout);

module.exports = router;