const mongoose = require('mongoose');

// Optional per-employee breakdown - only meaningful for category "Salaries", where one expense
// entry pays multiple employees in a single batch debited from one account (standard payroll
// journal-entry practice: one bank-account debit per pay run, not one per employee).
const breakdownLineSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ['Rent', 'Utilities', 'Salaries', 'Commission', 'Other'], required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    // Every expense (including salaries) must be paid from exactly one account.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    note: { type: String, default: '' },
    breakdown: [breakdownLineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ account: 1, date: -1 });
expenseSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
