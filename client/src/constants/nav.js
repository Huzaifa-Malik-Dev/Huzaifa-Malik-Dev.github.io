import { LayoutDashboard, Phone, Workflow, ClipboardCheck, BarChart3, Users, Wallet, Calculator, Sparkles, Package, Settings } from 'lucide-react';

// Labels/icons/routes only — actual access per user comes from /auth/me (server-resolved).
export const NAV_ITEMS = [
  { key: 'dash', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { key: 'dsr', label: 'DSR — Agent', icon: Phone, path: '/dsr' },
  { key: 'pipeline', label: 'Sales Pipeline', icon: Workflow, path: '/pipeline' },
  { key: 'backoffice', label: 'Back Office / Orders', icon: ClipboardCheck, path: '/backoffice' },
  { key: 'mis', label: 'MIS & Targets', icon: BarChart3, path: '/mis' },
  { key: 'hr', label: 'HR', icon: Users, path: '/hr' },
  { key: 'payroll', label: 'Payroll', icon: Wallet, path: '/payroll' },
  { key: 'accounting', label: 'Accounting', icon: Calculator, path: '/accounting' },
  { key: 'ai', label: 'AI Reports', icon: Sparkles, path: '/ai' },
  { key: 'products', label: 'Products & Segments', icon: Package, path: '/products' },
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
