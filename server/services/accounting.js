const Account = require('../models/Account');
const AccountTx = require('../models/AccountTx');

async function accountBalance(accountId) {
  const account = await Account.findById(accountId).lean();
  if (!account) return 0;
  const rows = await AccountTx.find({ account: accountId }).select('amount').lean();
  return account.opening + rows.reduce((sum, tx) => sum + tx.amount, 0);
}

// Every money movement in/out of an account goes through this - manual transactions,
// expenses, and cheque clearance all call it so the running balance is always
// opening + sum(accountTx.amount) with no separate code path to drift out of sync.
async function postAccountTx({ account, date, type, amount, note = '', refType = '', refId = null, createdBy = null }) {
  return AccountTx.create({ account, date, type, amount, note, refType, refId, createdBy });
}

module.exports = { accountBalance, postAccountTx };
