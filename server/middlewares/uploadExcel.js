const multer = require('multer');
const AppError = require('../utils/AppError');

const ALLOWED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

// Memory storage, not disk - the file is parsed once into rows and discarded, never needs to
// persist. Small size cap keeps parsing (and the known SheetJS ReDoS advisory) low-risk since
// only admin-granted Import/Export users can hit this at all (see middlewares/rbac.js).
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (!ALLOWED_MIME.includes(file.mimetype) && !okExt) {
      cb(new AppError('Only .xlsx, .xls, or .csv files are allowed', 400));
      return;
    }
    cb(null, true);
  },
});

module.exports = uploadExcel;
