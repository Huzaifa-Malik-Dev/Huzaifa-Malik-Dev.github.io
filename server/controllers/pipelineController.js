const { z } = require('zod');
const Pipeline = require('../models/Pipeline');
const Dsr = require('../models/Dsr');
const User = require('../models/User');
const { nextSeq } = require('../models/Counter');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const {
  convertToPipeline,
  escalateToTL,
  tlApprove,
  tlReject,
  ensureOrderForPipeline,
} = require('../services/workflow');
const { PIPE_STAGES } = require('../utils/constants');
const { sendXlsx, parseXlsxBuffer, cell, resolveAgentFromRow } = require('../utils/importExport');
const AppError = require('../utils/AppError');

const convertSchema = z.object({
  dsrId: z.string().min(1),
  cat: z.string().optional(),
  product: z.string().optional(),
  sr: z.string().optional(),
  price: z.number().optional(),
  qty: z.number().optional(),
  email: z.string().optional(),
  remarks: z.string().optional(),
});

const reasonSchema = z.object({ reason: z.string().optional() });

const updateSchema = z.object({
  cat: z.string().optional(),
  product: z.string().optional(),
  sr: z.string().optional(),
  price: z.number().min(0).optional(),
  qty: z.number().min(1).optional(),
  email: z.string().optional(),
  stage: z.enum(PIPE_STAGES).optional(),
  startedDate: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  director: z.string().optional(),
  directorInvolvement: z.string().optional(),
  remarks: z.string().optional(),
});

function scopeFilter(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'agent') return { agentId: user._id };
  return {
    $or: [{ tlId: user._id }, { teamHeadId: user._id }, { salesHeadId: user._id }, { agentId: user._id }],
  };
}

async function list(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = { ...scopeFilter(req.user) };
    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.approval) filter.approval = req.query.approval;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      const matchingAgents = await User.find({ name: re }).select('_id').lean();
      filter.$and = [
        { $or: [{ dsrNo: re }, { company: re }, { customer: re }, { product: re }, { agentId: { $in: matchingAgents.map((u) => u._id) } }] },
      ];
    }

    const [data, totalRowCount] = await Promise.all([
      Pipeline.find(filter).sort(sort).skip(skip).limit(limit).populate('agentId', 'name').lean(),
      Pipeline.countDocuments(filter),
    ]);
    res.json(buildPageResponse(data, totalRowCount, page, limit));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const pipeline = await Pipeline.findById(req.params.id)
      .populate('agentId', 'name')
      .populate('tlId', 'name')
      .populate('history.userId', 'name')
      .lean();
    if (!pipeline) throw new AppError('Pipeline item not found', 404);

    const scope = scopeFilter(req.user);
    if (Object.keys(scope).length) {
      const inScope =
        req.user.role === 'agent'
          ? String(pipeline.agentId?._id) === String(req.user._id)
          : [pipeline.tlId?._id, pipeline.teamHeadId, pipeline.salesHeadId, pipeline.agentId?._id].some(
              (id) => String(id) === String(req.user._id)
            );
      if (!inScope) throw new AppError('You do not have access to this deal', 403);
    }

    res.json({ data: pipeline });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const parsed = convertSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const pipeline = await convertToPipeline(parsed.data.dsrId, parsed.data, req.user);
    res.status(201).json({ data: pipeline });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const pipeline = await Pipeline.findById(req.params.id);
    if (!pipeline) throw new AppError('Pipeline item not found', 404);

    const allowed =
      req.user.role === 'admin' ||
      String(pipeline.agentId) === String(req.user._id) ||
      String(pipeline.tlId) === String(req.user._id);
    if (!allowed) throw new AppError('You cannot edit this deal', 403);

    const fields = parsed.data;
    const oldStage = pipeline.stage;
    Object.assign(pipeline, fields);
    const price = fields.price ?? pipeline.price;
    const qty = fields.qty ?? pipeline.qty;
    if (fields.price !== undefined || fields.qty !== undefined) {
      pipeline.mrc = price * qty;
      pipeline.annual = pipeline.mrc * 12;
    }
    pipeline.history.push({ userId: req.user._id, text: 'Deal details edited' });
    await pipeline.save();

    // Reaching 100% opens (or updates) the Back Office order, same as a TL approval does -
    // whichever path gets there first.
    if (fields.stage === '100% - Deal Won' && oldStage !== '100% - Deal Won') {
      await ensureOrderForPipeline(pipeline, req.user, 'Order opened — deal marked Won (100%)');
    }

    res.json({ data: pipeline });
  } catch (err) {
    next(err);
  }
}

