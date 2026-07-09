const { pageSizeDefault, pageSizeMax } = require('../config/env');

// Reads page/limit/sort from the query string and returns Mongoose-ready options,
// capped by PAGE_SIZE_MAX so nobody can request ?limit=100000 and blow up the server.
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(pageSizeMax, Math.max(1, parseInt(query.limit, 10) || pageSizeDefault));
  const skip = (page - 1) * limit;

  let sort = { createdAt: -1 };
  if (query.sort) {
    const desc = query.sort.startsWith('-');
    const field = desc ? query.sort.slice(1) : query.sort;
    sort = { [field]: desc ? -1 : 1 };
  }

  return { page, limit, skip, sort };
}

// Standard shape every paginated list endpoint returns — the frontend (MRT + TanStack Query)
// is built once against this contract and reused for every module.
function buildPageResponse(data, totalRowCount, page, limit) {
  return { data, meta: { totalRowCount, page, limit } };
}

module.exports = { parsePagination, buildPageResponse };
