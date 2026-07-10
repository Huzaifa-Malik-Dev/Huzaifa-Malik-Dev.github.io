const mongoose = require('mongoose');

// Target-achievement bracket -> commission rate (e.g. 90-99% achievement -> 15%), scoped to one
// employee - each commission-eligible employee has their own independent tier set, since
// different people can be on entirely different commission scales. Rows are mutable (add/edit/
// delete) - there's no versioning here because every PayrollLine snapshots the exact tier it
// applied at generation time, so editing/deleting a tier never touches an already-processed run.
// maxPct: null means "no upper bound" (e.g. "125%+").
const commissionTierSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    minPct: { type: Number, required: true, min: 0 },
    maxPct: { type: Number, default: null },
    rate: { type: Number, required: true, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

commissionTierSchema.index({ employee: 1, minPct: 1 });

module.exports = mongoose.model('CommissionTier', commissionTierSchema);
