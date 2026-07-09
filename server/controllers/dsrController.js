const { z } = require('zod');
const Dsr = require('../models/Dsr');
const User = require('../models/User');
const { nextSeq } = require('../models/Counter');
const { parsePagination, buildPageResponse } = require('../utils/pagination');
const { notify } = require('../services/notify');
const { CALL_STATUS, NOT_CONNECTED_STATUSES } = require('../utils/constants');
const { sendXlsx, parseXlsxBuffer, cell, resolveAgentFromRow } = require('../utils/importExport');
const AppError = require('../utils/AppError');

function connectedFor(status) {
  return NOT_CONNECTED_STATUSES.includes(status) ? 'NO' : 'YES';
}

const createSchema = z.object({
  date: z.string().min(1),
  company: z.string().trim().min(1),
  building: z.string().optional().default(''),
  contactNo: z.string().trim().min(1),
  email: z.string().optional().default(''),
  customer: z.string().optional().default(''),
  status: z.enum(CALL_STATUS),
  remarks: z.string().optional().default(''),
  connected: z.enum(['YES', 'NO']).optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(CALL_STATUS),
  remarks: z.string().optional(),
});

const updateSchema = z.object({
  date: z.string().min(1).optional(),
  company: z.string().trim().min(1).optional(),
  building: z.string().optional(),
  contactNo: z.string().trim().min(1).optional(),
  email: z.string().optional(),
  customer: z.string().optional(),
  status: z.enum(CALL_STATUS).optional(),
  remarks: z.string().optional(),
});

// Scopes the base filter to what this user is allowed to see:
// agent -> own records only; team_leader/teams_head/sales_head -> their subtree via managerChain;
// admin -> everything.
function scopeFilter(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'agent') return { agentId: user._id };
  // Anyone above agent level sees records where they appear anywhere in the stamped hierarchy.
  return {
    $or: [{ tlId: user._id }, { teamHeadId: user._id }, { salesHeadId: user._id }, { agentId: user._id }],
  };
}

async function list(req, res, next) {
  try {
    const { page, limit, skip, sort } = parsePagination(req.query);
    const filter = { ...scopeFilter(req.user) };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.agentId) filter.agentId = req.query.agentId;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      // agentId is a reference, not a plain field — a search for the agent's name has to
      // resolve to their _id(s) first before it can be OR'd in alongside the plain-text fields.
      const matchingAgents = await User.find({ name: re }).select('_id').lean();
      filter.$and = [
        { $or: [{ company: re }, { contactNo: re }, { customer: re }, { dsrNo: re }, { agentId: { $in: matchingAgents.map((u) => u._id) } }] },
      ];
    }

    const [data, totalRowCount] = await Promise.all([
      Dsr.find(filter).sort(sort).skip(skip).limit(limit).populate('agentId', 'name').lean(),
      Dsr.countDocuments(filter),
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
    const body = parsed.data;

    const agent = req.user.role === 'agent' ? req.user : await User.findById(req.body.agentId);
    if (!agent) throw new AppError('Agent not found', 400);

    const seq = await nextSeq('dsr');
    const dsrNo = 'DSR-' + String(seq).padStart(5, '0');
    const chain = agent.managerChain || [];

    const dsr = await Dsr.create({
      dsrNo,
      ...body,
      connected: body.connected || connectedFor(body.status),
      agentId: agent._id,
      tlId: chain[0] || null,
      teamHeadId: chain[1] || null,
      salesHeadId: chain[2] || null,
      history: [{ userId: req.user._id, text: `DSR created · status set to ${body.status}` }],
    });

    if (chain[0]) await notify(chain[0], `New DSR ${dsrNo} by ${agent.name} — ${body.company} (${body.status})`, { refType: 'dsr', refId: dsr._id });

    res.status(201).json({ data: dsr });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const dsr = await Dsr.findById(req.params.id);
    if (!dsr) throw new AppError('DSR not found', 404);

    const allowedToEdit = req.user.role === 'admin' || String(dsr.agentId) === String(req.user._id);
    if (!allowedToEdit) throw new AppError('You cannot edit this DSR', 403);
    if (dsr.convertedToPipeline) throw new AppError('This DSR has moved to the Sales Pipeline and can no longer be edited here', 400);

    dsr.status = parsed.data.status;
    if (parsed.data.remarks !== undefined) dsr.remarks = parsed.data.remarks;
    dsr.connected = connectedFor(dsr.status);
    dsr.history.push({ userId: req.user._id, text: `Status updated to ${dsr.status}` });
    await dsr.save();

    res.json({ data: dsr });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const dsr = await Dsr.findById(req.params.id);
    if (!dsr) throw new AppError('DSR not found', 404);

    const allowedToEdit = req.user.role === 'admin' || String(dsr.agentId) === String(req.user._id);
    if (!allowedToEdit) throw new AppError('You cannot edit this DSR', 403);
    if (dsr.convertedToPipeline) throw new AppError('This DSR has moved to the Sales Pipeline and can no longer be edited here', 400);

    const fields = parsed.data;
    Object.assign(dsr, fields);
    if (fields.status) {
      dsr.connected = connectedFor(dsr.status);
    }
    dsr.history.push({ userId: req.user._id, text: 'DSR record edited' });
    await dsr.save();

    res.json({ data: dsr });
  } catch (err) {
    next(err);
  }
}

