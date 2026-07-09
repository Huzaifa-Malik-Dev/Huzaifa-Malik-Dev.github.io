const { z } = require('zod');
const PayrollRun = require('../models/PayrollRun');
const PayrollLine = require('../models/PayrollLine');
const LedgerEntry = require('../models/LedgerEntry');
const User = require('../models/User');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const { computePayrollLines, processPayrollRun, deletePayrollRun } = require('../services/payroll');
const AppError = require('../utils/AppError');

// Real calendar month (01-12), not just any two digits - "2026-13" shouldn't pass.
const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
  .refine((v) => {
    const month = Number(v.slice(5, 7));
    return month >= 1 && month <= 12;
  }, 'month must be a real calendar month (01-12)');

// A payroll run pays salary for a month that has already happened - can't process (or usefully
// preview) one for a month still in the future.
function assertNotFutureMonth(month) {
  const current = new Date().toISOString().slice(0, 7);
  if (month > current) throw new AppError(`${month} hasn't happened yet - you can't process payroll for a future month`, 400);
}

async function preview(req, res, next) {
  try {
    const parsed = monthSchema.safeParse(req.query.month);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    assertNotFutureMonth(parsed.data);
    const { lines, totals } = await computePayrollLines(parsed.data);
    res.json({ data: { lines, totals } });
  } catch (err) {
    next(err);
  }
}

const processSchema = z.object({
  month: monthSchema,
  account: z.string().min(1),
});

async function process(req, res, next) {
  try {
    const parsed = processSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    assertNotFutureMonth(parsed.data.month);
    const run = await processPayrollRun(parsed.data.month, parsed.data.account, req.user._id);
    res.status(201).json({ data: run });
  } catch (err) {
    next(err);
  }
}

async function deleteRun(req, res, next) {
  try {
    const result = await deletePayrollRun(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function listRuns(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.search) filter.month = new RegExp(req.query.search.trim(), 'i');
    const [data, totalRowCount] = await Promise.all([
      PayrollRun.find(filter).populate('account', 'name').sort({ month: -1 }).skip(skip).limit(limit).lean(),
      PayrollRun.countDocuments(filter),
    ]);
    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function getRun(req, res, next) {
  try {
    const run = await PayrollRun.findById(req.params.id).populate('account', 'name').lean();
    if (!run) throw new AppError('Payroll run not found', 404);
    const lines = await PayrollLine.find({ payrollRun: run._id }).populate('employee', 'name employeeId desig').lean();
    res.json({ data: { run, lines } });
  } catch (err) {
    next(err);
  }
}

// ---- Employee Ledger ----

async function listLedger(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      const matchingEmployees = await User.find({ name: re }).select('_id').lean();
      filter.$or = [{ note: re }, { employee: { $in: matchingEmployees.map((u) => u._id) } }];
    }
    const [data, totalRowCount] = await Promise.all([
      LedgerEntry.find(filter).populate('employee', 'name employeeId').sort(sort).skip(skip).limit(limit).lean(),
      LedgerEntry.countDocuments(filter),
    ]);
    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

// Manually-creatable types. No installment concept - whichever type, the full amount is
// deducted in one shot on the employee's next payroll run. The system also auto-creates
// settled 'Deduction' rows when a run pays one of these off - those never come through here.
const ledgerSchema = z.object({
  employee: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(['Advance', 'Loan', 'Deduction']),
  amount: z.number().positive(),
  note: z.string().optional().default(''),
});

async function createLedgerEntry(req, res, next) {
  try {
    const parsed = ledgerSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const body = parsed.data;
    if (!(await User.exists({ _id: body.employee }))) throw new AppError('Employee not found', 404);

    const entry = await LedgerEntry.create({
      ...body,
      remaining: body.amount,
      status: 'Open',
      createdBy: req.user._id,
    });
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
}

module.exports = { preview, process, deleteRun, listRuns, getRun, listLedger, createLedgerEntry };
