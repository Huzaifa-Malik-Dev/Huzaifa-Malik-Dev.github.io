const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const {
  getPermissionsDoc,
  updateRolePermission,
  updateUserOverride,
  clearUserOverride,
  updateRoleImportExport,
  updateUserImportExportOverride,
  updateRoleAction,
  updateUserActionOverride,
} = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireModule('admin'));

router.get('/permissions', getPermissionsDoc);
router.patch('/permissions/role', requireModule('admin', { edit: true }), updateRolePermission);
router.patch('/permissions/user', requireModule('admin', { edit: true }), updateUserOverride);
router.delete('/permissions/user/:userId', requireModule('admin', { edit: true }), clearUserOverride);
router.patch('/permissions/role/import-export', requireModule('admin', { edit: true }), updateRoleImportExport);
router.patch('/permissions/user/import-export', requireModule('admin', { edit: true }), updateUserImportExportOverride);
router.patch('/permissions/role/action', requireModule('admin', { edit: true }), updateRoleAction);
router.patch('/permissions/user/action', requireModule('admin', { edit: true }), updateUserActionOverride);

module.exports = router;
