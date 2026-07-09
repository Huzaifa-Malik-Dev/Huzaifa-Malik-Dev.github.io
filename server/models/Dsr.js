const mongoose = require('mongoose');
const { CALL_STATUS } = require('../utils/constants');

const historyEntrySchema = new mongoose.Schema(
  {
    ts: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
  },
  { _id: false }
);

const dsrSchema = new mongoose.Schema(
  {
    dsrNo: { type: String, required: true, unique: true },
    date: { type: String, required: true },

    // Hierarchy stamped at creation time — makes every rollup query (TL / Teams Head / Sales Head)
    // a single indexed match instead of a recursive tree walk. See services/hierarchy.js.
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tlId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teamHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    salesHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    company: { type: String, required: true, trim: true },
    building: { type: String, default: '' },
    contactNo: { type: String, required: true, trim: true },
    email: { type: String, default: '' },
    customer: { type: String, default: '' },
    status: { type: String, enum: CALL_STATUS, required: true },
    remarks: { type: String, default: '' },
    connected: { type: String, enum: ['YES', 'NO'], default: 'YES' },

    convertedToPipeline: { type: Boolean, default: false },
    history: [historyEntrySchema],
  },
  { timestamps: true }
);

dsrSchema.index({ agentId: 1, createdAt: -1 });
dsrSchema.index({ tlId: 1, status: 1, createdAt: -1 });
dsrSchema.index({ teamHeadId: 1, createdAt: -1 });
dsrSchema.index({ salesHeadId: 1, createdAt: -1 });
dsrSchema.index({ contactNo: 1 });
dsrSchema.index({ company: 1 });

module.exports = mongoose.model('Dsr', dsrSchema);
