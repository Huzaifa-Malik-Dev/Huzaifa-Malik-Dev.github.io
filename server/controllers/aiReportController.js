const Dsr = require('../models/Dsr');
const Pipeline = require('../models/Pipeline');
const Order = require('../models/Order');

// Templated, data-driven summary — not a real LLM call. Every figure below comes straight from
// the same collections the rest of the app reads; "AI" here means computed insight/flags on top
// of real aggregates, matching how the original prototype's AI Reports module worked.
function scopeFilter(user) {
  if (user.role === 'admin' || user.role === 'backoffice') return {};
  if (user.role === 'agent') return { agentId: user._id };
  return { $or: [{ tlId: user._id }, { teamHeadId: user._id }, { salesHeadId: user._id }, { agentId: user._id }] };
}

function periodRange(periodParam) {
  const now = new Date();
  let start;
  let label;
  let period = periodParam;
  if (period === 'weekly') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    label = 'Last 7 Days';
  } else if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    label = start.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  } else {
    period = 'daily';
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    label = 'Today';
  }
  return { start, end: now, label, period };
}

async function getReport(req, res, next) {
  try {
    const user = req.user;
    const { start, end, label, period } = periodRange(req.query.period);
    const scope = scopeFilter(user);
    const startDateStr = start.toISOString().slice(0, 10);

    const [dsrCount, interestedCount, notInterestedCount, pipelineCreated, pipelineApproved, pipelineRejected, activatedAgg, ordersOnHold] =
      await Promise.all([
        Dsr.countDocuments({ ...scope, date: { $gte: startDateStr } }),
        Dsr.countDocuments({ ...scope, status: 'Interested', date: { $gte: startDateStr } }),
        Dsr.countDocuments({ ...scope, status: 'Not interested', date: { $gte: startDateStr } }),
        Pipeline.countDocuments({ ...scope, createdAt: { $gte: start, $lte: end } }),
        Pipeline.countDocuments({ ...scope, approval: 'approved', createdAt: { $gte: start, $lte: end } }),
        Pipeline.countDocuments({ ...scope, approval: 'rejected', createdAt: { $gte: start, $lte: end } }),
        Order.aggregate([
          { $match: { ...scope, status: 'Activated', createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: null, count: { $sum: 1 }, mrc: { $sum: '$mrc' }, commission: { $sum: '$commission' } } },
        ]),
        Order.countDocuments({ ...scope, status: 'On Hold' }),
      ]);

    const activated = activatedAgg[0] || { count: 0, mrc: 0, commission: 0 };
    const conversionPct = dsrCount ? Math.round((interestedCount / dsrCount) * 100) : 0;
    const approvalPct = pipelineCreated ? Math.round((pipelineApproved / pipelineCreated) * 100) : 0;

    const flags = [];
    if (interestedCount > 0) {
      flags.push({ type: 'good', text: `${interestedCount} interested lead${interestedCount === 1 ? '' : 's'} logged — keep the follow-up cadence tight.` });
    }
    if (dsrCount > 0 && notInterestedCount / dsrCount > 0.4) {
      flags.push({
        type: 'warn',
        text: `${notInterestedCount} of ${dsrCount} calls came back "Not interested" (${Math.round((notInterestedCount / dsrCount) * 100)}%) — worth reviewing calling list quality.`,
      });
    }
    if (pipelineRejected > 0) {
      flags.push({ type: 'bad', text: `${pipelineRejected} deal${pipelineRejected === 1 ? '' : 's'} rejected by Team Leader this period.` });
    }
    if (ordersOnHold > 0) {
      flags.push({ type: 'warn', text: `${ordersOnHold} order${ordersOnHold === 1 ? '' : 's'} currently On Hold — needs documents or follow-up to unblock.` });
    }
    if (activated.count > 0) {
      flags.push({
        type: 'good',
        text: `${activated.count} order${activated.count === 1 ? '' : 's'} activated worth AED ${activated.mrc.toLocaleString()} MRC (AED ${activated.commission.toLocaleString()} commission).`,
      });
    }
    if (flags.length === 0) flags.push({ type: 'warn', text: 'No activity recorded for this period yet.' });

    const summary = [
      `${dsrCount} call${dsrCount === 1 ? '' : 's'} logged, ${interestedCount} marked Interested (${conversionPct}% interest rate).`,
      `${pipelineCreated} deal${pipelineCreated === 1 ? '' : 's'} entered the pipeline, ${pipelineApproved} approved by Team Leader (${approvalPct}% approval rate).`,
      `${activated.count} order${activated.count === 1 ? '' : 's'} activated — AED ${activated.mrc.toLocaleString()} MRC / AED ${activated.commission.toLocaleString()} commission.`,
    ];

    res.json({
      data: {
        title: `${label} Performance Report`,
        period,
        label,
        generatedAt: new Date().toISOString(),
        generatedFor: user.name,
        summary,
        flags,
        stats: {
          dsrCount,
          interestedCount,
          notInterestedCount,
          conversionPct,
          pipelineCreated,
          pipelineApproved,
          pipelineRejected,
          approvalPct,
          activatedCount: activated.count,
          activatedMrc: activated.mrc,
          commission: activated.commission,
          ordersOnHold,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReport };
