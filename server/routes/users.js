const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireRole, requireModule, requireAction } = require('../middlewares/rbac');
const upload = require('../middlewares/upload');
const { list, getOne, create, update, history, uploadDoc } = require('../controllers/userController');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'hr'));

router.get('/', list);
router.get('/:id', getOne);
router.get('/:id/history', history);
router.post('/', requireModule('hr', { edit: true }), requireAction('hr.addEmployee'), create);
router.patch('/:id', requireModule('hr', { edit: true }), update);
router.post('/:id/upload/:field', requireModule('hr', { edit: true }), upload.single('file'), uploadDoc);

module.exports = router;
