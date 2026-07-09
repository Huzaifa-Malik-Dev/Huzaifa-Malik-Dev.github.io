const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadDir, uploadMaxKb } = require('../config/env');
const AppError = require('../utils/AppError');

// Maps each accepted mimetype to the extension it's stored as — the stored filename is derived
// from the (server-trusted) mimetype, never from the client-supplied original filename/extension,
// so a mismatched pair (e.g. an .html file relabeled image/jpeg) can't get an executable
// extension onto disk under the public /uploads mount.
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', uploadDir)),
  filename: (req, file, cb) => {
    const ext = MIME_EXT[file.mimetype] || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: uploadMaxKb * 1024 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXT[file.mimetype]) {
      cb(new AppError('Only JPG, PNG, WEBP, or PDF files are allowed', 400));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
