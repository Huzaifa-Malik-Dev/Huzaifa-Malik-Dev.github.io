import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, ActionIcon, Group, Tooltip } from '@mantine/core';
import { Pencil } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchEmployees } from '../../api/hr';
import { ROLE_LABELS } from '../../constants/nav';
import { docHealth, overallHealth } from './docHealth';

const STATUS_COLOR = { Active: 'green', Inactive: 'gray', Frozen: 'blue', Absconding: 'red' };

function StatusBadge({ row }) {
  const status = row.status || (row.active !== false ? 'Active' : 'Inactive');
  return <Badge color={STATUS_COLOR[status] || 'gray'} variant="light">{status}</Badge>;
}

export default function EmployeeListTab({ activeOnly = false, mode = 'general', canEdit }) {
  const navigate = useNavigate();
  const goView = (row) => navigate(`/hr/${row._id}`);

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
        header: '',
        cell: (info) =>
          canEdit && (
            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Edit this employee">
                <ActionIcon
                  variant="light"
                  size="lg"
                  radius="md"
                  onClick={(e) => { e.stopPropagation(); navigate(`/hr/${info.row.original._id}?edit=1`); }}
                  aria-label="Edit employee"
                >
                  <Pencil size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ),
      },
    ],
    [canEdit, navigate]
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
        header: '',
        cell: (info) =>
          canEdit && (
            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Edit this employee">
                <ActionIcon
                  variant="light"
                  size="lg"
                  radius="md"
                  onClick={(e) => { e.stopPropagation(); navigate(`/hr/${info.row.original._id}?edit=1`); }}
                  aria-label="Edit employee"
                >
                  <Pencil size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ),
      },
    ],
    [canEdit, navigate]
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
