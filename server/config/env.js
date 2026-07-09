require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  port: parseInt(process.env.PORT || '5600', 10),
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  pageSizeDefault: parseInt(process.env.PAGE_SIZE_DEFAULT || '50', 10),
  pageSizeMax: parseInt(process.env.PAGE_SIZE_MAX || '200', 10),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  uploadMaxKb: parseInt(process.env.UPLOAD_MAX_KB || '800', 10),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
};
