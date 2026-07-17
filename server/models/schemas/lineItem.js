// Shared by Pipeline.js and Order.js - a deal/order is one or more "blocks" (Category + Product +
// Subscription Type), each carrying one or more price/qty "rows" (e.g. 3 units at 100 AED and 2
// units at 150 AED under the same block). Extracted into its own file (unlike the trivial
// per-model historyEntrySchema) because the two models must never drift on this shape and the
// recompute rules are more than a one-liner - see utils/lineItems.js.
const mongoose = require('mongoose');
const { CATEGORIES, SR_TYPES } = require('../../utils/constants');

const lineItemRowSchema = new mongoose.Schema({
  price: { type: Number, default: 0, min: 0 },
  qty: { type: Number, default: 1, min: 1 },
  // Always recomputed server-side as price * qty (see utils/lineItems.js) - never trusted from
  // client input, same rule the old top-level Pipeline/Order.mrc already followed.
  mrc: { type: Number, default: 0 },
});

const lineItemBlockSchema = new mongoose.Schema({
  cat: { type: String, enum: [...CATEGORIES, ''], default: '' },
  product: { type: String, default: '' },
  sr: { type: String, enum: [...SR_TYPES, ''], default: '' },
  rows: { type: [lineItemRowSchema], default: () => [{ price: 0, qty: 1, mrc: 0 }] },
  // Sum of rows[].mrc - a convenience per-block subtotal recomputed alongside rows[].mrc so the
  // UI never has to re-derive it.
  blockMrc: { type: Number, default: 0 },
});

module.exports = { lineItemRowSchema, lineItemBlockSchema };
