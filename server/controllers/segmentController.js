const { z } = require('zod');
const Segment = require('../models/Segment');
const AppError = require('../utils/AppError');

const createSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

async function list(req, res, next) {
  try {
    const data = await Segment.find({}).sort({ name: 1 }).lean();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const exists = await Segment.findOne({ name: parsed.data.name });
    if (exists) throw new AppError('A segment with this name already exists', 400);

    const segment = await Segment.create(parsed.data);
    res.status(201).json({ data: segment });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const segment = await Segment.findById(req.params.id);
    if (!segment) throw new AppError('Segment not found', 404);

    Object.assign(segment, parsed.data);
    await segment.save();

    res.json({ data: segment });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) throw new AppError('Segment not found', 404);

    await segment.deleteOne();
    res.json({ data: { _id: req.params.id } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
