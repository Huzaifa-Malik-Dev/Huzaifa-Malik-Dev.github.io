const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED_MIME = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

// Memory storage - the zip is read once via adm-zip and discarded, never needs to persist.
// Larger cap than uploadExcel since this bundles document images/PDFs alongside data.xlsx.
const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /\.zip$/i.test(file.originalname);
    if (!ALLOWED_MIME.includes(file.mimetype) && !okExt) {
      cb(new AppError('Only .zip files are allowed', 400));
      return;
    }
    cb(null, true);
  },
});

module.exports = uploadZip;
