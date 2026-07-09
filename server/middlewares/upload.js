const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadDir, uploadMaxKb } = require('../config/env');
const AppError = require('../utils/AppError');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', uploadDir)),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: uploadMaxKb * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new AppError('Only JPG, PNG, WEBP, or PDF files are allowed', 400));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
