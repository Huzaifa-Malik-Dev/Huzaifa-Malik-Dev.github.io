const mongoose = require('mongoose');
const { ROLES } = require('../utils/constants');

// One row per (role, reportsTo) period a user held. A new reassignment closes the current
// open row (endDate = now) and opens a new one — never mutated after being closed.
// This is what answers "who was Hira's Team Leader on 2026-03-15" or "when did Joy become
// a Team Leader". DSR/Pipeline/Order records separately stamp the hierarchy at creation time
// (see Dsr.js) — that's what keeps *those* records historically accurate; this collection is
// the audit trail of the assignments themselves.
const assignmentHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: Object.keys(ROLES), required: true },
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, default: null }, // null = currently active
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

assignmentHistorySchema.index({ userId: 1, startDate: -1 });
assignmentHistorySchema.index({ userId: 1, endDate: 1 });
assignmentHistorySchema.index({ reportsTo: 1, startDate: -1 });

module.exports = mongoose.model('AssignmentHistory', assignmentHistorySchema);
