const { z } = require('zod');
const { getPermissions, setPermissions } = require('../services/permissions');
const { MODULES, ROLES, IMPORT_EXPORT_MODULES, ACTIONS } = require('../utils/constants');
const AppError = require('../utils/AppError');

async function getPermissionsDoc(req, res, next) {
  try {
    const perms = getPermissions();
    res.json({ data: { ...perms, modules: MODULES, roles: ROLES, importExportModules: IMPORT_EXPORT_MODULES, actionDefs: ACTIONS } });
  } catch (err) {
    next(err);
  }
}

const levelSchema = z.enum(['none', 'view', 'edit']);
const moduleSchema = z.enum(MODULES);

// Adds/removes `module` from a view list and an edit list so the result matches `level`
// ('edit' implies 'view', same as every other view/edit gate in this app).
function applyLevel(viewList, editList, module, level) {
  const view = new Set(viewList || []);
  const edit = new Set(editList || []);
  if (level === 'none') {
    view.delete(module);
    edit.delete(module);
  } else if (level === 'view') {
    view.add(module);
    edit.delete(module);
  } else {
    view.add(module);
    edit.add(module);
  }
  return { view: [...view], edit: [...edit] };
}

// Guards against an admin editing their own way into a state where nobody (including them)
// can manage permissions anymore - the only recovery from that is direct DB surgery.
// `resultingEdit` is the edit-list this specific change would produce for the affected
// role/override; if that change is the one the acting user actually relies on for their own
// admin-module edit access, and it would drop 'admin' from it, we block the request.
function assertNotSelfLockout(req, { affectsRole, affectsUserId, resultingEdit }) {
  const actingUserId = String(req.user._id);
  const perms = getPermissions();
  const actingHasOwnOverride = !!perms.userOverrides?.[actingUserId];

  const changeAffectsActingUser =
    (affectsUserId && affectsUserId === actingUserId) ||
    (affectsRole && affectsRole === req.user.role && !actingHasOwnOverride);

  if (changeAffectsActingUser && !resultingEdit.includes('admin')) {
    throw new AppError('You cannot remove your own admin edit access - this would lock everyone out of managing permissions', 400);
  }
}

const roleUpdateSchema = z.object({
  role: z.enum(Object.keys(ROLES)),
  module: moduleSchema,
  level: levelSchema,
});

