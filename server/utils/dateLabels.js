// Derives a human-readable "Month YYYY" label from a plain 'YYYY-MM-DD' date string - used for
// Order's read-only Activation Month / Submission Month fields (see orderController.js).
//
// Deliberately NOT a Mongoose virtual: every list/export path in this app uses .lean(), and
// virtuals don't survive .lean() - the field would silently vanish from exactly the places it
// matters most (the table column and the export sheet). Applied as a post-query enrichment
// instead, same shape as services/recordViews.js's attachIsNew.
//
// Never stored on the document either: always recomputed from actDate/subDate, so it can't drift
// out of sync with them and there's no schema path a client could ever set it through.
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m] = dateStr.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return '';
  return `${MONTH_NAMES[idx]} ${y}`;
}

module.exports = { monthLabel };
