const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const { getSummary, getPendingCancellations } = require('../controllers/dashboardController');

const router = express.Router();
router.use(requireAuth, requireModule('dash'));

router.get('/summary', getSummary);
// Deliberately gated by 'dash' alone (inherited from the router above) rather than an approval
// action grant - the handler itself returns an empty list to anyone who isn't the Sales Head/admin,
// so this is a read-only "is there anything for me here" check, not the approval action itself
// (that's routes/orderCancellations.js, behind pipeline.approveCancellation).
router.get('/pending-cancellations', getPendingCancellations);

module.exports = router;
