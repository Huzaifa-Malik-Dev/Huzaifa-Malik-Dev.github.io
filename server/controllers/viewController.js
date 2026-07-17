const Dsr = require('../models/Dsr');
const Pipeline = require('../models/Pipeline');
const Order = require('../models/Order');
const { VIEW_TRACKED_MODULES, markViewed: markViewedService, countUnread } = require('../services/recordViews');
const { scopeFilter: dsrScope } = require('./dsrController');
const { scopeFilter: pipelineScope } = require('./pipelineController');
const { scopeFilter: orderScope } = require('./orderController');
const AppError = require('../utils/AppError');

async function markViewed(req, res, next) {
  try {
    const { module, id } = req.params;
    if (!VIEW_TRACKED_MODULES.includes(module)) throw new AppError(`Unknown module: ${module}`, 400);
    await markViewedService(req.user._id, module, id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// How many records this user has never opened, per module - the number in each sidebar badge.
// Counts exactly the rows its list page would highlight as new, so the badge and the highlighting
// can never disagree: same scope filter (imported from each list controller rather than re-derived
// here, so the access rules can't drift), and DSR applies the same hide-converted default its own
// list() does.
//
// A record's creator never counts here, because creating it already marks it viewed for them (see
// recordViews.markCreatedByMe) - so an agent's own calls are never "unread" to that agent.
async function unreadCounts(req, res, next) {
  try {
    const user = req.user;
    const [dsr, pipeline, orders] = await Promise.all([
      countUnread(Dsr, user._id, 'dsr', { ...dsrScope(user), convertedToPipeline: { $ne: true } }),
      countUnread(Pipeline, user._id, 'pipeline', pipelineScope(user)),
      countUnread(Order, user._id, 'orders', orderScope(user)),
    ]);
    res.json({ data: { dsr, pipeline, orders } });
  } catch (err) {
    next(err);
  }
}

module.exports = { markViewed, unreadCounts };
