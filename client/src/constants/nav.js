import { LayoutDashboard, Phone, Workflow, ClipboardCheck, BarChart3, Users, Wallet, Calculator, Sparkles, Package, Settings } from 'lucide-react';

// Labels/icons/routes only — actual access per user comes from /auth/me (server-resolved).
// `children` (where present) are nested tabs/functionality within that module — each has its
// own None/View/Edit permission (see Admin > Permissions), same key space as the parent module,
// just checked via a more specific dotted key (e.g. user.editModules.includes('hr.addEmployee')).
export const NAV_ITEMS = [
  { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { key: 'dsr', label: 'DSR — Agent', icon: Phone, path: '/dsr' },
  {
    key: 'pipeline', label: 'Sales Pipeline', icon: Workflow, path: '/pipeline',
    children: [{ key: 'pipeline.approve', label: 'Approve / Reject Deals (Team Leader)' }],
  },
  {
    key: 'backoffice', label: 'Back Office / Orders', icon: ClipboardCheck, path: '/backoffice',
    children: [{ key: 'backoffice.statusChange', label: 'Change Order Status' }],
  },
  { key: 'mis', label: 'MIS & Targets', icon: BarChart3, path: '/mis' },
  {
    key: 'hr', label: 'HR', icon: Users, path: '/hr',
    children: [
      { key: 'hr.allEmployees', label: 'All Employees' },
      { key: 'hr.activeEmployees', label: 'Active Employees' },
      { key: 'hr.teamAssignment', label: 'Team Assignment' },
      { key: 'hr.passportManagement', label: 'Passport Management' },
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
      { key: 'accounting.chartOfAccounts', label: 'Chart of Accounts' },
      { key: 'accounting.expenses', label: 'Company Expenses' },
      { key: 'accounting.cheques', label: 'Cheques' },
    ],
  },
  { key: 'ai', label: 'AI Reports', icon: Sparkles, path: '/ai' },
  {
    key: 'products', label: 'Products & Segments', icon: Package, path: '/products',
    children: [
      { key: 'products.products', label: 'Products' },
      { key: 'products.segments', label: 'Segments' },
    ],
  },
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
