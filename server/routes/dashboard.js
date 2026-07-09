const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const { getSummary } = require('../controllers/dashboardController');

const router = express.Router();
router.use(requireAuth, requireModule('dash'));

router.get('/summary', getSummary);

module.exports = router;
