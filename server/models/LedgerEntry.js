const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    type: { type: String, enum: ['Advance', 'Loan', 'Deduction'], required: true },
    amount: { type: Number, required: true },
    // No installment concept - an Open entry's full remaining balance is auto-deducted on
    // the employee's next payroll run, then the entry is settled.
    remaining: { type: Number, default: 0 },
    status: { type: String, enum: ['Open', 'Settled'], default: 'Open' },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // set on auto-generated Deduction rows, pointing back at the Advance/Loan they paid down
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ employee: 1, date: -1 });
ledgerEntrySchema.index({ status: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
