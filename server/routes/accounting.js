const express = require('express');
const requireAuth = require('../middlewares/auth');
const { requireModule, requireAction } = require('../middlewares/rbac');
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
router.post('/accounts', requireAction('accounting.chartOfAccounts'), createAccount);
router.patch('/accounts/:id', requireAction('accounting.chartOfAccounts'), updateAccount);
router.get('/accounts/:id/transactions', accountTransactions);

router.post('/transactions', requireAction('accounting.chartOfAccounts'), recordTransaction);

router.get('/expenses', listExpenses);
router.post('/expenses', requireAction('accounting.expenses'), createExpense);

router.get('/cheques', listCheques);
router.post('/cheques', requireAction('accounting.cheques'), createCheque);
router.patch('/cheques/:id', requireAction('accounting.cheques'), updateCheque);
router.patch('/cheques/:id/status', requireAction('accounting.cheques'), updateChequeStatus);

module.exports = router;
