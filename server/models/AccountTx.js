const mongoose = require('mongoose');

const accountTxSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    date: { type: String, required: true },
    // amount is signed: positive = money in, negative = money out. Running balance = opening + sum(amount).
    type: { type: String, enum: ['Deposit', 'Withdrawal', 'Expense', 'Cheque Clearance'], required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    // refType/refId point back at the record that generated this tx (Expense/Cheque), if any.
    // Manual deposits/withdrawals from Record Transaction have no ref.
    refType: { type: String, enum: ['Expense', 'Cheque', ''], default: '' },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

accountTxSchema.index({ account: 1, date: -1 });

module.exports = mongoose.model('AccountTx', accountTxSchema);
