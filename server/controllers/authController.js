const { z } = require('zod');
const User = require('../models/User');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { nodeEnv } = require('../config/env');
const AppError = require('../utils/AppError');
const { MODULES, IMPORT_EXPORT_MODULES, ACTION_KEYS } = require('../utils/constants');
const { canView, canEdit, canImportExport, canDoAction } = require('../services/permissions');

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: nodeEnv === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    role: user.role,
    desig: user.desig,
    dept: user.dept,
    reportsTo: user.reportsTo,
    modules: MODULES.filter((m) => canView(user, m)),
    editModules: MODULES.filter((m) => canEdit(user, m)),
    importExportModules: IMPORT_EXPORT_MODULES.filter((m) => canImportExport(user, m)),
    actions: ACTION_KEYS.filter((k) => canDoAction(user, k)),
  };
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('Username and password are required', 400);
    const { username, password } = parsed.data;

    const user = await User.findOne({ username: username.toLowerCase() });
    // Same error for missing user vs wrong password — do not leak which one was wrong.
    if (!user || !user.active) throw new AppError('Invalid username or password', 401);

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new AppError('Invalid username or password', 401);

    const token = signToken(user._id);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('token', { ...COOKIE_OPTS, maxAge: undefined });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me };
