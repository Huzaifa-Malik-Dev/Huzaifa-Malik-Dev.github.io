const Dsr = require('../models/Dsr');
const Pipeline = require('../models/Pipeline');
const Order = require('../models/Order');
const User = require('../models/User');
const { notify } = require('./notify');
const AppError = require('../utils/AppError');
const { logActivity } = require('../utils/activityLog');
const { generateOrderNo } = require('../utils/orderNo');
const { PIPELINE_REQUIRED_FOR_APPROVAL, ORDER_DONE_STATUSES } = require('../utils/constants');
const { recomputeLineItems } = require('../utils/lineItems');
const { markCreatedByMe } = require('./recordViews');

function missingPipelineFields(pipeline) {
  const missing = Object.entries(PIPELINE_REQUIRED_FOR_APPROVAL)
    .filter(([key]) => {
      const value = pipeline[key];
      return !value || !String(value).trim();
    })
    .map(([, label]) => label);

  // Line-item completeness is no longer a flat field check - a deal needs at least one block, and
  // every block/row in it needs to be filled in, before it can go to Team Leader approval.
  const lineItems = pipeline.lineItems || [];
  if (!lineItems.length) {
    missing.push('Line Items (at least one Category/Product/Subscription Type block)');
  } else {
    lineItems.forEach((block, i) => {
      const label = `Block ${i + 1}`;
      if (!block.cat) missing.push(`${label}: Category`);
      if (!block.product) missing.push(`${label}: Product`);
      if (!block.sr) missing.push(`${label}: Subscription Type`);
      (block.rows || []).forEach((row, j) => {
        if (!(Number(row.price) > 0)) missing.push(`${label}, Row ${j + 1}: Unit Price`);
        if (!(Number(row.qty) >= 1)) missing.push(`${label}, Row ${j + 1}: Quantity`);
      });
    });
  }
  return missing;
}

// Central state machine for DSR -> Pipeline -> Order. The client never sets a stage directly;
// every transition goes through one of these functions so the rules are enforced in one place
// and every hop is written to history + notified.
//
// Pipeline has two independent axes, matching how the business actually tracks deals:
//  - `stage`: sales-progress percentage (10%-Prospect ... 100%-Deal Won / 0%-Lost), freely
//    edited by the agent/TL as the deal moves - see pipelineController.update.
//  - `approval`: an optional TL sign-off workflow (none -> pending_tl -> approved/rejected)
//    that an agent can invoke at any point to get their TL to review the deal.
// A Back Office order is opened the moment EITHER the TL approves OR the deal reaches 100% -
// whichever happens first - so both paths converge on the same order (ensureOrderForPipeline).

// Agent converts a "Lead Generated" DSR into a pipeline opportunity, starting at 10%-Prospect.
async function convertToPipeline(dsrId, extra, actor) {
  const dsr = await Dsr.findById(dsrId);
  if (!dsr) throw new AppError('DSR not found', 404);

  const allowed =
    actor.role === 'admin' ||
    [dsr.tlId, dsr.teamHeadId, dsr.salesHeadId, dsr.agentId].some((id) => String(id) === String(actor._id));
  if (!allowed) throw new AppError('You cannot convert this DSR', 403);

  if (dsr.status !== 'Lead Generated') throw new AppError('Only "Lead Generated" DSRs can be converted to pipeline', 400);
  if (dsr.convertedToPipeline) throw new AppError('This DSR is already in the pipeline', 400);

  // Atomically claim the DSR before creating the Pipeline: a matching filter on
  // convertedToPipeline:false means only one concurrent request can flip it, so a duplicate
  // Pipeline can never be created for the same DSR even under a race.
  const claimed = await Dsr.findOneAndUpdate(
    { _id: dsrId, status: 'Lead Generated', convertedToPipeline: { $ne: true } },
    { $set: { convertedToPipeline: true } },
    { new: true }
  );
  if (!claimed) throw new AppError('This DSR is already in the pipeline', 400);

  const { lineItems, mrc } = recomputeLineItems(extra.lineItems);
  let pipeline;
  try {
    pipeline = await Pipeline.create({
    dsrId: dsr._id,
    dsrNo: dsr.dsrNo,
    agentId: dsr.agentId,
    tlId: dsr.tlId,
    teamHeadId: dsr.teamHeadId,
    salesHeadId: dsr.salesHeadId,
    company: dsr.company,
    customer: dsr.customer,
    email: extra.email || '',
    contactNo: dsr.contactNo || '',
    lineItems,
    mrc,
    annual: mrc * 12,
    stage: '10%- Prospect',
    // Started Date is the date the deal entered the pipeline - set once here, never editable
    // afterward (see pipelineController.updateSchema).
    startedDate: new Date().toISOString().slice(0, 10),
    remarks: extra.remarks || '',
    history: [{ userId: actor._id, text: 'Converted from DSR to pipeline' }],
    });
  } catch (err) {
    // Pipeline creation failed after the DSR was already claimed — release the claim so the
    // DSR isn't left permanently locked with no pipeline behind it.
    await Dsr.updateOne({ _id: dsrId }, { $set: { convertedToPipeline: false } });
    throw err;
  }
  markCreatedByMe(actor._id, 'pipeline', pipeline._id);

  logActivity(actor, `converted DSR ${dsr.dsrNo} to pipeline deal — Company: ${pipeline.company}, MRC: ${pipeline.mrc}`);
  return pipeline;
}

