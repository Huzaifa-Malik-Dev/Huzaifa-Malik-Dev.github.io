const bcrypt = require('bcryptjs');
const { bcryptRounds } = require('../config/env');

function hashPassword(plain) {
  return bcrypt.hash(plain, bcryptRounds);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
