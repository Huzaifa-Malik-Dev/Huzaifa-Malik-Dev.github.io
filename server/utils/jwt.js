const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpires } = require('../config/env');

function signToken(userId, tokenVersion = 0) {
  return jwt.sign({ sub: String(userId), tv: tokenVersion }, jwtSecret, { expiresIn: jwtExpires });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { signToken, verifyToken };