async function escalateTl(req, res, next) {
  try {
    const pipeline = await escalateToTL(req.params.id, req.user);
    res.json({ data: pipeline });
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    const result = await tlApprove(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const parsed = reasonSchema.safeParse(req.body);
    const pipeline = await tlReject(req.params.id, req.user, parsed.success ? parsed.data.reason : undefined);
    res.json({ data: pipeline });
  } catch (err) {
    next(err);
  }
}

const EXPORT_COLUMNS = [
  { header: 'DSR No', key: 'dsrNo' },
  { header: 'Company', key: 'company' },
  { header: 'Customer', key: 'customer' },
  { header: 'Email', key: 'email' },
  { header: 'Category', key: 'cat' },
  { header: 'Product', key: 'product' },
  { header: 'SR', key: 'sr' },
  { header: 'Price', key: 'price' },
  { header: 'Qty', key: 'qty' },
  { header: 'MRC', key: 'mrc' },
  { header: 'Annual', key: 'annual' },
  { header: 'Stage', key: 'stage' },
  { header: 'Approval', key: 'approval' },
  { header: 'Started Date', key: 'startedDate' },
  { header: 'Expected Close Date', key: 'expectedCloseDate' },
  { header: 'Director', key: 'director' },
  { header: 'Director Involvement', key: 'directorInvolvement' },
  { header: 'Remarks', key: 'remarks' },
  { header: 'Agent', get: (r) => r.agentId?.name || '' },
  { header: 'Agent Email', get: (r) => r.agentId?.email || '' },
  { header: 'Agent Username', get: (r) => r.agentId?.username || '' },
];

async function exportPipeline(req, res, next) {
  try {
    const filter = { ...scopeFilter(req.user) };
    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.approval) filter.approval = req.query.approval;
    const rows = await Pipeline.find(filter).sort({ createdAt: -1 }).populate('agentId', 'name email username').lean();
    sendXlsx(res, `pipeline-export-${Date.now()}.xlsx`, rows, EXPORT_COLUMNS, 'Pipeline');
  } catch (err) {
    next(err);
  }
}

// A Pipeline deal always needs a backing DSR (dsrId is required — see models/Pipeline.js), so an
// imported row gets a minimal companion "Interested" DSR created for it first, same as a real
// agent would log a call before converting it — this keeps every rollup/history path consistent.
const importRowSchema = z.object({
  company: z.string().trim().min(1, 'Company is required'),
  contactNo: z.string().trim().min(1, 'Contact No is required'),
  email: z.string().optional().default(''),
  customer: z.string().optional().default(''),
  cat: z.string().optional().default(''),
  product: z.string().optional().default(''),
  sr: z.string().optional().default(''),
  price: z.number().min(0).optional().default(0),
  qty: z.number().min(1).optional().default(1),
  stage: z.enum(PIPE_STAGES, { errorMap: () => ({ message: `Stage must be one of: ${PIPE_STAGES.join(', ')}` }) }).optional().default('10%- Prospect'),
  startedDate: z.string().optional().default(''),
  expectedCloseDate: z.string().optional().default(''),
  director: z.string().optional().default(''),
  directorInvolvement: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
});

async function importPipeline(req, res, next) {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const rawRows = parseXlsxBuffer(req.file.buffer);
    if (!rawRows.length) throw new AppError('The file has no data rows', 400);

    const errors = [];
    let created = 0;

    for (let i = 0; i < rawRows.length; i += 1) {
      const raw = rawRows[i];
      const rowNum = i + 2;
      try {
        const priceRaw = cell(raw, 'Price');
        const qtyRaw = cell(raw, 'Qty');
        const candidate = {
          company: cell(raw, 'Company'),
          contactNo: cell(raw, 'Contact No'),
          email: cell(raw, 'Email'),
          customer: cell(raw, 'Customer'),
          cat: cell(raw, 'Category'),
          product: cell(raw, 'Product'),
          sr: cell(raw, 'SR'),
          price: priceRaw === '' ? undefined : Number(priceRaw),
          qty: qtyRaw === '' ? undefined : Number(qtyRaw),
          stage: cell(raw, 'Stage') || undefined,
          startedDate: cell(raw, 'Started Date'),
          expectedCloseDate: cell(raw, 'Expected Close Date'),
          director: cell(raw, 'Director'),
          directorInvolvement: cell(raw, 'Director Involvement'),
          remarks: cell(raw, 'Remarks'),
        };
        const parsed = importRowSchema.safeParse(candidate);
        if (!parsed.success) {
          errors.push({ row: rowNum, message: parsed.error.issues[0].message });
          continue;
        }
        const body = parsed.data;

        const { agent, error: agentError } = await resolveAgentFromRow(raw, req.user, User);
        if (agentError) {
          errors.push({ row: rowNum, message: agentError });
          continue;
        }

        const chain = agent.managerChain || [];
        const seq = await nextSeq('dsr');
        const dsrNo = 'DSR-' + String(seq).padStart(5, '0');

        const dsr = await Dsr.create({
          dsrNo,
          date: new Date().toISOString().slice(0, 10),
          company: body.company,
          contactNo: body.contactNo,
          email: body.email,
          customer: body.customer,
          status: 'Interested',
          connected: 'YES',
          agentId: agent._id,
          tlId: chain[0] || null,
          teamHeadId: chain[1] || null,
          salesHeadId: chain[2] || null,
          convertedToPipeline: true,
          history: [{ userId: req.user._id, text: 'DSR auto-created for imported pipeline deal' }],
        });

        const mrc = body.qty * body.price;
        await Pipeline.create({
          dsrId: dsr._id,
          dsrNo: dsr.dsrNo,
          agentId: agent._id,
          tlId: chain[0] || null,
          teamHeadId: chain[1] || null,
          salesHeadId: chain[2] || null,
          company: body.company,
          customer: body.customer,
          email: body.email,
          cat: body.cat,
          product: body.product,
          sr: body.sr,
          price: body.price,
          qty: body.qty,
          mrc,
          annual: mrc * 12,
          stage: body.stage,
          startedDate: body.startedDate,
          expectedCloseDate: body.expectedCloseDate,
          director: body.director,
          directorInvolvement: body.directorInvolvement,
          remarks: body.remarks,
          history: [{ userId: req.user._id, text: 'Deal imported from spreadsheet' }],
        });
        created += 1;
      } catch (rowErr) {
        errors.push({ row: rowNum, message: rowErr.message || 'Unexpected error' });
      }
    }

    res.json({ data: { total: rawRows.length, created, failed: errors.length, errors } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, escalateTl, approve, reject, exportPipeline, importPipeline };