function assertActorIsTlOrAbove(pipeline, actor) {
  const allowed = actor.role === 'admin' || String(pipeline.tlId) === String(actor._id);
  if (!allowed) throw new AppError('Only the assigned Team Leader can act on this deal', 403);
}

function assertActorIsOwnerOrAbove(pipeline, actor) {
  const allowed =
    actor.role === 'admin' || String(pipeline.tlId) === String(actor._id) || String(pipeline.agentId) === String(actor._id);
  if (!allowed) throw new AppError('You cannot act on this deal', 403);
}

// Opens (or, if one already exists for this deal, updates) the Back Office order - shared by
// both ways a deal can reach Back Office: TL approval, or hitting 100%-Deal Won.
async function ensureOrderForPipeline(pipeline, actor, reasonText) {
  // Rebuilt fresh (not pipeline.lineItems directly) so Mongoose assigns the Order its own
  // subdocument _ids rather than reusing the Pipeline's - see utils/lineItems.js.
  const { lineItems, mrc } = recomputeLineItems(pipeline.lineItems);

  let order = await Order.findOne({ pipelineId: pipeline._id });
  if (order) {
    order.lineItems = lineItems;
    order.mrc = mrc;
    order.email = pipeline.email || order.email;
    order.contactNo = pipeline.contactNo || order.contactNo;
    order.history.push({ userId: actor._id, text: reasonText });
    await order.save();
    return order;
  }

  try {
    order = await Order.create({
      pipelineId: pipeline._id,
      dsrNo: pipeline.dsrNo,
      orderNo: await generateOrderNo(),
      agentId: pipeline.agentId,
      tlId: pipeline.tlId,
      teamHeadId: pipeline.teamHeadId,
      salesHeadId: pipeline.salesHeadId,
      // Customer is optional on the DSR/Pipeline (a deal can be logged before a contact name is
      // known) but required on Order - fall back to the company name rather than crash, since
      // Company is always present by this point.
      customer: pipeline.customer || pipeline.company,
      email: pipeline.email || '',
      contactNo: pipeline.contactNo || '',
      lineItems,
      mrc,
      status: 'New',
      history: [{ userId: actor._id, text: reasonText }],
    });
  } catch (err) {
    // Unique index on pipelineId means a concurrent request already created the order — fetch
    // and return that one instead of erroring out or creating a duplicate.
    if (err.code === 11000) {
      order = await Order.findOne({ pipelineId: pipeline._id });
      if (order) return order;
    }
    throw err;
  }
  // The TL approving (or the agent hitting 100%) is what opens this order - it's not "new" to
  // them. It stays new for Back Office, who are the ones being notified about it below.
  markCreatedByMe(actor._id, 'orders', order._id);

  const backOfficeUsers = await User.find({ role: 'backoffice', active: true }).select('_id').lean();
  await notify(
    backOfficeUsers.map((u) => u._id),
    `New order ${pipeline.dsrNo} from ${pipeline.company} — ready to process`,
    { refType: 'order', refId: order._id }
  );
  return order;
}

