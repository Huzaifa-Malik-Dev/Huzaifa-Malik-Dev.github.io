const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Verifies the httpOnly JWT cookie and attaches the full user doc to req.user.
// Token never touches client-side JS — read-only cookie set by /auth/login.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) throw new AppError('Not authenticated', 401);

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError('Session expired, please log in again', 401);
    }

    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user || !user.active) throw new AppError('Account not found or inactive', 401);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
