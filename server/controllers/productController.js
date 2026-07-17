const { z } = require('zod');
const Product = require('../models/Product');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const AppError = require('../utils/AppError');
const { logActivity, diffFields, describeFields } = require('../utils/activityLog');
const { CATEGORIES, SR_TYPES } = require('../utils/constants');

const PRODUCT_FIELD_LABELS = { title: 'Title', cat: 'Category', active: 'Active' };

function uniquePricingTypes(pricing) {
  const types = pricing.map((p) => p.subscriptionType);
  return new Set(types).size === types.length;
}

const pricingSchema = z
  .array(z.object({ subscriptionType: z.enum(SR_TYPES), defaultPrice: z.number().min(0) }))
  .refine(uniquePricingTypes, { message: 'Each subscription type can only have one price preset' });

const createSchema = z.object({
  title: z.string().trim().min(1),
  cat: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Category is required' }) }),
  pricing: pricingSchema.optional().default([]),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  cat: z.enum(CATEGORIES).optional(),
  pricing: pricingSchema.optional(),
  active: z.boolean().optional(),
});

async function list(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};

    if (req.query.cat) filter.cat = req.query.cat;
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ title: re }, { cat: re }];
    }

    const [data, totalRowCount] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const product = await Product.create(parsed.data);
    logActivity(req.user, `added product "${product.title}" — ${describeFields(product, PRODUCT_FIELD_LABELS)}`);
    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);

    const before = { title: product.title, cat: product.cat, active: product.active };
    const pricingChanged = parsed.data.pricing !== undefined && JSON.stringify(product.pricing) !== JSON.stringify(parsed.data.pricing);
    Object.assign(product, parsed.data);
    await product.save();

    const changes = diffFields(before, product.toObject(), PRODUCT_FIELD_LABELS);
    // pricing is an array of objects - diffFields' generic array.join() display would render it as
    // unreadable "[object Object]" noise, so it gets its own plain marker instead of a value diff.
    if (pricingChanged) changes.push('Pricing updated');
    if (changes.length) logActivity(req.user, `edited product "${product.title}": ${changes.join(', ')}`);
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);

    await product.deleteOne();
    logActivity(req.user, `deleted product "${product.title}"`);
    res.json({ data: { _id: req.params.id } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
