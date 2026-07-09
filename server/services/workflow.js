const Dsr = require('../models/Dsr');
const Pipeline = require('../models/Pipeline');
const Order = require('../models/Order');
const User = require('../models/User');
const { notify } = require('./notify');
const AppError = require('../utils/AppError');

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

// Agent converts an "Interested" DSR into a pipeline opportunity, starting at 10%-Prospect.
async function convertToPipeline(dsrId, extra, actor) {
  const dsr = await Dsr.findById(dsrId);
  if (!dsr) throw new AppError('DSR not found', 404);

  const allowed =
    actor.role === 'admin' ||
    [dsr.tlId, dsr.teamHeadId, dsr.salesHeadId, dsr.agentId].some((id) => String(id) === String(actor._id));
  if (!allowed) throw new AppError('You cannot convert this DSR', 403);

  if (dsr.status !== 'Interested') throw new AppError('Only "Interested" DSRs can be converted to pipeline', 400);
  if (dsr.convertedToPipeline) throw new AppError('This DSR is already in the pipeline', 400);

  // Atomically claim the DSR before creating the Pipeline: a matching filter on
  // convertedToPipeline:false means only one concurrent request can flip it, so a duplicate
  // Pipeline can never be created for the same DSR even under a race.
  const claimed = await Dsr.findOneAndUpdate(
    { _id: dsrId, status: 'Interested', convertedToPipeline: { $ne: true } },
    { $set: { convertedToPipeline: true } },
    { new: true }
  );
  if (!claimed) throw new AppError('This DSR is already in the pipeline', 400);

  const mrc = (extra.qty || 1) * (extra.price || 0);
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
    cat: extra.cat || '',
    product: extra.product || '',
    sr: extra.sr || '',
    price: extra.price || 0,
    qty: extra.qty || 1,
    mrc,
    annual: mrc * 12,
    stage: '10%- Prospect',
    remarks: extra.remarks || '',
    history: [{ userId: actor._id, text: 'Converted from DSR to pipeline' }],
    });
  } catch (err) {
    // Pipeline creation failed after the DSR was already claimed — release the claim so the
    // DSR isn't left permanently locked with no pipeline behind it.
    await Dsr.updateOne({ _id: dsrId }, { $set: { convertedToPipeline: false } });
    throw err;
  }

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
  let order = await Order.findOne({ pipelineId: pipeline._id });
  if (order) {
    order.qty = pipeline.qty;
    order.mrc = pipeline.mrc;
    order.cat = pipeline.cat;
    order.product = pipeline.product;
    order.history.push({ userId: actor._id, text: reasonText });
    await order.save();
    return order;
  }

  try {
    order = await Order.create({
      pipelineId: pipeline._id,
      dsrNo: pipeline.dsrNo,
      agentId: pipeline.agentId,
      tlId: pipeline.tlId,
      teamHeadId: pipeline.teamHeadId,
      salesHeadId: pipeline.salesHeadId,
      // Customer is optional on the DSR/Pipeline (a deal can be logged before a contact name is
      // known) but required on Order - fall back to the company name rather than crash, since
      // Company is always present by this point.
      customer: pipeline.customer || pipeline.company,
      cat: pipeline.cat,
      product: pipeline.product,
      qty: pipeline.qty,
      mrc: pipeline.mrc,
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

  pipeline.approval = 'pending_tl';
  pipeline.history.push({ userId: actor._id, text: 'Requested Team Leader approval' });
  await pipeline.save();

  await notify(pipeline.tlId, `${actor.name} needs your approval on ${pipeline.dsrNo} (${pipeline.company})`, {
    refType: 'pipeline',
    refId: pipeline._id,
  });
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
  pipeline.history.push({ userId: actor._id, text: 'Approved by Team Leader — sent to Back Office' });
  await pipeline.save();

  await notify(pipeline.agentId, `Your deal ${pipeline.dsrNo} was approved and sent to Back Office`, {
    refType: 'pipeline',
    refId: pipeline._id,
  });

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
  return pipeline;
}

// Back Office moves an order through its lifecycle. Any status transition is allowed here —
// UAE order processing doesn't follow a strict linear path (can go On Hold and back, etc.).
async function updateOrderStatus(orderId, status, actor, extra = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);

  const allowed = actor.role === 'admin' || actor.role === 'backoffice';
  if (!allowed) throw new AppError('Only Back Office can update order status', 403);

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
  return order;
}

module.exports = {
  convertToPipeline,
  escalateToTL,
  tlApprove,
  tlReject,
  ensureOrderForPipeline,
  updateOrderStatus,
};
