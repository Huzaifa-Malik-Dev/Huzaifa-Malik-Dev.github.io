const { nodeEnv } = require('../config/env');

// Multer throws a bare MulterError (no statusCode) when a file trips its `limits` config — without
// this it falls through to the generic 500 branch below with a confusing "File too large" message
// under an Internal Server Error status. Normalized to a proper 400 with clearer copy instead.
function normalizeMulterError(err) {
  if (err.name !== 'MulterError') return err;
  if (err.code === 'LIMIT_FILE_SIZE') {
    const normalized = new Error('File is too large for this upload — please choose a smaller file.');
    normalized.statusCode = 400;
    return normalized;
  }
  const normalized = new Error(err.message || 'File upload failed');
  normalized.statusCode = 400;
  return normalized;
}

// Centralized fallback — routes still try/catch and call next(err); this formats the response.
function errorHandler(rawErr, req, res, next) {
  const err = normalizeMulterError(rawErr);
  console.error(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
