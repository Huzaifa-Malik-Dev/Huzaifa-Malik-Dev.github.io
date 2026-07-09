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

const MODULES = ['dash', 'dsr', 'pipeline', 'backoffice', 'mis', 'hr', 'payroll', 'accounting', 'ai', 'products', 'admin'];

const ACCESS_DEFAULT = {
  admin: ['dash', 'dsr', 'pipeline', 'backoffice', 'mis', 'hr', 'payroll', 'accounting', 'ai', 'products', 'admin'],
  sales_head: ['dash', 'pipeline', 'mis', 'ai', 'products'],
  teams_head: ['dash', 'pipeline', 'mis', 'ai', 'products'],
  team_leader: ['dash', 'dsr', 'pipeline', 'mis', 'ai', 'products'],
  agent: ['dash', 'dsr', 'pipeline', 'products'],
  backoffice: ['dash', 'backoffice', 'mis', 'ai', 'products'],
  accountant: ['dash', 'accounting', 'payroll', 'ai'],
  hr: ['dash', 'hr', 'payroll', 'ai'],
};

const EDIT_ACCESS_DEFAULT = {
  admin: ['dsr', 'pipeline', 'backoffice', 'hr', 'payroll', 'accounting', 'products', 'admin'],
  sales_head: ['pipeline'],
  teams_head: ['pipeline'],
  team_leader: ['dsr', 'pipeline'],
  agent: ['dsr', 'pipeline'],
  backoffice: ['backoffice'],
  accountant: ['payroll', 'accounting'],
  hr: [],
};

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
const IMPORT_EXPORT_MODULES = ['dsr', 'pipeline', 'backoffice'];

// Nobody gets import/export by default except admin - it's a bulk data operation (can move a lot
// of records/PII at once), so every other role has to be explicitly granted it per module via
// Admin > Permissions rather than inheriting it from view/edit access.
// UAE employment compliance statuses (HR / Employee profile).
const ABSCONDING_STATUS = ['None', 'Reported', 'Cleared'];
const LEGAL_CASE_STATUS = ['None', 'Pending', 'Resolved'];

// Fine-grained permissions for specific dangerous/restricted actions that don't map cleanly to
// "edit this module" - e.g. someone can see the Payroll module and its history without being
// allowed to actually process or delete a run. A user without one of these never sees the
// corresponding button at all (see middlewares/rbac.js requireAction + the client checks that
// mirror it), not just get blocked after clicking.
const ACTIONS = [
  { key: 'hr.addEmployee', label: 'Add Employees', module: 'hr' },
  { key: 'payroll.process', label: 'Process Payroll Runs', module: 'payroll' },
  { key: 'payroll.delete', label: 'Delete Payroll Runs', module: 'payroll' },
];
const ACTION_KEYS = ACTIONS.map((a) => a.key);

// Deliberately conservative: only admin + the role that already "owns" that module by default
// gets the matching action out of the box. payroll.delete (destructive, no undo) is admin-only
// until an admin explicitly grants it - unlike process, it was never possible before this existed
// so there's no prior behavior to preserve.
const ACTIONS_DEFAULT = {
  admin: ACTION_KEYS,
  sales_head: [],
  teams_head: [],
  team_leader: [],
  agent: [],
  backoffice: [],
  accountant: ['payroll.process'],
  hr: ['hr.addEmployee'],
};

const IMPORT_EXPORT_DEFAULT = {
  admin: ['dsr', 'pipeline', 'backoffice'],
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
  MODULES,
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
  ACTIONS,
  ACTION_KEYS,
  ACTIONS_DEFAULT,
};
