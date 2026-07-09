const Notification = require('../models/Notification');
const { nextSeq } = require('../models/Counter');

// Writes the notification to the durable log first — this write IS the guarantee.
// Any real-time push later (socket/SSE) is purely a latency optimization on top of this;
// the client's afterSeq catch-up query always reconciles against this collection.
async function notify(userIds, text, { refType = '', refId = null } = {}) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const docs = [];
  for (const userId of ids) {
    if (!userId) continue;
    const seq = await nextSeq('notification');
    docs.push({ seq, userId, text, refType, refId });
  }
  if (docs.length) await Notification.insertMany(docs);
  return docs;
}

module.exports = { notify };
