const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../utils/constants');

const historyEntrySchema = new mongoose.Schema(
  { ts: { type: Date, default: Date.now }, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true },
    dsrNo: { type: String, required: true },

    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tlId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teamHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    salesHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    subDate: { type: String, default: '' },
    contact: { type: String, default: '' },
    contactNo: { type: String, default: '' },
    email: { type: String, default: '' },
    customer: { type: String, required: true },
    pid: { type: String, default: '' },
    ord: { type: String, default: '' },
    eOrderNo: { type: String, default: '' },
    // Subscription type (NEW / MNP / MIG / ...) - free text, same reasoning as Pipeline.sr.
    sr: { type: String, default: 'NEW' },
    cat: { type: String, default: '' },
    product: { type: String, default: '' },
    contract: { type: String, default: '12 Months' },
    qty: { type: Number, default: 1 },
    mrc: { type: Number, default: 0 },
    eAcctMgr: { type: String, default: '' },
    status: { type: String, enum: ORDER_STATUS, default: 'New' },
    actDate: { type: String, default: '' },
    commission: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    history: [historyEntrySchema],
  },
  { timestamps: true }
);

orderSchema.index({ agentId: 1, createdAt: -1 });
orderSchema.index({ tlId: 1, status: 1, createdAt: -1 });
orderSchema.index({ teamHeadId: 1, createdAt: -1 });
orderSchema.index({ salesHeadId: 1, createdAt: -1 });
orderSchema.index({ pipelineId: 1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
