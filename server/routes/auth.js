const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, logout, me, updateProfile } = require('../controllers/authController');
const requireAuth = require('../middlewares/auth');
const { loginRateLimitWindowMin, loginRateLimitMax } = require('../config/env');

const router = express.Router();

// Tunable via .env (LOGIN_RATE_LIMIT_WINDOW_MIN / LOGIN_RATE_LIMIT_MAX) instead of a hardcoded
// value, so this can be loosened/tightened per deployment without a code change.
const loginLimiter = rateLimit({
  windowMs: loginRateLimitWindowMin * 60 * 1000,
  limit: loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

router.post('/login', loginLimiter, login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateProfile);

module.exports = router;
