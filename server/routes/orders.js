const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule, requireImportExport } = require('../middlewares/rbac');
const uploadExcel = require('../middlewares/uploadExcel');
const { list, updateStatus, update, exportOrders, importOrders } = require('../controllers/orderController');

const router = express.Router();
router.use(requireAuth, requireModule('backoffice'));

router.get('/export', requireImportExport('backoffice'), exportOrders);
router.post('/import', requireImportExport('backoffice'), uploadExcel.single('file'), importOrders);
router.get('/', list);
router.patch('/:id/status', requireModule('backoffice', { edit: true }), updateStatus);
router.patch('/:id', requireModule('backoffice', { edit: true }), update);

module.exports = router;
