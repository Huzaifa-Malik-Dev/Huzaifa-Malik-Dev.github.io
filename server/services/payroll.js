const User = require('../models/User');
const Order = require('../models/Order');
const LedgerEntry = require('../models/LedgerEntry');
const PayrollRun = require('../models/PayrollRun');
const PayrollLine = require('../models/PayrollLine');
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const AccountTx = require('../models/AccountTx');
const { postAccountTx } = require('./accounting');
const AppError = require('../utils/AppError');

// Pure computation, no writes - used for both the preview endpoint and as the first
// step of processing a run. Basic/allowance split and gratuity accrual formula match
// the original prototype (simplified estimates, not a certified UAE gratuity calculation).
async function computePayrollLines(month) {
  const employees = await User.find({ active: true, salary: { $gt: 0 } }).lean();
  const monthPrefix = month; // 'YYYY-MM'

  const lines = [];
  for (const emp of employees) {
    const basic = Math.round(emp.salary * 0.6);
    const allowance = emp.salary - basic;

    const commissionOrders = await Order.find({
      agentId: emp._id,
      status: { $in: ['Activated', 'Closed'] },
      actDate: { $regex: '^' + monthPrefix },
    })
      .select('commission')
      .lean();
    const commission = commissionOrders.reduce((sum, o) => sum + o.commission, 0);

    const openLedger = await LedgerEntry.find({
      employee: emp._id,
      type: { $in: ['Advance', 'Loan', 'Deduction'] },
      status: 'Open',
    }).lean();
    let deductions = 0;
    const ledgerLines = [];
    for (const entry of openLedger) {
      const amount = entry.remaining;
      if (amount <= 0) continue;
      deductions += amount;
      ledgerLines.push({ entryId: entry._id, amount });
    }

    const gratuityAccrual = Math.round((basic / 30) * 21 / 12);
    const netPay = basic + allowance + commission - deductions;

    lines.push({
      employee: { _id: emp._id, name: emp.name, employeeId: emp.employeeId, desig: emp.desig },
      basic,
      allowance,
      commission,
      deductions,
      netPay,
      gratuityAccrual,
      ledgerLines,
    });
  }

  const totals = lines.reduce(
    (acc, l) => ({
      totalBasic: acc.totalBasic + l.basic,
      totalAllowance: acc.totalAllowance + l.allowance,
      totalCommission: acc.totalCommission + l.commission,
      totalDeductions: acc.totalDeductions + l.deductions,
      totalNet: acc.totalNet + l.netPay,
      totalGratuityAccrual: acc.totalGratuityAccrual + l.gratuityAccrual,
    }),
    { totalBasic: 0, totalAllowance: 0, totalCommission: 0, totalDeductions: 0, totalNet: 0, totalGratuityAccrual: 0 }
  );

  return { lines, totals };
}

// Commits a run: creates PayrollRun + PayrollLines, settles ledger deductions, and posts
// ONE Expense (category Salaries) debiting the chosen account - same "every expense
// including salaries comes from one account" rule the Accounting module already enforces.
async function processPayrollRun(month, accountId, userId) {
  if (!(await Account.exists({ _id: accountId }))) throw new AppError('Account not found', 404);

  const { lines, totals } = await computePayrollLines(month);
  if (!lines.length) throw new AppError('No active salaried employees to pay', 400);

  // Atomically claim this month BEFORE any side-effecting writes — the unique index on `month`
  // means only one concurrent request can create this doc, so a race can never produce
  // duplicate Expense/AccountTx/PayrollLine rows for the same month.
  let run;
  try {
    run = await PayrollRun.create({ month, account: accountId, expense: null, ...totals, processedBy: userId });
  } catch (err) {
    if (err.code === 11000) throw new AppError(`Payroll for ${month} has already been processed`, 409);
    throw err;
  }

  try {
    const expense = await Expense.create({
      category: 'Salaries',
      amount: totals.totalNet,
      date: new Date().toISOString().slice(0, 10),
      account: accountId,
      note: `Payroll run - ${month}`,
      breakdown: lines.map((l) => ({ employee: l.employee._id, amount: l.netPay, note: `${month} salary` })),
      createdBy: userId,
    });
    await postAccountTx({
      account: accountId,
      date: new Date().toISOString().slice(0, 10),
      type: 'Expense',
      amount: -totals.totalNet,
      note: `Salaries - Payroll run ${month}`,
      refType: 'Expense',
      refId: expense._id,
      createdBy: userId,
    });
    run.expense = expense._id;
    await run.save();

    for (const l of lines) {
      const settledEntryIds = [];
      for (const ledgerLine of l.ledgerLines) {
        const entry = await LedgerEntry.findById(ledgerLine.entryId);
        if (!entry) continue;
        entry.remaining -= ledgerLine.amount;
        if (entry.remaining <= 0) {
          entry.remaining = 0;
          entry.status = 'Settled';
        }
        await entry.save();

        const deduction = await LedgerEntry.create({
          employee: l.employee._id,
          date: new Date().toISOString().slice(0, 10),
          type: 'Deduction',
          amount: ledgerLine.amount,
          status: 'Settled',
          note: `Payroll deduction - ${month}`,
          createdBy: userId,
          parent: entry._id,
        });
        settledEntryIds.push(deduction._id);
      }

      await PayrollLine.create({
        payrollRun: run._id,
        employee: l.employee._id,
        basic: l.basic,
        allowance: l.allowance,
        commission: l.commission,
        deductions: l.deductions,
        netPay: l.netPay,
        gratuityAccrual: l.gratuityAccrual,
        ledgerEntries: settledEntryIds,
      });
    }

    return run;
  } catch (err) {
    // Something failed after the claim — release the month rather than leaving it permanently
    // locked by a run stuck in a half-finished state.
    await PayrollRun.deleteOne({ _id: run._id });
    throw err;
  }
}

// Fully undoes a processed run: restores every ledger entry it settled, deletes the auto-created
// Deduction rows, deletes the Expense + the AccountTx it posted (so the account balance goes back
// to what it was before), then deletes the run's lines and the run itself. Nothing is "reversed
// with an offsetting entry" here — the user asked to delete a mistaken run outright.
async function deletePayrollRun(runId) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw new AppError('Payroll run not found', 404);

  const lines = await PayrollLine.find({ payrollRun: run._id });
  for (const line of lines) {
    for (const deductionId of line.ledgerEntries) {
      const deduction = await LedgerEntry.findById(deductionId);
      if (!deduction || deduction.type !== 'Deduction' || !deduction.parent) continue;
      const original = await LedgerEntry.findById(deduction.parent);
      if (original) {
        original.remaining += deduction.amount;
        original.status = 'Open';
        await original.save();
      }
      await LedgerEntry.deleteOne({ _id: deduction._id });
    }
  }
  await PayrollLine.deleteMany({ payrollRun: run._id });

  if (run.expense) {
    await AccountTx.deleteMany({ refType: 'Expense', refId: run.expense });
    await Expense.deleteOne({ _id: run.expense });
  }

  await PayrollRun.deleteOne({ _id: run._id });
  return { month: run.month };
}

module.exports = { computePayrollLines, processPayrollRun, deletePayrollRun };
