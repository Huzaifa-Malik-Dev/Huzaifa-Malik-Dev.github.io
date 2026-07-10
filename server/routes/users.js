const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireRole, requireModule, requireAction, requireImportExport } = require('../middlewares/rbac');
const upload = require('../middlewares/upload');
const uploadZip = require('../middlewares/uploadZip');
const { list, getOne, getByEmployeeId, create, update, history, uploadDoc, exportEmployees, importEmployees, complianceSummary } = require('../controllers/userController');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'hr'));

router.get('/export', requireModule('hr'), requireImportExport('hr'), exportEmployees);
router.post('/import', requireModule('hr', { edit: true }), requireImportExport('hr'), uploadZip.single('file'), importEmployees);
router.get('/compliance-summary', requireModule('hr'), complianceSummary);
router.get('/', requireModule('hr'), list);
router.get('/by-employee-id/:employeeId', requireModule('hr'), getByEmployeeId);
router.get('/:id', requireModule('hr'), getOne);
router.get('/:id/history', requireModule('hr'), history);
router.post('/', requireModule('hr', { edit: true }), requireAction('hr.addEmployee'), create);
router.patch('/:id', requireModule('hr', { edit: true }), update);
router.post('/:id/upload/:field', requireModule('hr', { edit: true }), upload.single('file'), uploadDoc);

module.exports = router;
