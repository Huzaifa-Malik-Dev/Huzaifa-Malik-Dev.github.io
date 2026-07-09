const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule } = require('../middlewares/rbac');
const {
  listAccounts,
  createAccount,
  updateAccount,
  accountTransactions,
  recordTransaction,
  listExpenses,
  createExpense,
  listCheques,
  createCheque,
  updateCheque,
  updateChequeStatus,
  summary,
} = require('../controllers/accountingController');

const router = express.Router();
router.use(requireAuth, requireModule('accounting'));

router.get('/summary', summary);

router.get('/accounts', listAccounts);
router.post('/accounts', requireModule('accounting', { edit: true }), createAccount);
router.patch('/accounts/:id', requireModule('accounting', { edit: true }), updateAccount);
router.get('/accounts/:id/transactions', accountTransactions);

router.post('/transactions', requireModule('accounting', { edit: true }), recordTransaction);

router.get('/expenses', listExpenses);
router.post('/expenses', requireModule('accounting', { edit: true }), createExpense);

router.get('/cheques', listCheques);
router.post('/cheques', requireModule('accounting', { edit: true }), createCheque);
router.patch('/cheques/:id', requireModule('accounting', { edit: true }), updateCheque);
router.patch('/cheques/:id/status', requireModule('accounting', { edit: true }), updateChequeStatus);

module.exports = router;
