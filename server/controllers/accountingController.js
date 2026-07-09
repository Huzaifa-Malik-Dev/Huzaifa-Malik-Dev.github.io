const { z } = require('zod');
const Account = require('../models/Account');
const AccountTx = require('../models/AccountTx');
const Expense = require('../models/Expense');
const Cheque = require('../models/Cheque');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const { accountBalance, postAccountTx } = require('../services/accounting');
const AppError = require('../utils/AppError');

const accountSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['Bank', 'Cash']),
  opening: z.number().optional().default(0),
});

const txSchema = z.object({
  account: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(['Deposit', 'Withdrawal']),
  amount: z.number().positive(),
  note: z.string().optional().default(''),
});

const expenseSchema = z.object({
  category: z.enum(['Rent', 'Utilities', 'Salaries', 'Commission', 'Other']),
  amount: z.number().positive(),
  date: z.string().min(1),
  account: z.string().min(1),
  note: z.string().optional().default(''),
  breakdown: z
    .array(z.object({ employee: z.string().min(1), amount: z.number().positive(), note: z.string().optional().default('') }))
    .optional()
    .default([]),
});

const chequeSchema = z.object({
  no: z.string().trim().min(1),
  date: z.string().min(1),
  dueDate: z.string().min(1),
  direction: z.enum(['Received', 'Issued']),
  party: z.string().trim().min(1),
  amount: z.number().positive(),
  account: z.string().min(1),
  note: z.string().optional().default(''),
});

// ---- Chart of Accounts ----

async function listAccounts(req, res, next) {
  try {
    const accounts = await Account.find().sort({ createdAt: 1 }).lean();
    const withBalance = await Promise.all(
      accounts.map(async (a) => ({ ...a, balance: await accountBalance(a._id) }))
    );
    res.json({ data: withBalance });
  } catch (err) {
    next(err);
  }
}

async function createAccount(req, res, next) {
  try {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const account = await Account.create({ ...parsed.data, createdBy: req.user._id });
    res.status(201).json({ data: account });
  } catch (err) {
    next(err);
  }
}

async function updateAccount(req, res, next) {
  try {
    const parsed = accountSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const account = await Account.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
    if (!account) throw new AppError('Account not found', 404);
    res.json({ data: account });
  } catch (err) {
    next(err);
  }
}

async function accountTransactions(req, res, next) {
  try {
    const account = await Account.findById(req.params.id).lean();
    if (!account) throw new AppError('Account not found', 404);
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { account: req.params.id };
    const [data, totalRowCount] = await Promise.all([
      AccountTx.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      AccountTx.countDocuments(filter),
    ]);
    res.json({ ...buildPageResponse(data, totalRowCount, page, limit), account: { ...account, balance: await accountBalance(account._id) } });
  } catch (err) {
    next(err);
  }
}

async function recordTransaction(req, res, next) {
  try {
    const parsed = txSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { account, date, type, amount, note } = parsed.data;
    if (!(await Account.exists({ _id: account }))) throw new AppError('Account not found', 404);

    const signed = type === 'Withdrawal' ? -amount : amount;
    const tx = await postAccountTx({ account, date, type, amount: signed, note, createdBy: req.user._id });
    res.status(201).json({ data: tx });
  } catch (err) {
    next(err);
  }
}

// ---- Company Expenses (every expense, including salaries, debits exactly one account) ----

async function listExpenses(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.account) filter.account = req.query.account;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      filter.note = re;
    }
    const [data, totalRowCount] = await Promise.all([
      Expense.find(filter).populate('account', 'name type').populate('breakdown.employee', 'name').sort(sort).skip(skip).limit(limit).lean(),
      Expense.countDocuments(filter),
    ]);
    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const body = parsed.data;

    if (!(await Account.exists({ _id: body.account }))) throw new AppError('Account not found', 404);
    if (body.breakdown.length) {
      const breakdownTotal = body.breakdown.reduce((sum, line) => sum + line.amount, 0);
      if (Math.abs(breakdownTotal - body.amount) > 0.01) {
        throw new AppError('Breakdown amounts must add up to the total expense amount', 400);
      }
    }

    const expense = await Expense.create({ ...body, createdBy: req.user._id });
    await postAccountTx({
      account: body.account,
      date: body.date,
      type: 'Expense',
      amount: -body.amount,
      note: `${body.category}${body.note ? ' - ' + body.note : ''}`,
      refType: 'Expense',
      refId: expense._id,
      createdBy: req.user._id,
    });

    res.status(201).json({ data: expense });
  } catch (err) {
    next(err);
  }
}

