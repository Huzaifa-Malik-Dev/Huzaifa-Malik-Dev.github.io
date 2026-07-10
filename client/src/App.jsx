import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './features/auth/LoginPage';
import DsrPage from './features/dsr/DsrPage';
import PipelinePage from './features/pipeline/PipelinePage';
import BackofficePage from './features/backoffice/BackofficePage';
import DashboardPage from './features/dashboard/DashboardPage';
import MisPage from './features/mis/MisPage';
import AgentPerformancePage from './features/mis/AgentPerformancePage';
import AiReportPage from './features/ai/AiReportPage';
import HrPage from './features/hr/HrPage';
import EmployeeDetailPage from './features/hr/EmployeeDetailPage';
import EmployeeLedgerPage from './features/hr/EmployeeLedgerPage';
import AddEmployeePage from './features/hr/AddEmployeePage';
import AccountingPage from './features/accounting/AccountingPage';
import PayrollPage from './features/payroll/PayrollPage';
import AdminPage from './features/admin/AdminPage';
import ProductsPage from './features/products/ProductsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route element={<ProtectedRoute module="dsr" />}>
            <Route path="/dsr" element={<DsrPage />} />
          </Route>
          <Route element={<ProtectedRoute module="pipeline" />}>
            <Route path="/pipeline" element={<PipelinePage />} />
          </Route>
          <Route element={<ProtectedRoute module="backoffice" />}>
            <Route path="/backoffice" element={<BackofficePage />} />
          </Route>
          <Route element={<ProtectedRoute module="mis" />}>
            <Route path="/mis" element={<MisPage />} />
            <Route path="/mis/:id" element={<AgentPerformancePage />} />
          </Route>
          <Route element={<ProtectedRoute module="ai" />}>
            <Route path="/ai" element={<AiReportPage />} />
          </Route>
          <Route element={<ProtectedRoute module="hr" />}>
            <Route path="/hr" element={<HrPage />} />
            <Route path="/hr/new" element={<AddEmployeePage />} />
            <Route path="/hr/employees/:employeeId" element={<EmployeeDetailPage />} />
            <Route path="/hr/employees/:employeeId/ledger" element={<EmployeeLedgerPage />} />
          </Route>
          <Route element={<ProtectedRoute module="accounting" />}>
            <Route path="/accounting" element={<AccountingPage />} />
          </Route>
          <Route element={<ProtectedRoute module="payroll" />}>
            <Route path="/payroll" element={<PayrollPage />} />
          </Route>
          <Route element={<ProtectedRoute module="products" />}>
            <Route path="/products" element={<ProductsPage />} />
          </Route>
          <Route element={<ProtectedRoute module="admin" />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
