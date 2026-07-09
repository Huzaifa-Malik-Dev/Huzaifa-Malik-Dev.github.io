const AppError = require('../utils/AppError');
const { canView, canEdit, canImportExport, canDoAction } = require('../services/permissions');

// requireModule('dsr') gates by view access; requireModule('dsr', { edit: true }) gates by edit access.
// The client hides buttons for UX only — this is the actual enforcement.
function requireModule(moduleKey, { edit = false } = {}) {
  return (req, res, next) => {
    try {
      const allowed = edit ? canEdit(req.user, moduleKey) : canView(req.user, moduleKey);
      if (!allowed) throw new AppError('You do not have access to this module', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Separate axis from view/edit — bulk import/export moves a lot of data at once, so it must be
// explicitly granted per module even to someone who can already view/edit records one at a time.
function requireImportExport(moduleKey) {
  return (req, res, next) => {
    try {
      if (!canImportExport(req.user, moduleKey)) throw new AppError('You do not have Import/Export access to this module', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    try {
      if (!roles.includes(req.user.role)) throw new AppError('Insufficient role', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// requireAction('payroll.process') gates a specific dangerous/restricted action, independent of
// whether the user can otherwise view/edit that module.
function requireAction(actionKey) {
  return (req, res, next) => {
    try {
      if (!canDoAction(req.user, actionKey)) throw new AppError('You do not have permission to do this', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireModule, requireImportExport, requireAction, requireRole };