// ---- Cheques (PDC) ----

async function listCheques(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};
    if (req.query.account) filter.account = req.query.account;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ no: re }, { party: re }, { note: re }];
    }
    const [data, totalRowCount] = await Promise.all([
      Cheque.find(filter).populate('account', 'name type').sort(sort).skip(skip).limit(limit).lean(),
      Cheque.countDocuments(filter),
    ]);
    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function createCheque(req, res, next) {
  try {
    const parsed = chequeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    if (!(await Account.exists({ _id: parsed.data.account }))) throw new AppError('Account not found', 404);
    const cheque = await Cheque.create({ ...parsed.data, createdBy: req.user._id });
    res.status(201).json({ data: cheque });
  } catch (err) {
    next(err);
  }
}

async function updateCheque(req, res, next) {
  try {
    const parsed = chequeSchema.partial().safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const cheque = await Cheque.findById(req.params.id);
    if (!cheque) throw new AppError('Cheque not found', 404);
    if (['Cleared', 'Bounced'].includes(cheque.status)) throw new AppError('Cannot edit a cleared or bounced cheque', 400);
    Object.assign(cheque, parsed.data);
    await cheque.save();
    res.json({ data: cheque });
  } catch (err) {
    next(err);
  }
}

const STATUS_TRANSITIONS = {
  Pending: ['Deposited', 'Bounced'],
  Deposited: ['Cleared', 'Bounced'],
  Cleared: [],
  Bounced: [],
};

async function updateChequeStatus(req, res, next) {
  try {
    const status = req.body.status;
    if (!['Pending', 'Deposited', 'Cleared', 'Bounced'].includes(status)) throw new AppError('Invalid status', 400);
    const cheque = await Cheque.findById(req.params.id);
    if (!cheque) throw new AppError('Cheque not found', 404);
    if (!STATUS_TRANSITIONS[cheque.status].includes(status)) {
      throw new AppError(`Cannot move a ${cheque.status} cheque to ${status}`, 400);
    }

    cheque.status = status;
    await cheque.save();

    if (status === 'Cleared') {
      const signed = cheque.direction === 'Received' ? cheque.amount : -cheque.amount;
      await postAccountTx({
        account: cheque.account,
        date: new Date().toISOString().slice(0, 10),
        type: 'Cheque Clearance',
        amount: signed,
        note: `Cheque ${cheque.no} (${cheque.party}) cleared`,
        refType: 'Cheque',
        refId: cheque._id,
        createdBy: req.user._id,
      });
    }

    res.json({ data: cheque });
  } catch (err) {
    next(err);
  }
}

// ---- Summary KPIs ----

async function summary(req, res, next) {
  try {
    const accounts = await Account.find().lean();
    const totalCash = (
      await Promise.all(accounts.map((a) => accountBalance(a._id)))
    ).reduce((sum, b) => sum + b, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const expensesThisMonth = await Expense.find({ date: { $gte: monthStartStr } }).select('amount').lean();
    const totalExpensesThisMonth = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);

    const pendingCheques = await Cheque.countDocuments({ status: { $in: ['Pending', 'Deposited'] } });
    const bouncedCheques = await Cheque.countDocuments({ status: 'Bounced' });

    res.json({
      data: {
        totalCash,
        accountsCount: accounts.length,
        totalExpensesThisMonth,
        pendingCheques,
        bouncedCheques,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  accountTransactions,
  recordTransaction,
  listExpenses,
  createExpense,
  listCheques,
  createCheque,
  updateCheque,
  updateChequeStatus,
  summary,
};
