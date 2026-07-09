const mongoose = require('mongoose');

const chequeSchema = new mongoose.Schema(
  {
    no: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    dueDate: { type: String, required: true },
    direction: { type: String, enum: ['Received', 'Issued'], required: true },
    party: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    status: { type: String, enum: ['Pending', 'Deposited', 'Cleared', 'Bounced'], default: 'Pending' },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

chequeSchema.index({ account: 1, dueDate: -1 });
chequeSchema.index({ status: 1 });

module.exports = mongoose.model('Cheque', chequeSchema);