// Agent asks their TL to review the deal. Independent of sales-progress stage.
async function escalateToTL(pipelineId, actor) {
  const pipeline = await Pipeline.findById(pipelineId);
  if (!pipeline) throw new AppError('Pipeline item not found', 404);
  if (pipeline.approval === 'pending_tl') throw new AppError('This deal is already awaiting Team Leader approval', 400);
  assertActorIsOwnerOrAbove(pipeline, actor);
  if (!pipeline.tlId) throw new AppError('This deal has no assigned Team Leader to escalate to', 400);

  const missing = missingPipelineFields(pipeline);
  if (missing.length) {
    throw new AppError(`Save these required fields before requesting approval: ${missing.join(', ')}`, 400);
  }

  pipeline.approval = 'pending_tl';
  pipeline.history.push({ userId: actor._id, text: 'Requested Team Leader approval' });
  await pipeline.save();

  await notify(pipeline.tlId, `${actor.name} needs your approval on ${pipeline.dsrNo} (${pipeline.company})`, {
    refType: 'pipeline',
    refId: pipeline._id,
  });
  logActivity(actor, `requested Team Leader approval on deal ${pipeline.dsrNo} (${pipeline.company})`);
  return pipeline;
}

async function tlApprove(pipelineId, actor) {
  const pipeline = await Pipeline.findById(pipelineId);
  if (!pipeline) throw new AppError('Pipeline item not found', 404);
  if (pipeline.approval !== 'pending_tl') throw new AppError('This deal is not awaiting approval', 400);
  assertActorIsTlOrAbove(pipeline, actor);

  // Order must exist before the pipeline is saved as approved — otherwise a failure here would
  // leave the deal permanently stuck "approved" with no order behind it.
  const order = await ensureOrderForPipeline(pipeline, actor, 'Order opened — Team Leader approved the deal');

  pipeline.approval = 'approved';
  // Sent-to-Back-Office is treated as 90% Closing on the sales-progress axis - unless the deal
  // already reached 100%-Deal Won on its own, in which case approval shouldn't regress it.
  if (pipeline.stage !== '100% - Deal Won') pipeline.stage = '90% - Closing';
  pipeline.history.push({ userId: actor._id, text: 'Approved by Team Leader — sent to Back Office' });
  await pipeline.save();

  await notify(pipeline.agentId, `Your deal ${pipeline.dsrNo} was approved and sent to Back Office`, {
    refType: 'pipeline',
    refId: pipeline._id,
  });

  logActivity(actor, `approved deal ${pipeline.dsrNo} (${pipeline.company}) — order opened for Back Office`);
  return { pipeline, order };
}

async function tlReject(pipelineId, actor, reason) {
  const pipeline = await Pipeline.findById(pipelineId);
  if (!pipeline) throw new AppError('Pipeline item not found', 404);
  if (pipeline.approval !== 'pending_tl') throw new AppError('This deal is not awaiting approval', 400);
  assertActorIsTlOrAbove(pipeline, actor);

  pipeline.approval = 'rejected';
  pipeline.history.push({ userId: actor._id, text: `Rejected by Team Leader${reason ? ': ' + reason : ''}` });
  await pipeline.save();

  await notify(pipeline.agentId, `Your deal ${pipeline.dsrNo} was rejected by your Team Leader`, {
    refType: 'pipeline',
    refId: pipeline._id,
  });
  logActivity(actor, `rejected deal ${pipeline.dsrNo} (${pipeline.company})${reason ? ' — Reason: ' + reason : ''}`);
  return pipeline;
}

