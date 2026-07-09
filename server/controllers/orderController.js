const { z } = require('zod');
const Order = require('../models/Order');
const User = require('../models/User');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const { updateOrderStatus } = require('../services/workflow');
const { ORDER_STATUS } = require('../utils/constants');
const { sendXlsx, parseXlsxBuffer, cell } = require('../utils/importExport');
const AppError = require('../utils/AppError');

const statusSchema = z.object({
  status: z.enum(ORDER_STATUS),
  eOrderNo: z.string().optional(),
  actDate: z.string().optional(),
  remarks: z.string().optional(),
});

const updateSchema = z.object({
  subDate: z.string().optional(),
  contact: z.string().optional(),
  contactNo: z.string().optional(),
  email: z.string().optional(),
  pid: z.string().optional(),
  ord: z.string().optional(),
  eOrderNo: z.string().optional(),
  sr: z.string().optional(),
  cat: z.string().optional(),
  product: z.string().optional(),
  contract: z.string().optional(),
  qty: z.number().min(1).optional(),
  mrc: z.number().min(0).optional(),
  eAcctMgr: z.string().optional(),
  actDate: z.string().optional(),
  commission: z.number().min(0).optional(),
  remarks: z.string().optional(),
});

function scopeFilter(user) {
  if (user.role === 'admin' || user.role === 'backoffice') return {};
  if (user.role === 'agent') return { agentId: user._id };
  return {
    $or: [{ tlId: user._id }, { teamHeadId: user._id }, { salesHeadId: user._id }, { agentId: user._id }],
  };
}

async function list(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = { ...scopeFilter(req.user) };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      const matchingAgents = await User.find({ name: re }).select('_id').lean();
      filter.$and = [
        {
          $or: [
            { dsrNo: re }, { customer: re }, { contact: re }, { contactNo: re }, { eOrderNo: re }, { ord: re }, { pid: re }, { product: re },
            { agentId: { $in: matchingAgents.map((u) => u._id) } },
          ],
        },
      ];
    }

    const [data, totalRowCount] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit).populate('agentId', 'name').lean(),
      Order.countDocuments(filter),
    ]);
    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { status, ...extra } = parsed.data;
    const order = await updateOrderStatus(req.params.id, status, req.user, extra);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const allowed = req.user.role === 'admin' || req.user.role === 'backoffice';
    if (!allowed) throw new AppError('Only Back Office can edit orders', 403);

    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError('Order not found', 404);

    Object.assign(order, parsed.data);
    order.history.push({ userId: req.user._id, text: 'Order details edited' });
    await order.save();

    res.json({ data: order });
  } catch (err) {
    next(err);
  }
}

const EXPORT_COLUMNS = [
  { header: 'DSR No', key: 'dsrNo' },
  { header: 'Submission Date', key: 'subDate' },
  { header: 'Contact', key: 'contact' },
  { header: 'Contact No', key: 'contactNo' },
  { header: 'Email', key: 'email' },
  { header: 'Customer', key: 'customer' },
  { header: 'PID', key: 'pid' },
  { header: 'Order No', key: 'ord' },
  { header: 'e& Order No', key: 'eOrderNo' },
  { header: 'SR', key: 'sr' },
  { header: 'Category', key: 'cat' },
  { header: 'Product', key: 'product' },
  { header: 'Contract', key: 'contract' },
  { header: 'Qty', key: 'qty' },
  { header: 'MRC', key: 'mrc' },
  { header: 'e& Account Manager', key: 'eAcctMgr' },
  { header: 'Status', key: 'status' },
  { header: 'Activation Date', key: 'actDate' },
  { header: 'Commission', key: 'commission' },
  { header: 'Remarks', key: 'remarks' },
  { header: 'Agent', get: (r) => r.agentId?.name || '' },
];

async function exportOrders(req, res, next) {
  try {
    const filter = { ...scopeFilter(req.user) };
    if (req.query.status) filter.status = req.query.status;
    const rows = await Order.find(filter).sort({ createdAt: -1 }).populate('agentId', 'name').lean();
    sendXlsx(res, `orders-export-${Date.now()}.xlsx`, rows, EXPORT_COLUMNS, 'Orders');
  } catch (err) {
    next(err);
  }
}

