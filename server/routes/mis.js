const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const { rollup, exportCsv, getAgentDetail } = require('../controllers/misController');

const router = express.Router();
router.use(requireAuth, requireModule('mis'));

router.get('/rollup', rollup);
router.get('/export', exportCsv);
router.get('/agent/:id', getAgentDetail);

module.exports = router;
