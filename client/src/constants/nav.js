import { LayoutDashboard, Phone, Workflow, ClipboardCheck, BarChart3, Users, Wallet, Calculator, Sparkles, Package, Settings, CalendarDays, ClipboardList } from 'lucide-react';

// Labels/icons/routes only — actual access per user comes from /auth/me (server-resolved).
// `children` (where present) are nested tabs/functionality within that module — each has its
// own None/View/Edit permission (see Admin > Permissions), same key space as the parent module,
// just checked via a more specific dotted key (e.g. user.editModules.includes('hr.addEmployee')).
// `badgeKey` (where present) makes the item show a live count of records you haven't opened yet —
// exactly the rows that page highlights as new, so the badge and the highlighting always agree
// (see server/controllers/viewController.js unreadCounts). Its value is the record-view module
// name, which is what the count endpoint keys by — hence 'backoffice' badges on module 'orders'.
// A record never counts for whoever created it. Adding a badge to another module means adding it
// to VIEW_TRACKED_MODULES (services/recordViews.js) and the count endpoint too.
export const NAV_ITEMS = [
  { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { key: 'dsr', label: 'DSR — Agent', icon: Phone, path: '/dsr', badgeKey: 'dsr' },
  {
    key: 'pipeline', label: 'Sales Pipeline', icon: Workflow, path: '/pipeline', badgeKey: 'pipeline',
    children: [
      { key: 'pipeline.approve', label: 'Approve / Reject Deals (Team Leader)' },
      { key: 'pipeline.approveCancellation', label: 'Approve / Reject Order Cancellation (Sales Head)' },
    ],
  },
  {
    key: 'backoffice', label: 'Back Office / Orders', icon: ClipboardCheck, path: '/backoffice', badgeKey: 'orders',
    children: [{ key: 'backoffice.statusChange', label: 'Change Order Status' }],
  },
  { key: 'mis', label: 'MIS & Targets', icon: BarChart3, path: '/mis' },
  {
    key: 'hr', label: 'HR', icon: Users, path: '/hr',
    children: [
      { key: 'hr.dashboard', label: 'Dashboard' },
      { key: 'hr.allEmployees', label: 'All Employees' },
      { key: 'hr.activeEmployees', label: 'Active Employees' },
      { key: 'hr.teamAssignment', label: 'Team Assignment' },
      { key: 'hr.addEmployee', label: 'Add Employee' },
    ],
  },
  {
    key: 'payroll', label: 'Payroll', icon: Wallet, path: '/payroll',
    children: [
      { key: 'payroll.run', label: 'Payroll Run' },
      { key: 'payroll.ledger', label: 'Employee Ledger' },
      { key: 'payroll.process', label: 'Process Payroll Runs' },
      { key: 'payroll.delete', label: 'Delete Payroll Runs' },
    ],
  },
  {
    key: 'accounting', label: 'Accounting', icon: Calculator, path: '/accounting',
    children: [
      { key: 'accounting.chartOfAccounts', label: 'Chart of Accounts & Banking' },
      { key: 'accounting.expenses', label: 'Company Expenses' },
      { key: 'accounting.cheques', label: 'Cheques' },
      { key: 'accounting.journal', label: 'Journal Entries' },
      { key: 'accounting.reports', label: 'Financial Reports' },
    ],
  },
  {
    key: 'leave', label: 'Leave', icon: CalendarDays, path: '/leave',
    children: [
      { key: 'leave.approve', label: 'Approve / Reject Team Leave' },
      { key: 'leave.settings', label: 'Leave Types & Holidays' },
    ],
  },
  {
    key: 'attendance', label: 'Attendance', icon: ClipboardList, path: '/attendance',
    children: [{ key: 'attendance.manage', label: 'Mark Attendance (HR/Admin)' }],
  },
  { key: 'ai', label: 'AI Reports', icon: Sparkles, path: '/ai' },
  { key: 'products', label: 'Products', icon: Package, path: '/products' },
  { key: 'admin', label: 'Admin / Settings', icon: Settings, path: '/admin' },
];

export const ROLE_LABELS = {
  admin: 'Administrator',
  sales_head: 'Sales Head',
  teams_head: 'Teams Head',
  team_leader: 'Team Leader',
  agent: 'Sales Agent',
  backoffice: 'Back Office',
  accountant: 'Accountant',
  hr: 'HR',
};
