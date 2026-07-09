import { useEffect, useState } from 'react';
import { TextInput } from '@mantine/core';
import { Calendar } from 'lucide-react';

// Accepts dd/mm/yy, dd/mm/yyyy, dd-mm-yyyy, or dd-mm-yy typed or pasted freely (plus the app's own
// yyyy-mm-dd passing through unchanged), normalized to yyyy-mm-dd on blur/Enter. An unparsable or
// calendar-invalid value (e.g. 31/02/2026) is cleared rather than silently kept wrong, since every
// date-range report in this app (Dashboard/MIS/AI) compares this field as a plain ISO string.
const SLASH_OR_DASH = [
  { re: /^(\d{2})[/-](\d{2})[/-](\d{4})$/, yearIdx: 3 }, // dd/mm/yyyy or dd-mm-yyyy
  { re: /^(\d{2})[/-](\d{2})[/-](\d{2})$/, yearIdx: 3 }, // dd/mm/yy or dd-mm-yy
];

function parseFlexDate(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed; // already ISO — pass through

  for (const { re } of SLASH_OR_DASH) {
    const m = trimmed.match(re);
    if (!m) continue;
    const [, ddStr, mmStr, yyStr] = m;
    const year = yyStr.length === 2 ? (Number(yyStr) <= 69 ? `20${yyStr}` : `19${yyStr}`) : yyStr;
    const day = Number(ddStr);
    const month = Number(mmStr);
    if (month < 1 || month > 12) return null;
    const daysInMonth = new Date(Number(year), month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

function isoToDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function FlexDateInput({ value, onChange, label, required, readOnly, size, ...rest }) {
  const [text, setText] = useState(isoToDisplay(value));

  // Keep the displayed text in sync when the underlying form value changes from outside
  // (e.g. loading an existing record into the edit form) rather than from this input's own typing.
  useEffect(() => {
    setText(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = () => {
    const parsed = parseFlexDate(text);
    if (parsed) {
      setText(isoToDisplay(parsed));
      onChange(parsed);
    } else {
      setText('');
      onChange('');
    }
  };

  return (
    <TextInput
      label={label}
      required={required}
      readOnly={readOnly}
      size={size}
      placeholder="dd/mm/yyyy"
      leftSection={<Calendar size={16} />}
      value={text}
      onChange={(e) => setText(e.currentTarget.value)}
      onBlur={readOnly ? undefined : commit}
      onKeyDown={readOnly ? undefined : (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      {...rest}
    />
  );
}
