const User = require('../models/User');
const Dsr = require('../models/Dsr');
const Pipeline = require('../models/Pipeline');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');

// month is optional 'YYYY-MM'. Without it, rollups are lifetime totals (seed data was inserted
// in a single batch, so createdAt-based month filtering only becomes meaningful for records
// created going forward through normal use).
function monthRange(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return null;
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

async function agentsInScope(user) {
  if (user.role === 'agent') return User.find({ _id: user._id }).lean();
  if (user.role === 'admin' || user.role === 'backoffice') return User.find({ role: 'agent', active: true }).lean();
  return User.find({ role: 'agent', active: true, managerChain: user._id }).lean();
}

async function buildRollup(user, monthStr) {
  const range = monthRange(monthStr);
  const agents = await agentsInScope(user);
  const agentIds = agents.map((a) => a._id);
  // Pipeline has no business "created" date field of its own, so createdAt is the best
  // available signal there — but Dsr and Order both have a real business date (`date` /
  // `actDate`) and must be filtered on that, not on record-insert time, so backfilled or
  // edited rows land in the month they actually happened, not the month they were saved.
  const createdAtMatch = range ? { createdAt: { $gte: range.start, $lt: range.end } } : {};
  const dsrDateMatch = range ? { date: { $gte: range.start.toISOString().slice(0, 10), $lt: range.end.toISOString().slice(0, 10) } } : {};
  const orderDateMatch = range ? { actDate: { $gte: range.start.toISOString().slice(0, 10), $lt: range.end.toISOString().slice(0, 10) } } : {};

  const [dsrCounts, interestedCounts, pipelineCounts, activatedAgg] = await Promise.all([
    Dsr.aggregate([{ $match: { agentId: { $in: agentIds }, ...dsrDateMatch } }, { $group: { _id: '$agentId', count: { $sum: 1 } } }]),
    Dsr.aggregate([
      { $match: { agentId: { $in: agentIds }, status: 'Interested', ...dsrDateMatch } },
      { $group: { _id: '$agentId', count: { $sum: 1 } } },
    ]),
    Pipeline.aggregate([
      { $match: { agentId: { $in: agentIds }, ...createdAtMatch } },
      { $group: { _id: '$agentId', count: { $sum: 1 }, value: { $sum: '$mrc' } } },
    ]),
    Order.aggregate([
      { $match: { agentId: { $in: agentIds }, status: 'Activated', ...orderDateMatch } },
      { $group: { _id: '$agentId', count: { $sum: 1 }, mrc: { $sum: '$mrc' } } },
    ]),
  ]);

  const mapOf = (arr) => Object.fromEntries(arr.map((r) => [String(r._id), r]));
  const dsrMap = mapOf(dsrCounts);
  const intMap = mapOf(interestedCounts);
  const pipeMap = mapOf(pipelineCounts);
  const actMap = mapOf(activatedAgg);

  const rows = agents.map((a) => {
    const target = a.target || 0;
    const achieved = actMap[String(a._id)]?.mrc || 0;
    return {
      agentId: a._id,
      name: a.name,
      desig: a.desig,
      target,
      submissions: dsrMap[String(a._id)]?.count || 0,
      interested: intMap[String(a._id)]?.count || 0,
      pipelineCount: pipeMap[String(a._id)]?.count || 0,
      pipelineValue: pipeMap[String(a._id)]?.value || 0,
      activatedCount: actMap[String(a._id)]?.count || 0,
      achieved,
      achievementPct: target ? Math.round((achieved / target) * 100) : achieved > 0 ? 100 : 0,
    };
  });
  rows.sort((a, b) => b.achieved - a.achieved);
  return rows;
}

function sumTotals(rows) {
  const totals = rows.reduce(
    (acc, r) => ({
      target: acc.target + r.target,
      submissions: acc.submissions + r.submissions,
      interested: acc.interested + r.interested,
      pipelineCount: acc.pipelineCount + r.pipelineCount,
      pipelineValue: acc.pipelineValue + r.pipelineValue,
      activatedCount: acc.activatedCount + r.activatedCount,
      achieved: acc.achieved + r.achieved,
    }),
    { target: 0, submissions: 0, interested: 0, pipelineCount: 0, pipelineValue: 0, activatedCount: 0, achieved: 0 }
  );
  totals.achievementPct = totals.target ? Math.round((totals.achieved / totals.target) * 100) : 0;
  return totals;
}

async function rollup(req, res, next) {
  try {
    const rows = await buildRollup(req.user, req.query.month);
    res.json({ data: { rows, totals: sumTotals(rows), month: req.query.month || null } });
  } catch (err) {
    next(err);
  }
}

// One person's (or, for a manager, their whole subtree's) target/achievement detail - the
// "click a MIS row" drill-down. Scope is built from the TARGET employee's own managerChain
// (via buildRollup/agentsInScope), not the requester's - the requester just needs permission
// to view it: admin, themselves, or anyone above them in the chain.
async function getAgentDetail(req, res, next) {
  try {
    const target = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!target) throw new AppError('Employee not found', 404);

    const requester = req.user;
    const allowed =
      requester.role === 'admin' ||
      String(requester._id) === String(target._id) ||
      (target.managerChain || []).some((id) => String(id) === String(requester._id));
    if (!allowed) throw new AppError("You do not have access to this employee's performance data", 403);

    const rows = await buildRollup(target, req.query.month);
    res.json({
      data: {
        person: { _id: target._id, name: target.name, desig: target.desig, role: target.role, employeeId: target.employeeId, target: target.target },
        rows,
        totals: sumTotals(rows),
        month: req.query.month || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

function toCsv(rows) {
  const header = ['Agent', 'Designation', 'Target', 'Submissions', 'Interested', 'Pipeline Count', 'Pipeline Value', 'Activated Orders', 'Achieved (AED)', 'Achievement %'];
  const esc = (v) => (typeof v === 'string' && (v.includes(',') || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push(
      [r.name, r.desig, r.target, r.submissions, r.interested, r.pipelineCount, r.pipelineValue, r.activatedCount, r.achieved, r.achievementPct]
        .map(esc)
        .join(',')
    );
  });
  return lines.join('\n');
}

async function exportCsv(req, res, next) {
  try {
    const rows = await buildRollup(req.user, req.query.month);
    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="mis-${req.query.month || 'lifetime'}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = { rollup, exportCsv, getAgentDetail };
