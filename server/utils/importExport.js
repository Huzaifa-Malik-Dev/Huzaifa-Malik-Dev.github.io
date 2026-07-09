const XLSX = require('xlsx');

// columns: [{ header: 'Company', key: 'company' }] or [{ header: 'Agent', get: (row) => row.agentId?.name }]
function buildWorkbook(rows, columns, sheetName = 'Sheet1') {
  const data = rows.map((row) => {
    const out = {};
    columns.forEach((col) => {
      out[col.header] = typeof col.get === 'function' ? col.get(row) : row[col.key];
    });
    return out;
  });
  const sheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function sendXlsx(res, filename, rows, columns, sheetName) {
  const buffer = buildWorkbook(rows, columns, sheetName);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

// Reads the first sheet into an array of { header: value } objects, matching whatever header
// row is actually in the file (round-trips with buildWorkbook's `header` values).
function parseXlsxBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

// Looks up a value in a parsed row by header name, tolerant of case/whitespace differences
// between what we exported and what a human re-typed/re-ordered in Excel.
function cell(row, header) {
  const target = header.trim().toLowerCase();
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === target);
  return key ? String(row[key]).trim() : '';
}

// Resolves which agent an imported row belongs to. Agents importing their own file don't need to
// specify anyone; anyone importing on behalf of others (admin/TL bulk upload) must identify the
// agent — by email OR username, since seeded/real users don't always have an email on file.
async function resolveAgentFromRow(raw, actor, User) {
  if (actor.role === 'agent') return { agent: actor };

  const email = cell(raw, 'Agent Email').toLowerCase();
  const username = cell(raw, 'Agent Username').toLowerCase();
  if (!email && !username) {
    return { error: 'Agent Email or Agent Username is required when importing on behalf of others' };
  }

  const agent = await User.findOne(email ? { email } : { username });
  if (!agent) {
    return { error: `No user found for Agent ${email ? `Email "${email}"` : `Username "${username}"`}` };
  }
  return { agent };
}

module.exports = { buildWorkbook, sendXlsx, parseXlsxBuffer, cell, resolveAgentFromRow };
