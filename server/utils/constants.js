// Single source of truth for roles, hierarchy, and workflow enums.
// Order in ROLE_LEVEL matters: index = depth in the org chain (0 = top).
const ROLES = {
  admin: 'Administrator',
  sales_head: 'Sales Head',
  teams_head: 'Teams Head',
  team_leader: 'Team Leader',
  agent: 'Sales Agent',
  backoffice: 'Back Office',
  accountant: 'Accountant',
  hr: 'HR',
};

// The reporting chain roles walk through (agent -> team_leader -> teams_head -> sales_head).
// Used to build managerChain on User save.
const CHAIN_ROLES = ['team_leader', 'teams_head', 'sales_head'];

// Nested permission tree - every module, plus its tabs/functionality, as its own None/View/Edit
// key. A child key (e.g. 'hr.addEmployee') is checked exactly the same way as a top-level module
// key by canView/canEdit - it's just a more specific entry in the same flat view/edit lists, so
// no separate storage or check logic is needed for nesting. Displayed nested under its parent in
// Admin > Permissions.
const PERMISSION_TREE = [
  { key: 'dash', label: 'Dashboard' },
  { key: 'dsr', label: 'DSR — Agent' },
  {
    key: 'pipeline',
    label: 'Sales Pipeline',
    children: [{ key: 'pipeline.approve', label: 'Approve / Reject Deals (Team Leader)' }],
  },
  {
    key: 'backoffice',
    label: 'Back Office / Orders',
    children: [{ key: 'backoffice.statusChange', label: 'Change Order Status' }],
  },
  { key: 'mis', label: 'MIS & Targets' },
  {
    key: 'hr',
    label: 'HR',
    children: [
      { key: 'hr.dashboard', label: 'Dashboard' },
      { key: 'hr.allEmployees', label: 'All Employees' },
      { key: 'hr.activeEmployees', label: 'Active Employees' },
      { key: 'hr.teamAssignment', label: 'Team Assignment' },
      { key: 'hr.passportManagement', label: 'Passport Management' },
      { key: 'hr.addEmployee', label: 'Add Employee' },
    ],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    children: [
      { key: 'payroll.run', label: 'Payroll Run' },
      { key: 'payroll.ledger', label: 'Employee Ledger' },
      { key: 'payroll.process', label: 'Process Payroll Runs' },
      { key: 'payroll.delete', label: 'Delete Payroll Runs' },
      { key: 'payroll.commissionTiers', label: 'Commission Rules' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    children: [
      { key: 'accounting.chartOfAccounts', label: 'Chart of Accounts' },
      { key: 'accounting.expenses', label: 'Company Expenses' },
      { key: 'accounting.cheques', label: 'Cheques' },
    ],
  },
  { key: 'ai', label: 'AI Reports' },
  {
    key: 'products',
    label: 'Products & Segments',
    children: [
      { key: 'products.products', label: 'Products' },
      { key: 'products.segments', label: 'Segments' },
    ],
  },
  { key: 'admin', label: 'Admin / Settings' },
];

const MODULES = PERMISSION_TREE.map((m) => m.key);
const ALL_PERMISSION_KEYS = PERMISSION_TREE.flatMap((m) => [m.key, ...(m.children || []).map((c) => c.key)]);

const MODULE_ACCESS_DEFAULT = {
  admin: ['dash', 'dsr', 'pipeline', 'backoffice', 'mis', 'hr', 'payroll', 'accounting', 'ai', 'products', 'admin'],
  sales_head: ['dash', 'pipeline', 'mis', 'ai', 'products'],
  teams_head: ['dash', 'pipeline', 'mis', 'ai', 'products'],
  team_leader: ['dash', 'dsr', 'pipeline', 'mis', 'ai', 'products'],
  agent: ['dash', 'dsr', 'pipeline', 'products'],
  backoffice: ['dash', 'backoffice', 'mis', 'ai', 'products'],
  accountant: ['dash', 'accounting', 'payroll', 'ai'],
  hr: ['dash', 'hr', 'payroll', 'ai'],
};

const MODULE_EDIT_DEFAULT = {
  admin: ['dsr', 'pipeline', 'backoffice', 'hr', 'payroll', 'accounting', 'products', 'admin'],
  sales_head: ['pipeline'],
  teams_head: ['pipeline'],
  team_leader: ['dsr', 'pipeline'],
  agent: ['dsr', 'pipeline'],
  backoffice: ['backoffice'],
  accountant: ['payroll', 'accounting'],
  // 'payroll' here only unlocks payroll.commissionTiers below - every other payroll edit action
  // (process/delete/ledger) stays admin/accountant-only via SENSITIVE_ACTION_GRANTS stripping it
  // back out for any role not explicitly listed there.
  hr: ['payroll'],
};

// A role that can view/edit a module gets every tab under it by default too (admin can narrow
// this later in Permissions) - EXCEPT the small set of dangerous action children below, which
// stay locked down even for someone with full module edit, until explicitly granted.
function expandWithChildren(moduleAccessByRole) {
  const out = {};
  Object.keys(moduleAccessByRole).forEach((role) => {
    const set = new Set();
    moduleAccessByRole[role].forEach((key) => {
      set.add(key);
      const section = PERMISSION_TREE.find((m) => m.key === key);
      (section?.children || []).forEach((c) => set.add(c.key));
    });
    out[role] = [...set];
  });
  return out;
}

// Restrictive edit-only overrides for specific dangerous actions - having module edit is not
// enough on its own, matching the previous standalone "actions" permission axis.
const SENSITIVE_ACTION_GRANTS = {
  'hr.addEmployee': ['admin', 'hr'],
  'payroll.process': ['admin', 'accountant'],
  'payroll.delete': ['admin'],
  'payroll.ledger': ['admin', 'accountant'],
  'payroll.commissionTiers': ['admin', 'hr'],
  'pipeline.approve': ['admin', 'sales_head', 'teams_head', 'team_leader'],
  'backoffice.statusChange': ['admin', 'backoffice'],
};

const ACCESS_DEFAULT = expandWithChildren(MODULE_ACCESS_DEFAULT);
const EDIT_ACCESS_DEFAULT = expandWithChildren(MODULE_EDIT_DEFAULT);

Object.keys(ROLES).forEach((role) => {
  Object.entries(SENSITIVE_ACTION_GRANTS).forEach(([key, grantedRoles]) => {
    if (!grantedRoles.includes(role)) {
      EDIT_ACCESS_DEFAULT[role] = (EDIT_ACCESS_DEFAULT[role] || []).filter((k) => k !== key);
    }
  });
});

// Matches how agents actually log call outcomes (from the working reference trackers), grouped
// loosely positive -> follow-up -> not-reached -> negative. Order here drives the dropdown order
// on the frontend too, so the common ones agents pick most aren't buried alphabetically.
const CALL_STATUS = [
  'Interested', 'FollowUp', '10% Followup Customer', 'Given to TL Followup', 'Connected', 'Lead Generated',
  'Call back later', 'Online meeting', 'Visited Face to Face', 'Cold calling visit',
  'Using etisalat', 'Using DU',
  'No answer', 'Voicemail', 'Not Connected', 'Switch off', 'No response', 'Number not in use',
  'Not interested',
];

// Statuses where the agent never actually reached/spoke to anyone - used to auto-derive the
// `connected` YES/NO flag on a DSR record.
const NOT_CONNECTED_STATUSES = ['No answer', 'Voicemail', 'Number not in use', 'Not Connected', 'Switch off', 'No response'];

// Percentage sales-progress stages - matches the original prototype and the real trackers
// exactly (agents/TLs move a deal through these directly; this is separate from the TL
// approval workflow, see APPROVAL_STATUS below).
const PIPE_STAGES = ['10%- Prospect', '30% - Value Prop', '50% - Negotiation', '70% - Finalizing', '90% - Closing', '100% - Deal Won', '0% - Lost'];

// The optional TL sign-off workflow - independent of the deal's sales-progress stage. An agent
// can ask their TL to review/approve a deal at any point; reaching 100% also opens an order
// regardless of approval state. See services/workflow.js.
const APPROVAL_STATUS = ['none', 'pending_tl', 'approved', 'rejected'];

const ORDER_STATUS = ['New', 'E& In-process', 'On Hold', 'Activated', 'Closed', 'Cancelled'];

// Modules that support bulk Import/Export of records (from the real Excel trackers). Kept as its
// own axis from view/edit - a user can be able to see and edit a module's records one-by-one in
// the UI without being allowed to bulk-import/export the underlying data.
const IMPORT_EXPORT_MODULES = ['dsr', 'pipeline', 'backoffice', 'hr'];

// Nobody gets import/export by default except admin - it's a bulk data operation (can move a lot
// of records/PII at once), so every other role has to be explicitly granted it per module via
// Admin > Permissions rather than inheriting it from view/edit access.
// UAE employment compliance flags (HR / Employee profile) — simple Yes/No, not a status enum;
// an optional supporting document can be attached whenever the answer is "Yes" (see docsSchema's
// legalCaseDoc / abscondingMohreDoc / abscondingGdrfaDoc in models/User.js).
const ABSCONDING_STATUS = ['No', 'Yes'];
const LEGAL_CASE_STATUS = ['No', 'Yes'];

const IMPORT_EXPORT_DEFAULT = {
  admin: ['dsr', 'pipeline', 'backoffice', 'hr'],
  sales_head: [],
  teams_head: [],
  team_leader: [],
  agent: [],
  backoffice: [],
  accountant: [],
  hr: [],
};

module.exports = {
  ROLES,
  CHAIN_ROLES,
  PERMISSION_TREE,
  MODULES,
  ALL_PERMISSION_KEYS,
  ACCESS_DEFAULT,
  EDIT_ACCESS_DEFAULT,
  CALL_STATUS,
  NOT_CONNECTED_STATUSES,
  PIPE_STAGES,
  APPROVAL_STATUS,
  ORDER_STATUS,
  IMPORT_EXPORT_MODULES,
  IMPORT_EXPORT_DEFAULT,
  ABSCONDING_STATUS,
  LEGAL_CASE_STATUS,
};
