const Dsr = require('../models/Dsr');
const Pipeline = require('../models/Pipeline');
const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Same hierarchy-scoped filter used by dsr/pipeline/order controllers — every rollup here
// stays a single indexed query instead of a recursive tree walk.
function scopeFilter(user) {
  if (user.role === 'admin' || user.role === 'backoffice') return {};
  if (user.role === 'agent') return { agentId: user._id };
  return {
    $or: [{ tlId: user._id }, { teamHeadId: user._id }, { salesHeadId: user._id }, { agentId: user._id }],
  };
}

async function getTargetSum(user) {
  if (user.role === 'agent') return user.target || 0;
  if (!['admin', 'sales_head', 'teams_head', 'team_leader'].includes(user.role)) return 0;
  const filter = user.role === 'admin' ? { role: 'agent', active: true } : { role: 'agent', active: true, managerChain: user._id };
  const agg = await User.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$target' } } }]);
  return agg[0]?.total || 0;
}

async function getSummary(req, res, next) {
  try {
    const user = req.user;
    const scope = scopeFilter(user);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      dsrTotal,
      dsrToday,
      dsrByStatus,
      pipelineByStage,
      pipelinePendingApprovalAgg,
      pipelineValueAgg,
      ordersByStatus,
      activatedThisMonthAgg,
      targetSum,
      recentNotifications,
    ] = await Promise.all([
      Dsr.countDocuments(scope),
      Dsr.countDocuments({ ...scope, date: today }),
      Dsr.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Pipeline.aggregate([{ $match: scope }, { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$mrc' } } }]),
      Pipeline.aggregate([{ $match: { ...scope, approval: 'pending_tl' } }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$mrc' } } }]),
      Pipeline.aggregate([{ $match: { ...scope, stage: { $ne: '0% - Lost' } } }, { $group: { _id: null, total: { $sum: '$mrc' } } }]),
      Order.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$mrc' } } }]),
      Order.aggregate([
        { $match: { ...scope, status: 'Activated', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, count: { $sum: 1 }, mrc: { $sum: '$mrc' }, commission: { $sum: '$commission' } } },
      ]),
      getTargetSum(user),
      Notification.find({ userId: user._id }).sort({ seq: -1 }).limit(5).lean(),
    ]);

    res.json({
      data: {
        dsr: {
          total: dsrTotal,
          today: dsrToday,
          byStatus: Object.fromEntries(dsrByStatus.map((r) => [r._id, r.count])),
        },
        pipeline: {
          byStage: Object.fromEntries(pipelineByStage.map((r) => [r._id, { count: r.count, value: r.value }])),
          openValue: pipelineValueAgg[0]?.total || 0,
          pendingApproval: { count: pipelinePendingApprovalAgg[0]?.count || 0, value: pipelinePendingApprovalAgg[0]?.value || 0 },
        },
        orders: {
          byStatus: Object.fromEntries(ordersByStatus.map((r) => [r._id, { count: r.count, value: r.value }])),
        },
        thisMonth: {
          activatedCount: activatedThisMonthAgg[0]?.count || 0,
          activatedMrc: activatedThisMonthAgg[0]?.mrc || 0,
          commission: activatedThisMonthAgg[0]?.commission || 0,
        },
        target: {
          value: targetSum,
          achievement: activatedThisMonthAgg[0]?.mrc || 0,
          pct: targetSum ? Math.min(100, Math.round(((activatedThisMonthAgg[0]?.mrc || 0) / targetSum) * 100)) : 0,
          applicable: targetSum > 0 || user.role === 'agent',
        },
        recentNotifications,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary };
