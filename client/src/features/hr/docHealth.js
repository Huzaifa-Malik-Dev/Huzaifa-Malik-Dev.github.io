// Shared expiry-badge logic for UAE compliance docs (passport/visa/EID/labour card/insurance).
// Mirrors the original prototype's 30-day "expiring soon" threshold.
export function docHealth(expiry) {
  if (!expiry) return { level: 'missing', label: 'Missing', color: 'gray' };
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  if (expiry < today) return { level: 'expired', label: 'Expired', color: 'red' };
  if (expiry <= in30Str) return { level: 'expiring', label: 'Expiring soon', color: 'yellow' };
  return { level: 'good', label: 'Valid', color: 'green' };
}

// Worst-case compliance level across all tracked documents for one employee - drives the
// "flagged" KPI and the roster's overall Compliance column.
export function overallHealth(compliance = {}) {
  const levels = [
    docHealth(compliance.passportExpiry).level,
    docHealth(compliance.visaExpiry).level,
    docHealth(compliance.eidExpiry).level,
    docHealth(compliance.labourCardExpiry).level,
    docHealth(compliance.insuranceExpiry).level,
  ];
  if (levels.includes('expired')) return 'expired';
  if (levels.includes('expiring')) return 'expiring';
  if (levels.includes('missing')) return 'missing';
  return 'good';
}
