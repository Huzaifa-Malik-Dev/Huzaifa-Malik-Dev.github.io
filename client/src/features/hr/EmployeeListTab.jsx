import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ActionIcon, Menu } from '@mantine/core';
import { EllipsisVertical, Wallet, Pencil } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchEmployees } from '../../api/hr';
import { ROLE_LABELS } from '../../constants/nav';
import { docHealth, overallHealth } from './docHealth';
import { employeeUrlId } from './employeeUrl';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLOR = { Active: 'green', Inactive: 'gray', Frozen: 'blue', Absconding: 'red' };

function StatusBadge({ row }) {
  const status = row.status || (row.active !== false ? 'Active' : 'Inactive');
  return <Badge color={STATUS_COLOR[status] || 'gray'} variant="light">{status}</Badge>;
}

// Shown to everyone who can see the row at all (not just editors) - clicking the row itself
// already opens the profile (see goView below), so this menu covers the two actions that
// aren't one click away: jumping straight to this person's ledger, and editing (edit-gated).
function RowMenu({ row, canEdit, canViewLedger, navigate }) {
  const id = employeeUrlId(row.employeeId);
  return (
    <Menu shadow="md" width={180} position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          radius="md"
          onClick={(e) => e.stopPropagation()}
          aria-label="Row actions"
        >
          <EllipsisVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        {canViewLedger && (
          <Menu.Item leftSection={<Wallet size={14} />} onClick={() => navigate(`/hr/employees/${id}/ledger`)}>
            Employee Ledger
          </Menu.Item>
        )}
        {canEdit && (
          <Menu.Item leftSection={<Pencil size={14} />} onClick={() => navigate(`/hr/employees/${id}?edit=1`)}>
            Edit
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

export default function EmployeeListTab({ activeOnly = false, mode = 'general', canEdit }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewLedger = user.modules?.includes('payroll');
  const goView = (row) => navigate(`/hr/employees/${employeeUrlId(row.employeeId)}`);

  const list = usePagedList(['hr', 'employees', activeOnly, mode], fetchEmployees, {
    filters: activeOnly ? { active: 'true' } : {},
  });

  const generalColumns = useMemo(
    () => [
      { accessorKey: 'employeeId', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'desig', header: 'Designation' },
      { accessorKey: 'dept', header: 'Department' },
      { accessorKey: 'role', header: 'Role', cell: (info) => ROLE_LABELS[info.getValue()] || info.getValue() },
      { accessorKey: 'join', header: 'Join Date' },
      {
        id: 'compliance',
        header: 'Compliance',
        cell: (info) => {
          const level = overallHealth(info.row.original.compliance);
          const color = { good: 'green', expiring: 'yellow', expired: 'red', missing: 'gray' }[level];
          const label = { good: 'Good', expiring: 'Expiring', expired: 'Expired', missing: 'Incomplete' }[level];
          return <Badge color={color} variant="light">{label}</Badge>;
        },
      },
      {
        id: 'active',
        header: 'Status',
        cell: (info) => <StatusBadge row={info.row.original} />,
      },
      {
        id: 'action',
        header: 'Actions',
        cell: (info) => <RowMenu row={info.row.original} canEdit={canEdit} canViewLedger={canViewLedger} navigate={navigate} />,
      },
    ],
    [canEdit, canViewLedger, navigate]
  );

  const passportColumns = useMemo(
    () => [
      { accessorKey: 'employeeId', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'compliance.passportNo', header: 'Passport No.', cell: (info) => info.row.original.compliance?.passportNo || '-' },
      { accessorKey: 'compliance.passportExpiry', header: 'Expiry', cell: (info) => info.row.original.compliance?.passportExpiry || '-' },
      {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const h = docHealth(info.row.original.compliance?.passportExpiry);
          return <Badge color={h.color} variant="light">{h.label}</Badge>;
        },
      },
      {
        id: 'action',
        header: 'Actions',
        cell: (info) => <RowMenu row={info.row.original} canEdit={canEdit} canViewLedger={canViewLedger} navigate={navigate} />,
      },
    ],
    [canEdit, canViewLedger, navigate]
  );

  return (
    <DataTable
      columns={mode === 'passport' ? passportColumns : generalColumns}
      data={list.data}
      totalRowCount={list.totalRowCount}
      page={list.page}
      limit={list.limit}
      onPageChange={list.onPageChange}
      search={list.search}
      onSearchChange={list.onSearchChange}
      isLoading={list.isLoading}
      emptyLabel="No employees found"
      onRowClick={goView}
    />
  );
}
