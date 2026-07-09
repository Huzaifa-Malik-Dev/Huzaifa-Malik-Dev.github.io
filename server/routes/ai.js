const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const { getReport } = require('../controllers/aiReportController');

const router = express.Router();
router.use(requireAuth, requireModule('ai'));

router.get('/report', getReport);

module.exports = router;
