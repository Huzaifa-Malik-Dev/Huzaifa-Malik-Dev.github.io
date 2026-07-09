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