// Back Office moves an order through its lifecycle. Any status transition is allowed here —
// UAE order processing doesn't follow a strict linear path (can go On Hold and back, etc.) —
// except once an order is Linked (see setOrderLinked below - the successor to the old 'In Line'
// status): it's closed, and the only further transition is to 'Cancelled'. Admins can still
// override, same as the Cheques status flow, for correcting a mis-marked order.
async function updateOrderStatus(orderId, status, actor, extra = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const allowed = actor.role === 'admin' || actor.role === 'backoffice';
  if (!allowed) throw new AppError('Only Back Office can update order status', 403);

  if (order.linked === 'Linked' && actor.role !== 'admin' && status !== 'Cancelled') {
    throw new AppError('This order is Linked and closed — it can only be moved to Cancelled from here', 400);
  }
  // A pending correction request means the agent/TL is about to rework this deal in Pipeline -
  // changing the order's status in the meantime would race against that. Locked for everyone,
  // including admin: sendOrderBackToPipeline is the only sanctioned way past this.
  if (order.correctionRequested) {
    throw new AppError('This order is on hold pending a correction request — send it back to Pipeline before changing its status', 400);
  }
  // Same reasoning for a pending cancellation request - approveOrderCancellation/
  // rejectOrderCancellation are the only sanctioned way past this, so the two request types can
  // never race against an unrelated status change.
  if (order.cancellationRequested) {
    throw new AppError('This order is on hold pending a cancellation request — it must be approved or rejected before changing its status', 400);
  }

  const oldStatus = order.status;
  order.status = status;
  if (extra.eOrderNo !== undefined) order.eOrderNo = extra.eOrderNo;
  if (extra.actDate !== undefined) order.actDate = extra.actDate;
  if (extra.remarks !== undefined) order.remarks = extra.remarks;
  order.history.push({ userId: actor._id, text: `Status updated to ${status}` });
  await order.save();

  await notify([order.agentId, order.tlId].filter(Boolean), `Order ${order.dsrNo} is now "${status}"`, {
    refType: 'order',
    refId: order._id,
  });
  logActivity(actor, `changed order ${order.dsrNo} status: ${oldStatus} -> ${status}`);
  return order;
}

// Sets the post-completion Linked/Not Linked reconciliation flag - the successor to the old
// 'In Line'/'Not In Line' ORDER_STATUS values. Kept as its own dedicated function (not a plain
// field on the general update()) because, like `status`, it carries a lock once set to 'Linked'.
async function setOrderLinked(orderId, linked, actor) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const allowed = actor.role === 'admin' || actor.role === 'backoffice';
  if (!allowed) throw new AppError("Only Back Office can set an order's Linked status", 403);

  if (order.linked === 'Linked' && actor.role !== 'admin') {
    throw new AppError('This order is Linked and closed — only an admin can change this now', 400);
  }
  if (order.correctionRequested) {
    throw new AppError('This order is on hold pending a correction request — send it back to Pipeline before changing Linked status', 400);
  }
  if (order.cancellationRequested) {
    throw new AppError('This order is on hold pending a cancellation request — it must be approved or rejected before changing Linked status', 400);
  }
  if (linked === 'Linked' && !ORDER_DONE_STATUSES.includes(order.status)) {
    throw new AppError(`Only Activated/Closed orders can be marked Linked (current status: ${order.status})`, 400);
  }

  const old = order.linked;
  order.linked = linked;
  order.history.push({ userId: actor._id, text: `Linked status updated: ${old || '(not set)'} -> ${linked || '(not set)'}` });
  await order.save();

  await notify([order.agentId, order.tlId].filter(Boolean), `Order ${order.dsrNo} Linked status is now "${linked || '(not set)'}"`, {
    refType: 'order',
    refId: order._id,
  });
  logActivity(actor, `changed order ${order.dsrNo} Linked status: ${old || '(not set)'} -> ${linked || '(not set)'}`);
  return order;
}

