const mongoose = require('mongoose');

const payrollLineSchema = new mongoose.Schema(
  {
    payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    basic: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    gratuityAccrual: { type: Number, default: 0 },
    // ledger deduction entries settled by this line, for traceability
    ledgerEntries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry' }],
  },
  { timestamps: true }
);

payrollLineSchema.index({ payrollRun: 1 });
payrollLineSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('PayrollLine', payrollLineSchema);
