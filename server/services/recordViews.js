const RecordView = require('../models/RecordView');

// Modules this feature is wired into - kept as an explicit allowlist (not "any string goes")
// so a typo'd module name from the client fails loudly instead of silently creating junk rows.
const VIEW_TRACKED_MODULES = ['dsr', 'pipeline', 'orders'];

// Idempotent - repeat views of the same record are a no-op, not a new row or an updated
// timestamp (the first-ever view is what matters for "new", not the most recent one).
async function markViewed(userId, module, recordId) {
  await RecordView.updateOne(
    { userId, module, recordId },
    { $setOnInsert: { userId, module, recordId } },
    { upsert: true }
  );
}

// Bulk counterpart for import paths, which create hundreds of records in one go - one bulkWrite
// instead of one round-trip per row.
async function markManyViewed(userId, module, recordIds) {
  if (!recordIds.length) return;
  await RecordView.bulkWrite(
    recordIds.map((recordId) => ({
      updateOne: {
        filter: { userId, module, recordId },
        update: { $setOnInsert: { userId, module, recordId } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

// Whoever creates a record has, by definition, already seen it - so it must never come back to
// them highlighted as "new". Called at every creation point (dsrController.create/importDsr,
// workflow.convertToPipeline/ensureOrderForPipeline, pipelineController.importPipeline,
// orderController.createDirect) rather than special-cased at read time, because "creator" isn't
// always the record's agentId: a TL can log a DSR for one of their agents, and a TL approving a
// deal is what opens the Order. Deliberately fire-and-forget - a failed view-marker is a cosmetic
// highlight, never worth failing the creation it describes.
function markCreatedByMe(userId, module, recordId) {
  markViewed(userId, module, recordId).catch((err) =>
    console.error(`[recordViews] failed to mark ${module} ${recordId} viewed for its creator:`, err.message)
  );
}

// Returns the subset of recordIds this user has already viewed in this module, as a Set of
// string ids - callers treat "not in the set" as "new".
async function getViewedSet(userId, module, recordIds) {
  if (!recordIds.length) return new Set();
  const rows = await RecordView.find({ userId, module, recordId: { $in: recordIds } })
    .select('recordId')
    .lean();
  return new Set(rows.map((r) => String(r.recordId)));
}

// Attaches `isNew` to each row of an already-fetched, already-paginated list - the one call site
// every list controller needs, so nobody has to repeat the Set-building dance themselves.
async function attachIsNew(userId, module, rows) {
  const viewed = await getViewedSet(userId, module, rows.map((r) => r._id));
  return rows.map((r) => ({ ...r, isNew: !viewed.has(String(r._id)) }));
}

// How many records in `scope` this user has never opened - the number behind each sidebar badge
// (see controllers/viewController.js), counting exactly the rows the list would highlight as new.
// One aggregation per module: a $lookup against recordviews, keeping only the misses.
async function countUnread(Model, userId, module, scope) {
  const rows = await Model.aggregate([
    { $match: scope },
    {
      $lookup: {
        from: 'recordviews',
        let: { rid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ['$recordId', '$$rid'] }, { $eq: ['$userId', userId] }, { $eq: ['$module', module] }] },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'seen',
      },
    },
    { $match: { seen: { $size: 0 } } },
    { $count: 'n' },
  ]);
  return rows[0]?.n || 0;
}

module.exports = { VIEW_TRACKED_MODULES, markViewed, markManyViewed, markCreatedByMe, getViewedSet, attachIsNew, countUnread };
