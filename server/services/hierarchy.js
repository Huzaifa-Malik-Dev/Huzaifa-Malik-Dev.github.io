const User = require('../models/User');
const AssignmentHistory = require('../models/AssignmentHistory');
const AppError = require('../utils/AppError');

// Walks reportsTo up to the top and returns the ancestor chain as an array of ObjectIds,
// immediate manager first. This is stamped onto the user so role-scoped queries
// (e.g. "everyone under this Team Head") are a single indexed match, never a recursive walk.
async function buildManagerChain(reportsToId) {
  const chain = [];
  let current = reportsToId;
  let guard = 0;
  while (current && guard < 10) {
    const manager = await User.findById(current).select('reportsTo').lean();
    if (!manager) break;
    chain.push(manager._id);
    current = manager.reportsTo;
    guard += 1;
  }
  return chain;
}

// Re-stamps managerChain (current-state only, not history) for every descendant of a user
// whose position in the chain changed — so live rollup queries stay correct immediately.
async function rebuildDescendantChains(userId) {
  const directReports = await User.find({ reportsTo: userId }).select('_id').lean();
  for (const report of directReports) {
    const chain = await buildManagerChain(userId);
    await User.updateOne({ _id: report._id }, { managerChain: [userId, ...chain] });
    await rebuildDescendantChains(report._id);
  }
}

// Opens the first AssignmentHistory row for a brand-new user (called from user creation / seed).
async function createInitialAssignment(user, changedBy = null) {
  await AssignmentHistory.create({
    userId: user._id,
    role: user.role,
    reportsTo: user.reportsTo || null,
    startDate: user.join ? new Date(user.join) : new Date(),
    endDate: null,
    changedBy,
  });
}

// The single entry point for changing a user's role and/or manager. Closes the currently-open
// history row, opens a new one, updates the live User doc, and re-stamps descendants' chains.
// Never mutate role/reportsTo directly on User outside this function — history would go stale.
async function reassignUser(userId, { role, reportsTo }, changedBy = null) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const newRole = role || user.role;
  const newReportsTo = reportsTo !== undefined ? reportsTo : user.reportsTo;

  if (newReportsTo) {
    if (String(newReportsTo) === String(userId)) {
      throw new AppError('A user cannot report to themselves', 400);
    }
    // Walk the proposed manager's own chain up to the top — if this user appears anywhere in
    // it, assigning them would create a cycle (this user would end up reporting to their own
    // descendant), which buildManagerChain's depth guard would otherwise mask instead of reject.
    let current = newReportsTo;
    let guard = 0;
    while (current && guard < 20) {
      if (String(current) === String(userId)) {
        throw new AppError('This assignment would create a reporting-chain cycle', 400);
      }
      const manager = await User.findById(current).select('reportsTo').lean();
      if (!manager) break;
      current = manager.reportsTo;
      guard += 1;
    }
  }

  const now = new Date();
  await AssignmentHistory.updateMany(
    { userId: user._id, endDate: null },
    { endDate: now }
  );
  await AssignmentHistory.create({
    userId: user._id,
    role: newRole,
    reportsTo: newReportsTo || null,
    startDate: now,
    endDate: null,
    changedBy,
  });

  const chain = await buildManagerChain(newReportsTo);
  user.role = newRole;
  user.reportsTo = newReportsTo || null;
  user.managerChain = chain;
  await user.save();

  await rebuildDescendantChains(user._id);
  return user;
}

module.exports = { buildManagerChain, rebuildDescendantChains, createInitialAssignment, reassignUser };