// Powers the Company autocomplete in the "Log a call" form — an agent calling the same
// building/customer again shouldn't have to retype Building/Contact/Email from scratch. Scoped
// to whatever this user can already see (their own calls, or their team's).
async function autocomplete(req, res, next) {
  try {
    const filter = { ...scopeFilter(req.user) };
    const q = (req.query.q || '').trim();
    if (q) filter.company = new RegExp(q, 'i');

    const rows = await Dsr.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .select('company building contactNo email customer')
      .lean();

    const seen = new Set();
    const suggestions = [];
    for (const r of rows) {
      const key = r.company.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(r);
      if (suggestions.length >= 8) break;
    }
    res.json({ data: suggestions });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const dsr = await Dsr.findById(req.params.id).populate('agentId', 'name').lean();
    if (!dsr) throw new AppError('DSR not found', 404);
    res.json({ data: dsr });
  } catch (err) {
    next(err);
  }
}

const EXPORT_COLUMNS = [
  { header: 'DSR No', key: 'dsrNo' },
  { header: 'Date', key: 'date' },
  { header: 'Company', key: 'company' },
  { header: 'Building', key: 'building' },
  { header: 'Contact No', key: 'contactNo' },
  { header: 'Email', key: 'email' },
  { header: 'Customer', key: 'customer' },
  { header: 'Status', key: 'status' },
  { header: 'Connected', key: 'connected' },
  { header: 'Remarks', key: 'remarks' },
  { header: 'Agent', get: (r) => r.agentId?.name || '' },
  { header: 'Agent Email', get: (r) => r.agentId?.email || '' },
  { header: 'Agent Username', get: (r) => r.agentId?.username || '' },
];

async function exportDsr(req, res, next) {
  try {
    const filter = { ...scopeFilter(req.user) };
    if (req.query.status) filter.status = req.query.status;
    const rows = await Dsr.find(filter).sort({ createdAt: -1 }).populate('agentId', 'name email username').lean();
    sendXlsx(res, `dsr-export-${Date.now()}.xlsx`, rows, EXPORT_COLUMNS, 'DSR');
  } catch (err) {
    next(err);
  }
}

const importRowSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  company: z.string().trim().min(1, 'Company is required'),
  building: z.string().optional().default(''),
  contactNo: z.string().trim().min(1, 'Contact No is required'),
  email: z.string().optional().default(''),
  customer: z.string().optional().default(''),
  status: z.enum(CALL_STATUS, { errorMap: () => ({ message: `Status must be one of: ${CALL_STATUS.join(', ')}` }) }),
  remarks: z.string().optional().default(''),
});

async function importDsr(req, res, next) {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const rawRows = parseXlsxBuffer(req.file.buffer);
    if (!rawRows.length) throw new AppError('The file has no data rows', 400);

    const errors = [];
    let created = 0;

    for (let i = 0; i < rawRows.length; i += 1) {
      const raw = rawRows[i];
      const rowNum = i + 2; // account for the header row
      try {
        const candidate = {
          date: cell(raw, 'Date'),
          company: cell(raw, 'Company'),
          building: cell(raw, 'Building'),
          contactNo: cell(raw, 'Contact No'),
          email: cell(raw, 'Email'),
          customer: cell(raw, 'Customer'),
          status: cell(raw, 'Status'),
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

        const seq = await nextSeq('dsr');
        const dsrNo = 'DSR-' + String(seq).padStart(5, '0');
        const chain = agent.managerChain || [];

        await Dsr.create({
          dsrNo,
          ...body,
          connected: connectedFor(body.status),
          agentId: agent._id,
          tlId: chain[0] || null,
          teamHeadId: chain[1] || null,
          salesHeadId: chain[2] || null,
          history: [{ userId: req.user._id, text: `DSR imported from spreadsheet · status set to ${body.status}` }],
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

module.exports = { list, create, updateStatus, update, getOne, exportDsr, importDsr, autocomplete };
