const Permission = require('../models/Permission');
const { ACCESS_DEFAULT, EDIT_ACCESS_DEFAULT, IMPORT_EXPORT_DEFAULT, ACTIONS_DEFAULT } = require('../utils/constants');

// In-memory cache of the single permissions doc — it's tiny and read on every request,
// so we keep it in memory and refresh it whenever an admin edits it (see setPermissions).
let cache = null;

async function loadPermissions() {
  let doc = await Permission.findById('access');
  if (!doc) {
    doc = await Permission.create({
      _id: 'access',
      byRole: ACCESS_DEFAULT,
      editByRole: EDIT_ACCESS_DEFAULT,
      importExportByRole: IMPORT_EXPORT_DEFAULT,
      actionsByRole: ACTIONS_DEFAULT,
      userOverrides: {},
    });
  }
  cache = doc.toObject();
  return cache;
}

function getPermissions() {
  return cache;
}

async function setPermissions(update) {
  const doc = await Permission.findByIdAndUpdate('access', update, { new: true, upsert: true });
  cache = doc.toObject();
  return cache;
}

function canView(user, moduleKey) {
  const perms = cache;
  if (!perms) return false;
  const override = perms.userOverrides?.[String(user._id)]?.view;
  const list = override || perms.byRole[user.role] || [];
  return list.includes(moduleKey);
}

function canEdit(user, moduleKey) {
  const perms = cache;
  if (!perms) return false;
  const override = perms.userOverrides?.[String(user._id)]?.edit;
  const list = override || perms.editByRole[user.role] || [];
  return list.includes(moduleKey);
}

function canImportExport(user, moduleKey) {
  const perms = cache;
  if (!perms) return false;
  const override = perms.userOverrides?.[String(user._id)]?.importExport;
  const list = override || perms.importExportByRole?.[user.role] || [];
  return list.includes(moduleKey);
}

function canDoAction(user, actionKey) {
  const perms = cache;
  if (!perms) return false;
  const override = perms.userOverrides?.[String(user._id)]?.actions;
  const list = override || perms.actionsByRole?.[user.role] || [];
  return list.includes(actionKey);
}

module.exports = { loadPermissions, getPermissions, setPermissions, canView, canEdit, canImportExport, canDoAction };
