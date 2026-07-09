const { z } = require('zod');
const User = require('../models/User');
const AssignmentHistory = require('../models/AssignmentHistory');
const { hashPassword } = require('../utils/password');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const { buildManagerChain, createInitialAssignment, reassignUser } = require('../services/hierarchy');
const { ROLES } = require('../utils/constants');
const AppError = require('../utils/AppError');
const { nextSeq } = require('../models/Counter');

const createSchema = z.object({
  name: z.string().trim().min(1),
  arabicName: z.string().optional().default(''),
  username: z.string().trim().min(3).toLowerCase(),
  password: z.string().min(6),
  role: z.enum(Object.keys(ROLES)),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  desig: z.string().optional().default(''),
  dept: z.string().optional().default(''),
  reportsTo: z.string().nullable().optional(),
  target: z.number().optional().default(0),
  salary: z.number().optional().default(0),
  join: z.string().optional().default(''),
});

const reassignSchema = z.object({
  role: z.enum(Object.keys(ROLES)).optional(),
  reportsTo: z.string().nullable().optional(),
});

const STATUS_VALUES = ['Active', 'Inactive', 'Frozen', 'Absconding'];

async function list(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ name: re }, { username: re }, { email: re }, { employeeId: re }];
    }

    const [data, totalRowCount] = await Promise.all([
      User.find(filter).select('-passwordHash').sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!user) throw new AppError('User not found', 404);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const body = parsed.data;

    const exists = await User.findOne({ username: body.username });
    if (exists) throw new AppError('Username already taken', 409);

    const passwordHash = await hashPassword(body.password);
    const managerChain = body.reportsTo ? await buildManagerChain(body.reportsTo) : [];
    const employeeId = 'DC' + (await nextSeq('employee'));

    const user = await User.create({
      ...body,
      employeeId,
      passwordHash,
      managerChain,
    });

    await createInitialAssignment(user, req.user._id);

    const { passwordHash: _drop, ...safe } = user.toObject();
    res.status(201).json({ data: safe });
  } catch (err) {
    next(err);
  }
}

// Role/manager changes go through reassignUser so AssignmentHistory stays correct.
// Other profile fields (name, desig, salary, compliance, etc.) are plain field updates.
async function update(req, res, next) {
  try {
    const { role, reportsTo, password, ...rest } = req.body;
    const isSelf = String(req.params.id) === String(req.user._id);

    // Nobody can revoke their own access — a demoted/deactivated self could lock the
    // system out of having anyone left to fix it. Someone else (another admin/HR) must do it.
    if (isSelf) {
      if (role !== undefined && role !== req.user.role) {
        throw new AppError('You cannot change your own role - ask another admin or HR to do it', 403);
      }
      if (rest.status !== undefined && rest.status !== 'Active') {
        throw new AppError('You cannot change your own status - ask another admin or HR to do it', 403);
      }
      if (rest.active === false) {
        throw new AppError('You cannot deactivate your own account', 403);
      }
    }

    if (rest.status !== undefined && !STATUS_VALUES.includes(rest.status)) {
      throw new AppError('Invalid status', 400);
    }

    if (role !== undefined || reportsTo !== undefined) {
      const parsed = reassignSchema.safeParse({ role, reportsTo });
      if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
      await reassignUser(req.params.id, parsed.data, req.user._id);
    }

    if (password) rest.passwordHash = await hashPassword(password);
    // status is the source of truth; active is a derived flag every rollup/login-gate already reads.
    if (rest.status !== undefined) rest.active = rest.status === 'Active';

    const user = await User.findByIdAndUpdate(req.params.id, rest, { new: true }).select('-passwordHash');
    if (!user) throw new AppError('User not found', 404);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

const UPLOAD_DOC_FIELDS = [
  'profilePic',
  'passportImgF',
  'passportImgB',
  'visaImgF',
  'visaImgB',
  'eidImgF',
  'eidImgB',
  'labourCardImg',
  'insuranceImgF',
  'insuranceImgB',
];

async function uploadDoc(req, res, next) {
  try {
    const { field } = req.params;
    if (!UPLOAD_DOC_FIELDS.includes(field)) throw new AppError('Unknown document field', 400);
    if (!req.file) throw new AppError('No file uploaded', 400);

    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);

    user.docs[field] = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ data: { field, path: user.docs[field] } });
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const rows = await AssignmentHistory.find({ userId: req.params.id })
      .sort({ startDate: -1 })
      .populate('reportsTo', 'name role')
      .populate('changedBy', 'name')
      .lean();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, history, uploadDoc };
