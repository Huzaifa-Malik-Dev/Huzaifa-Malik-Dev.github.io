const { z } = require('zod');
const Product = require('../models/Product');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const AppError = require('../utils/AppError');

const createSchema = z.object({
  title: z.string().trim().min(1),
  cat: z.string().trim().min(1),
  segmentId: z.string().min(1).nullable().optional(),
  price: z.number().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  cat: z.string().trim().min(1).optional(),
  segmentId: z.string().min(1).nullable().optional(),
  price: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

async function list(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = {};

    if (req.query.cat) filter.cat = req.query.cat;
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    if (req.query.segmentId) filter.segmentId = req.query.segmentId;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ title: re }, { cat: re }];
    }

    const [data, totalRowCount] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).populate('segmentId', 'name').lean(),
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

    Object.assign(product, parsed.data);
    await product.save();

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
    res.json({ data: { _id: req.params.id } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
