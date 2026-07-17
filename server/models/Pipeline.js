const mongoose = require('mongoose');
const { PIPE_STAGES, APPROVAL_STATUS } = require('../utils/constants');
const { lineItemBlockSchema } = require('./schemas/lineItem');

const historyEntrySchema = new mongoose.Schema(
  { ts: { type: Date, default: Date.now }, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String },
  { _id: false }
);

const pipelineSchema = new mongoose.Schema(
  {
    dsrId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dsr', required: true },
    dsrNo: { type: String, required: true },

    // Hierarchy stamped at creation time — same pattern as Dsr, keeps every rollup a single indexed match.
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tlId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teamHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    salesHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    company: { type: String, required: true },
    customer: { type: String, default: '' },
    email: { type: String, default: '' },
    contactNo: { type: String, default: '' },

    // One or more {Category, Product, Subscription Type} blocks, each with one or more
    // {price, qty} rows - see models/schemas/lineItem.js. Replaces the old flat
    // cat/product/sr/price/qty fields (one deal used to mean exactly one line item).
    lineItems: {
      type: [lineItemBlockSchema],
      default: () => [{ cat: '', product: '', sr: '', rows: [{ price: 0, qty: 1, mrc: 0 }], blockMrc: 0 }],
    },
    // Grand-total rollup across every block/row - always recomputed server-side, see utils/lineItems.js.
    mrc: { type: Number, default: 0 },
    annual: { type: Number, default: 0 },

    // Sales-progress stage - the primary lifecycle field, freely editable by the agent/TL.
    stage: { type: String, enum: PIPE_STAGES, default: '10%- Prospect' },
    // The optional TL sign-off workflow - independent of stage. See services/workflow.js.
    approval: { type: String, enum: APPROVAL_STATUS, default: 'none' },

    // Set once, at conversion/import time, to the date the deal entered the pipeline - never
    // client-editable afterward (see pipelineController.updateSchema, which omits this field).
    startedDate: { type: String, default: '' },
    expectedCloseDate: { type: String, default: '' },
    director: { type: String, default: '' },

    remarks: { type: String, default: '' },
    history: [historyEntrySchema],
  },
  { timestamps: true }
);

pipelineSchema.index({ agentId: 1, createdAt: -1 });
pipelineSchema.index({ tlId: 1, approval: 1, createdAt: -1 });
pipelineSchema.index({ stage: 1 });
pipelineSchema.index({ teamHeadId: 1, createdAt: -1 });
pipelineSchema.index({ salesHeadId: 1, createdAt: -1 });
pipelineSchema.index({ dsrId: 1 }, { unique: true });

module.exports = mongoose.model('Pipeline', pipelineSchema);
