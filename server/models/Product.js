const mongoose = require('mongoose');
const { CATEGORIES, SR_TYPES } = require('../utils/constants');

const pricingEntrySchema = new mongoose.Schema(
  {
    subscriptionType: { type: String, enum: SR_TYPES, required: true },
    defaultPrice: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    cat: { type: String, enum: CATEGORIES, required: true },
    // One optional preset per subscription type this product supports - a type absent here just
    // means "no preset". The Subscription Type Select in Pipeline/Back Office still always offers
    // every SR_TYPES value regardless of product; only the Unit Price prefill is affected (see
    // client/src/components/LineItemsEditor.jsx), and it always stays user-editable either way.
    pricing: { type: [pricingEntrySchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ cat: 1 });
productSchema.index({ active: 1 });

// Defense in depth alongside the Zod-level uniqueness check in productController.js.
productSchema.pre('validate', function enforceUniquePricingTypes(next) {
  const seen = new Set();
  for (const entry of this.pricing) {
    if (seen.has(entry.subscriptionType)) {
      return next(new Error(`Duplicate pricing entry for subscription type "${entry.subscriptionType}"`));
    }
    seen.add(entry.subscriptionType);
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