// An agent (or their TL) who spots a mistake after the deal has already locked in Back Office has
// no other way to get it fixed — this is that escape hatch. Flags the order red for Back Office
// rather than reopening anything itself; only Back Office deciding to act on it
// (sendOrderBackToPipeline) actually unlocks the underlying deal.
async function requestOrderCorrection(orderId, actor, note) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status === 'Cancelled') throw new AppError('This order is cancelled — nothing to correct', 400);
  // Activated/Linked means the order has already gone live with Etisalat - it's done, not a
  // mistake to unwind through the normal correction loop. An admin can still fix a genuine error
  // directly on the order itself; this only blocks the agent-initiated request-correction path.
  if (actor.role !== 'admin' && (order.status === 'Activated' || order.linked === 'Linked')) {
    throw new AppError('This order is already Activated/Linked and cannot be sent back for correction', 400);
  }

  const allowed =
    actor.role === 'admin' || String(order.agentId) === String(actor._id) || String(order.tlId) === String(actor._id);
  if (!allowed) throw new AppError('You cannot request a correction on this order', 403);
  if (order.correctionRequested) throw new AppError('A correction has already been requested for this order', 400);
  // Mutually exclusive with a pending cancellation request - the two request types are never
  // allowed to be pending at once, so sendOrderBackToPipeline and approve/rejectOrderCancellation
  // never race toward two unrelated outcomes on the same order.
  if (order.cancellationRequested) {
    throw new AppError('This order already has a pending cancellation request — resolve that first before requesting a correction', 400);
  }

  order.correctionRequested = true;
  order.correctionRequestedBy = actor._id;
  order.correctionRequestedAt = new Date();
  order.correctionNote = note || '';
  order.history.push({ userId: actor._id, text: `Requested correction${note ? ': ' + note : ''}` });
  await order.save();

  const backOfficeUsers = await User.find({ role: 'backoffice', active: true }).select('_id').lean();
  await notify(
    backOfficeUsers.map((u) => u._id),
    `${actor.name} flagged order ${order.dsrNo} as needing correction`,
    { refType: 'order', refId: order._id }
  );
  logActivity(actor, `requested correction on order ${order.dsrNo}${note ? ' — Note: ' + note : ''}`);
  return order;
}

// Back Office acting on a flagged correction request - unlocks the underlying Pipeline deal
// (resets approval so the agent/TL can edit it again through the normal flow) without touching
// the order's own status or deleting anything. The order stays exactly where it is, just marked -
// correctionCount is the durable "how many times has this happened" counter the client dims/badges
// the row with, and it survives being handled (unlike correctionRequested, which clears).
async function sendOrderBackToPipeline(orderId, actor) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const allowed = actor.role === 'admin' || actor.role === 'backoffice';
  if (!allowed) throw new AppError('Only Back Office can send an order back to Pipeline', 403);
  if (!order.correctionRequested) throw new AppError('No correction has been requested for this order', 400);
  if (!order.pipelineId) throw new AppError('This order has no backing Pipeline deal to send back to (it was added directly)', 400);

  const pipeline = await Pipeline.findById(order.pipelineId);
  if (!pipeline) throw new AppError('The backing Pipeline deal no longer exists', 404);

  pipeline.approval = 'none';
  // Unconditional - always reset to 70% - Finalizing here, regardless of what stage the deal was
  // at before (including 100% - Deal Won), so a corrected deal always re-enters the "closing"
  // part of the funnel rather than sitting wherever it happened to be.
  pipeline.stage = '70% - Finalizing';
  pipeline.history.push({ userId: actor._id, text: `Sent back for correction by ${actor.name} — deal is editable again, stage reset to 70% - Finalizing` });
  await pipeline.save();

  order.correctionCount += 1;
  order.correctionRequested = false;
  order.correctionRequestedBy = null;
  order.correctionRequestedAt = null;
  order.history.push({ userId: actor._id, text: `Sent back to Pipeline stage for correction (#${order.correctionCount})` });
  await order.save();

  await notify(pipeline.agentId, `Your deal ${pipeline.dsrNo} was sent back for correction — you can edit it again`, {
    refType: 'pipeline',
    refId: pipeline._id,
  });
  logActivity(actor, `sent order ${order.dsrNo} back to Pipeline for correction (occurrence #${order.correctionCount})`);
  return order;
}

