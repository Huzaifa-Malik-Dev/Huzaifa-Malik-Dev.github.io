const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule, requireAction } = require('../middlewares/rbac');
const {
  preview,
  process,
  deleteRun,
  listRuns,
  getRun,
  listLedger,
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  listCommissionTiers,
  createCommissionTier,
  updateCommissionTier,
  deleteCommissionTier,
} = require('../controllers/payrollController');

const router = express.Router();
router.use(requireAuth, requireModule('payroll'));

router.get('/preview', requireModule('payroll', { edit: true }), requireAction('payroll.process'), preview);
router.post('/runs', requireModule('payroll', { edit: true }), requireAction('payroll.process'), process);
router.delete('/runs/:id', requireModule('payroll', { edit: true }), requireAction('payroll.delete'), deleteRun);
router.get('/runs', listRuns);
router.get('/runs/:id', getRun);

router.get('/ledger', listLedger);
router.post('/ledger', requireModule('payroll', { edit: true }), requireAction('payroll.ledger'), createLedgerEntry);
router.patch('/ledger/:id', requireModule('payroll', { edit: true }), requireAction('payroll.ledger'), updateLedgerEntry);
router.delete('/ledger/:id', requireModule('payroll', { edit: true }), requireAction('payroll.ledger'), deleteLedgerEntry);

router.get('/commission-tiers', listCommissionTiers);
router.post('/commission-tiers', requireModule('payroll', { edit: true }), requireAction('payroll.commissionTiers'), createCommissionTier);
router.patch('/commission-tiers/:id', requireModule('payroll', { edit: true }), requireAction('payroll.commissionTiers'), updateCommissionTier);
router.delete('/commission-tiers/:id', requireModule('payroll', { edit: true }), requireAction('payroll.commissionTiers'), deleteCommissionTier);

module.exports = router;