// Orders can't be created out of thin air on import — every order is tied to a Pipeline deal
// that opened it (see services/workflow.js ensureOrderForPipeline). So import here is an UPDATE
// of Back Office fulfillment fields on an *existing* order, matched by its DSR No — this mirrors
// how Back Office actually works from their tracker (fill in PID/order no./commission etc. for
// deals that already came through), not how new orders get created.
const importRowSchema = z.object({
  dsrNo: z.string().trim().min(1, 'DSR No is required'),
  subDate: z.string().optional(),
  contact: z.string().optional(),
  contactNo: z.string().optional(),
  email: z.string().optional(),
  pid: z.string().optional(),
  ord: z.string().optional(),
  eOrderNo: z.string().optional(),
  sr: z.string().optional(),
  cat: z.string().optional(),
  product: z.string().optional(),
  contract: z.string().optional(),
  qty: z.number().min(1).optional(),
  mrc: z.number().min(0).optional(),
  eAcctMgr: z.string().optional(),
  status: z.enum(ORDER_STATUS).optional(),
  actDate: z.string().optional(),
  commission: z.number().min(0).optional(),
  remarks: z.string().optional(),
});

function numOrUndefined(v) {
  return v === '' ? undefined : Number(v);
}

async function importOrders(req, res, next) {
  try {
    const allowed = req.user.role === 'admin' || req.user.role === 'backoffice';
    if (!allowed) throw new AppError('Only Back Office can import orders', 403);

    if (!req.file) throw new AppError('No file uploaded', 400);
    const rawRows = parseXlsxBuffer(req.file.buffer);
    if (!rawRows.length) throw new AppError('The file has no data rows', 400);

    const errors = [];
    let updated = 0;

    for (let i = 0; i < rawRows.length; i += 1) {
      const raw = rawRows[i];
      const rowNum = i + 2;
      try {
        const candidate = {
          dsrNo: cell(raw, 'DSR No'),
          subDate: cell(raw, 'Submission Date'),
          contact: cell(raw, 'Contact'),
          contactNo: cell(raw, 'Contact No'),
          email: cell(raw, 'Email'),
          pid: cell(raw, 'PID'),
          ord: cell(raw, 'Order No'),
          eOrderNo: cell(raw, 'e& Order No'),
          sr: cell(raw, 'SR'),
          cat: cell(raw, 'Category'),
          product: cell(raw, 'Product'),
          contract: cell(raw, 'Contract'),
          qty: numOrUndefined(cell(raw, 'Qty')),
          mrc: numOrUndefined(cell(raw, 'MRC')),
          eAcctMgr: cell(raw, 'e& Account Manager'),
          status: cell(raw, 'Status') || undefined,
          actDate: cell(raw, 'Activation Date'),
          commission: numOrUndefined(cell(raw, 'Commission')),
          remarks: cell(raw, 'Remarks'),
        };
        const parsed = importRowSchema.safeParse(candidate);
        if (!parsed.success) {
          errors.push({ row: rowNum, message: parsed.error.issues[0].message });
          continue;
        }
        const { dsrNo, ...fields } = parsed.data;
        Object.keys(fields).forEach((k) => fields[k] === '' && delete fields[k]);

        const order = await Order.findOne({ dsrNo });
        if (!order) {
          errors.push({ row: rowNum, message: `No existing order found for DSR No "${dsrNo}" — orders are opened from Pipeline, not created by import` });
          continue;
        }

        Object.assign(order, fields);
        order.history.push({ userId: req.user._id, text: 'Order details updated via spreadsheet import' });
        await order.save();
        updated += 1;
      } catch (rowErr) {
        errors.push({ row: rowNum, message: rowErr.message || 'Unexpected error' });
      }
    }

    res.json({ data: { total: rawRows.length, updated, failed: errors.length, errors } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, updateStatus, update, exportOrders, importOrders };