// Order cancellation - agent/TL/admin request with a mandatory reason, the order freezes (same
// class of lock as correctionRequested: blocks status/field edits, no admin bypass), and the
// order's own snapshotted Sales Head (or admin) approves or rejects. Approving actually cancels
// the order; rejecting just unfreezes it - status is never touched during the pending window, so
// there's nothing to restore. Deliberately not blocked by `linked === 'Linked'` - cancellation was
// always the one escape hatch even from a locked order (see updateOrderStatus's own carve-out).
async function requestOrderCancellation(orderId, actor, reason) {
  if (!reason || !reason.trim()) throw new AppError('A reason is required to request order cancellation', 400);
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.status === 'Cancelled') throw new AppError('This order is already cancelled', 400);

  const allowed =
    actor.role === 'admin' || actor.role === 'backoffice' || String(order.agentId) === String(actor._id) || String(order.tlId) === String(actor._id);
  if (!allowed) throw new AppError('You cannot request cancellation on this order', 403);

  if (order.cancellationRequested) throw new AppError('A cancellation has already been requested for this order', 400);
  if (order.correctionRequested) {
    throw new AppError('This order already has a pending correction request — resolve that first before requesting cancellation', 400);
  }
  if (!order.salesHeadId) throw new AppError('This order has no assigned Sales Head to approve the cancellation', 400);

  order.cancellationRequested = true;
  order.cancellationRequestedBy = actor._id;
  order.cancellationRequestedAt = new Date();
  order.cancellationReason = reason;
  order.history.push({ userId: actor._id, text: `Requested cancellation: ${reason}` });
  await order.save();

  await notify(order.salesHeadId, `${actor.name} requested cancellation of order ${order.dsrNo} — ${reason}`, {
    refType: 'order',
    refId: order._id,
  });
  logActivity(actor, `requested cancellation of order ${order.dsrNo} — Reason: ${reason}`);
  return order;
}

function assertActorIsSalesHeadOrAdmin(order, actor) {
  const allowed = actor.role === 'admin' || String(order.salesHeadId) === String(actor._id);
  if (!allowed) throw new AppError('Only the assigned Sales Head can act on this cancellation request', 403);
}

async function approveOrderCancellation(orderId, actor) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (!order.cancellationRequested) throw new AppError('No cancellation has been requested for this order', 400);
  assertActorIsSalesHeadOrAdmin(order, actor);

  const oldStatus = order.status;
  order.status = 'Cancelled';
  order.cancellationRequested = false;
  order.cancellationRequestedBy = null;
  order.cancellationRequestedAt = null;
  order.history.push({ userId: actor._id, text: `Cancellation approved by ${actor.name} — order cancelled (was ${oldStatus})` });
  await order.save();

  await notify([order.agentId, order.tlId].filter(Boolean), `Order ${order.dsrNo} was cancelled — approved by ${actor.name}`, {
    refType: 'order',
    refId: order._id,
  });
  logActivity(actor, `approved cancellation of order ${order.dsrNo} (was ${oldStatus})`);
  return order;
}

async function rejectOrderCancellation(orderId, actor, reason) {
  if (!reason || !reason.trim()) throw new AppError('A reason is required to reject a cancellation request', 400);
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (!order.cancellationRequested) throw new AppError('No cancellation has been requested for this order', 400);
  assertActorIsSalesHeadOrAdmin(order, actor);

  order.cancellationRequested = false;
  order.cancellationRequestedBy = null;
  order.cancellationRequestedAt = null;
  order.cancellationRejectionReason = reason;
  order.history.push({ userId: actor._id, text: `Cancellation rejected by ${actor.name} — ${reason}` });
  await order.save();

  await notify([order.agentId, order.tlId].filter(Boolean), `Cancellation request for order ${order.dsrNo} was rejected by ${actor.name} — ${reason}`, {
    refType: 'order',
    refId: order._id,
  });
  logActivity(actor, `rejected cancellation of order ${order.dsrNo} — Reason: ${reason}`);
  return order;
}

module.exports = {
  convertToPipeline,
  escalateToTL,
  tlApprove,
  tlReject,
  ensureOrderForPipeline,
  updateOrderStatus,
  setOrderLinked,
  requestOrderCorrection,
  sendOrderBackToPipeline,
  requestOrderCancellation,
  approveOrderCancellation,
  rejectOrderCancellation,
};
