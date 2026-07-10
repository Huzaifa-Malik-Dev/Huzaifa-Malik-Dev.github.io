// Shared initial/reset shape for the compliance sub-object — used by both the Add Employee
// wizard and EmployeeDetailPage's edit form so the two can never drift out of sync on field names.
export const EMPTY_COMPLIANCE = {
  dob: '', nationality: '', uid: '', passportNo: '', passportExpiry: '',
  visaCompany: '', visaFileNumber: '', visaIssue: '', visaExpiry: '',
  eid: '', eidIssue: '', eidExpiry: '', labourCardNo: '', labourCardIssue: '', labourCardExpiry: '',
  insuranceIssue: '', insuranceExpiry: '',
  legalCaseStatus: 'No', legalCaseNote: '',
  abscondingMohre: 'No', abscondingMohreNote: '',
  abscondingGdrfa: 'No', abscondingGdrfaNote: '',
};

// Simple Yes/No flags, not a status enum — an optional supporting document can be attached
// whenever the answer is "Yes" (see EmployeeDetailPage's Legal Case / Absconding cards).
export const LEGAL_CASE_STATUS = ['No', 'Yes'];
export const ABSCONDING_STATUS = ['No', 'Yes'];

// UAE labour law sets the minimum working age at 18 — flag it as a soft warning (not a hard
// block) since the form may be entering historical records or the field may still be mid-edit.
export function isUnderage(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || '')) return false;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age < 18;
}
