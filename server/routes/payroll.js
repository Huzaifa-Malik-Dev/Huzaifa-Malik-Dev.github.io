const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule, requireAction } = require('../middlewares/rbac');
const { preview, process, deleteRun, listRuns, getRun, listLedger, createLedgerEntry } = require('../controllers/payrollController');

const router = express.Router();
router.use(requireAuth, requireModule('payroll'));

router.get('/preview', requireModule('payroll', { edit: true }), requireAction('payroll.process'), preview);
router.post('/runs', requireModule('payroll', { edit: true }), requireAction('payroll.process'), process);
router.delete('/runs/:id', requireModule('payroll', { edit: true }), requireAction('payroll.delete'), deleteRun);
router.get('/runs', listRuns);
router.get('/runs/:id', getRun);

router.get('/ledger', listLedger);
router.post('/ledger', requireModule('payroll', { edit: true }), createLedgerEntry);

module.exports = router;