async function updateRolePermission(req, res, next) {
  try {
    const parsed = roleUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { role, module, level } = parsed.data;

    const perms = getPermissions();
    const { view, edit } = applyLevel(perms.byRole[role], perms.editByRole[role], module, level);

    if (module === 'admin') assertNotSelfLockout(req, { affectsRole: role, resultingEdit: edit });

    // Explicit $set on the dotted path - the safe, unambiguous way to update one key of a
    // Mixed-type field without touching the rest of the document.
    const updated = await setPermissions({
      $set: { [`byRole.${role}`]: view, [`editByRole.${role}`]: edit },
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

const importExportModuleSchema = z.enum(IMPORT_EXPORT_MODULES);

const roleImportExportSchema = z.object({
  role: z.enum(Object.keys(ROLES)),
  module: importExportModuleSchema,
  enabled: z.boolean(),
});

function toggleModule(list, moduleKey, enabled) {
  const set = new Set(list || []);
  if (enabled) set.add(moduleKey);
  else set.delete(moduleKey);
  return [...set];
}

async function updateRoleImportExport(req, res, next) {
  try {
    const parsed = roleImportExportSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { role, module, enabled } = parsed.data;

    const perms = getPermissions();
    const list = toggleModule(perms.importExportByRole?.[role], module, enabled);

    const updated = await setPermissions({ $set: { [`importExportByRole.${role}`]: list } });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

const userImportExportSchema = z.object({
  userId: z.string().min(1),
  module: importExportModuleSchema,
  enabled: z.boolean(),
  role: z.enum(Object.keys(ROLES)),
});

async function updateUserImportExportOverride(req, res, next) {
  try {
    const parsed = userImportExportSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { userId, module, enabled, role } = parsed.data;

    const perms = getPermissions();
    const existing = perms.userOverrides?.[userId];
    // Keep this user's existing view/edit/actions override (or their role default) intact - only
    // the importExport list changes here.
    const view = existing?.view ?? perms.byRole[role] ?? [];
    const edit = existing?.edit ?? perms.editByRole[role] ?? [];
    const actions = existing?.actions ?? perms.actionsByRole?.[role] ?? [];
    const baseImportExport = existing?.importExport ?? perms.importExportByRole?.[role] ?? [];
    const importExport = toggleModule(baseImportExport, module, enabled);

    const updated = await setPermissions({
      $set: { [`userOverrides.${userId}`]: { view, edit, importExport, actions } },
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

const actionSchema = z.enum(ACTIONS.map((a) => a.key));

const roleActionSchema = z.object({
  role: z.enum(Object.keys(ROLES)),
  action: actionSchema,
  enabled: z.boolean(),
});

async function updateRoleAction(req, res, next) {
  try {
    const parsed = roleActionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { role, action, enabled } = parsed.data;

    const perms = getPermissions();
    const list = toggleModule(perms.actionsByRole?.[role], action, enabled);

    const updated = await setPermissions({ $set: { [`actionsByRole.${role}`]: list } });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

const userActionSchema = z.object({
  userId: z.string().min(1),
  action: actionSchema,
  enabled: z.boolean(),
  role: z.enum(Object.keys(ROLES)),
});

async function updateUserActionOverride(req, res, next) {
  try {
    const parsed = userActionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { userId, action, enabled, role } = parsed.data;

    const perms = getPermissions();
    const existing = perms.userOverrides?.[userId];
    const view = existing?.view ?? perms.byRole[role] ?? [];
    const edit = existing?.edit ?? perms.editByRole[role] ?? [];
    const importExport = existing?.importExport ?? perms.importExportByRole?.[role] ?? [];
    const baseActions = existing?.actions ?? perms.actionsByRole?.[role] ?? [];
    const actions = toggleModule(baseActions, action, enabled);

    const updated = await setPermissions({
      $set: { [`userOverrides.${userId}`]: { view, edit, importExport, actions } },
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

const userUpdateSchema = z.object({
  userId: z.string().min(1),
  module: moduleSchema,
  level: levelSchema,
  role: z.enum(Object.keys(ROLES)), // the user's current role, to seed the override on first use
});

async function updateUserOverride(req, res, next) {
  try {
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { userId, module, level, role } = parsed.data;

    const perms = getPermissions();
    // First override for this person starts from their current role default, not from
    // scratch - so toggling one module doesn't silently strip every other module.
    const existing = perms.userOverrides?.[userId];
    const baseView = existing?.view ?? perms.byRole[role] ?? [];
    const baseEdit = existing?.edit ?? perms.editByRole[role] ?? [];
    const { view, edit } = applyLevel(baseView, baseEdit, module, level);
    // importExport/actions are separate axes (see updateUser*Override) — preserve whatever this
    // user already has instead of dropping them every time view/edit changes.
    const importExport = existing?.importExport ?? perms.importExportByRole?.[role] ?? [];
    const actions = existing?.actions ?? perms.actionsByRole?.[role] ?? [];

    if (module === 'admin') assertNotSelfLockout(req, { affectsUserId: userId, resultingEdit: edit });

    const updated = await setPermissions({
      $set: { [`userOverrides.${userId}`]: { view, edit, importExport, actions } },
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

async function clearUserOverride(req, res, next) {
  try {
    const { userId } = req.params;

    if (userId === String(req.user._id)) {
      const roleDefaultEdit = getPermissions().editByRole[req.user.role] || [];
      if (!roleDefaultEdit.includes('admin')) {
        throw new AppError('Resetting to your role default would remove your own admin edit access - blocked', 400);
      }
    }

    const updated = await setPermissions({ $unset: { [`userOverrides.${userId}`]: '' } });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPermissionsDoc,
  updateRolePermission,
  updateUserOverride,
  clearUserOverride,
  updateRoleImportExport,
  updateUserImportExportOverride,
  updateRoleAction,
  updateUserActionOverride,
};
