// Order cancellation lives on its own router, mounted at the same /orders base path as
// routes/orders.js but WITHOUT that router's blanket requireModule('backoffice') gate.
//
// Why: the cancellation workflow is the one Back Office flow whose participants sit outside Back
// Office. The Sales Head who must approve/reject has no `backoffice` module access at all (see
// MODULE_ACCESS_DEFAULT in utils/constants.js), and neither do the agents/TLs who raise the
// request - so nesting these under routes/orders.js would make them unreachable for everyone
// except Back Office itself.
//
// Authorization is not weakened, just moved to where it can be precise: every handler resolves
// the order and checks the actor against that order's own agentId/tlId/salesHeadId inside
// services/workflow.js. Approve/reject additionally sit behind the pipeline.approveCancellation
// action grant (admin + sales_head only) as the coarse first layer, matching the two-layer pattern
// pipeline.approve / leave.approve already use.
//
// These work off the ORDER's own id (not a pipelineId), so they're also the only cancellation path
// that covers directly-created Back Office orders - which have no Pipeline record behind them.
const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireAction } = require('../middlewares/rbac');
const { requestCancellation, approveCancellation, rejectCancellation } = require('../controllers/orderController');

const router = express.Router();
router.use(requireAuth);

router.post('/:id/request-cancellation', requestCancellation);
router.post('/:id/approve-cancellation', requireAction('pipeline.approveCancellation'), approveCancellation);
router.post('/:id/reject-cancellation', requireAction('pipeline.approveCancellation'), rejectCancellation);

module.exports = router;
