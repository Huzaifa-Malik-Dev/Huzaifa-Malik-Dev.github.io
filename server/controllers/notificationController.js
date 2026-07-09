const Notification = require('../models/Notification');
const Thread = require('../models/Thread');
const AppError = require('../utils/AppError');

// Index-covered query: { userId, read } is fully satisfied by the index, never touches documents.
async function unreadCount(req, res, next) {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ unread: count });
  } catch (err) {
    next(err);
  }
}

// Catch-up feed: everything newer than the client's last-seen seq. Called on load and after any
// reconnect/tab-focus so a client can never permanently miss a notification.
async function list(req, res, next) {
  try {
    const afterSeq = parseInt(req.query.afterSeq, 10) || 0;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    // Sort newest-first so a `limit` cap takes the MOST RECENT notifications, not whichever
    // happen to be oldest since afterSeq — otherwise a user with >limit notifications since
    // their cursor could never see anything recent. Reversed back to ascending before sending
    // so the response stays chronological for callers that render/append in that order.
    const items = await Notification.find({ userId: req.user._id, seq: { $gt: afterSeq } })
      .sort({ seq: -1 })
      .limit(limit)
      .lean();
    items.reverse();

    // Thread notifications carry a Thread._id as refId - resolve those to a dsrNo so the client
    // can open the right chat directly on click, without a lookup of its own.
    const threadRefIds = items.filter((n) => n.refType === 'thread').map((n) => n.refId);
    if (threadRefIds.length) {
      const threads = await Thread.find({ _id: { $in: threadRefIds } }).select('_id dsrNo').lean();
      const dsrNoById = new Map(threads.map((t) => [String(t._id), t.dsrNo]));
      items.forEach((n) => {
        if (n.refType === 'thread') n.dsrNo = dsrNoById.get(String(n.refId)) || null;
      });
    }

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!doc) throw new AppError('Notification not found', 404);
    res.json({ data: doc });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Per-record chat unread badges (DSR/Pipeline list rows) - piggybacks on the existing
// refType:'thread' notifications rather than a separate read-tracking system. One batched
// aggregation for the whole visible page instead of N queries.
async function threadUnreadCounts(req, res, next) {
  try {
    const dsrNos = (req.query.dsrNos || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!dsrNos.length) return res.json({ data: {} });

    const threads = await Thread.find({ dsrNo: { $in: dsrNos } }).select('_id dsrNo').lean();
    if (!threads.length) return res.json({ data: {} });
    const dsrNoById = new Map(threads.map((t) => [String(t._id), t.dsrNo]));

    const rows = await Notification.aggregate([
      { $match: { userId: req.user._id, read: false, refType: 'thread', refId: { $in: threads.map((t) => t._id) } } },
      { $group: { _id: '$refId', count: { $sum: 1 } } },
    ]);

    const counts = {};
    rows.forEach((r) => {
      const dsrNo = dsrNoById.get(String(r._id));
      if (dsrNo) counts[dsrNo] = r.count;
    });
    res.json({ data: counts });
  } catch (err) {
    next(err);
  }
}

// Called when a user opens a DSR/Pipeline/Order's chat - clears the unread badge for that thread.
async function markThreadRead(req, res, next) {
  try {
    const thread = await Thread.findOne({ dsrNo: req.params.dsrNo }).select('_id').lean();
    if (!thread) return res.json({ ok: true });
    await Notification.updateMany(
      { userId: req.user._id, read: false, refType: 'thread', refId: thread._id },
      { read: true }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { unreadCount, list, markRead, markAllRead, threadUnreadCounts, markThreadRead };
