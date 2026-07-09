const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpires } = require('../config/env');

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, jwtSecret, { expiresIn: jwtExpires });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { signToken, verifyToken };
