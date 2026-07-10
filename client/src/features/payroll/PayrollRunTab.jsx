import { useState } from 'react';
import { Stack, Group, TextInput, Select, Button, Table, Text, Badge, Modal, Alert, Checkbox, Tooltip } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { Play, CheckCircle2, Trash2 } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchAccounts } from '../../api/accounting';
import { fetchPayrollPreview, processPayrollRun, deletePayrollRun, fetchPayrollRuns, fetchPayrollRun } from '../../api/payroll';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const PAY_TYPE_LABELS = { salary: 'Salary', commission: 'Commission', salary_commission: 'Salary+Comm.' };
const PAY_TYPE_COLORS = { salary: 'gray', commission: 'grape', salary_commission: 'indigo' };
// Runs processed before this feature existed have no payType/commissionBreakdown stored at all
// (.lean() reads return exactly what's in Mongo, no schema defaults) - treat those as 'salary',
// matching what the User/PayrollLine schema defaults would have meant at the time.
const payTypeOf = (line) => line.payType || 'salary';

function CommissionCell({ line }) {
  const b = line.commissionBreakdown;
  if (!b || payTypeOf(line) === 'salary') return <Text size="sm">{AED(line.commission)}</Text>;
  return (
    <Tooltip
      multiline
      w={260}
      label={`Achieved AED ${AED(b.achievedMrc)} · ${b.achievementPct}% of target (AED ${AED(b.target)}) → ${b.tierRate ?? 0}% tier`}
    >
      <Text size="sm" style={{ cursor: 'help', borderBottom: '1px dashed currentColor', display: 'inline-block' }}>
        {AED(line.commission)}
      </Text>
    </Tooltip>
  );
}

export default function PayrollRunTab({ canEdit }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const canProcess = user.editModules?.includes('payroll.process');
  const canDelete = user.editModules?.includes('payroll.delete');
  const [month, setMonth] = useState(currentMonth());
  const [account, setAccount] = useState('');
  const [preview, setPreview] = useState(null);
  const [viewRunId, setViewRunId] = useState(null);
  const [skipIds, setSkipIds] = useState(new Set());

  const toggleSkip = (id) => {
    setSkipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const accountsQuery = useQuery({ queryKey: ['accounting', 'accounts'], queryFn: fetchAccounts });
  const accounts = accountsQuery.data?.data || [];

  const runsList = usePagedList(['payroll', 'runs'], fetchPayrollRuns);

  const viewRunQuery = useQuery({
    queryKey: ['payroll', 'runs', viewRunId],
    queryFn: () => fetchPayrollRun(viewRunId),
    enabled: !!viewRunId,
  });

  const handlePreview = async () => {
    try {
      const res = await fetchPayrollPreview(month);
      setPreview(res.data);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not preview', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleProcess = async () => {
    if (!account) {
      notifications.show({ color: 'red', title: 'Account required', message: 'Choose which account this payroll run is paid from' });
      return;
    }
    try {
      await processPayrollRun({ month, account, skipEmployees: [...skipIds] });
      notifications.show({ color: 'green', message: `Payroll for ${month} processed` });
      setPreview(null);
      setSkipIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      runsList.refetch();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not process', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleDelete = async (run) => {
    const ok = await confirm({
      title: 'Delete this payroll run?',
      message: `This permanently deletes the ${run.month} payroll run, reverses its expense and account transaction, and restores any ledger advances/loans it settled. This cannot be undone.`,
      confirmLabel: 'Yes, delete it',
      color: 'red',
    });
    if (!ok) return;
    try {
      await deletePayrollRun(run._id);
      notifications.show({ color: 'green', message: `Payroll run for ${run.month} deleted` });
      setViewRunId(null);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      runsList.refetch();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not delete', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const exportCsv = (run, lines) => {
    const rows = [
      ['Employee ID', 'Name', 'Pay Type', 'Basic', 'Allowance', 'Commission', 'Deductions', 'Net Pay', 'Currency'],
      ...lines.map((l) => [
        l.employee.employeeId,
        l.employee.name,
        PAY_TYPE_LABELS[payTypeOf(l)],
        l.basic,
        l.allowance,
        l.commission,
        l.deductions,
        l.netPay,
        'AED',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${run.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="md">
      {canProcess && (
        <Stack gap="sm">
          <Group align="flex-end">
            <TextInput
              type="month"
              label="Month"
              value={month}
              max={currentMonth()}
              onChange={(e) => { setMonth(e.currentTarget.value); setPreview(null); setSkipIds(new Set()); }}
            />
            <Select
              label="Pay From Account"
              data={accounts.map((a) => ({ value: a._id, label: a.name }))}
              value={account}
              onChange={setAccount}
              w={260}
            />
            <Button variant="light" leftSection={<Play size={16} />} onClick={handlePreview}>Preview</Button>
            <Button leftSection={<CheckCircle2 size={16} />} onClick={handleProcess} disabled={!preview}>Process Payroll</Button>
          </Group>

          {preview && (
            <Stack gap="xs">
              <Alert color="blue" variant="light">
                {preview.lines.length - skipIds.size} of {preview.lines.length} employees will be paid
                · Total net pay {AED(preview.lines.filter((l) => !skipIds.has(l.employee._id)).reduce((sum, l) => sum + l.netPay, 0))}
                {skipIds.size > 0 && ` · ${skipIds.size} skipped`} · will debit the selected account once processed
              </Alert>
              <Table.ScrollContainer minWidth={800} scrollAreaProps={{ viewportProps: { tabIndex: 0, role: 'region', 'aria-label': 'Table, scrollable horizontally' } }}>
                <Table striped verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ID</Table.Th><Table.Th>Name</Table.Th><Table.Th>Pay Type</Table.Th><Table.Th>Basic</Table.Th><Table.Th>Allowance</Table.Th>
                      <Table.Th>Commission</Table.Th><Table.Th>Deductions</Table.Th><Table.Th>Net Pay</Table.Th><Table.Th>Gratuity Accrual</Table.Th>
                      <Table.Th>Skip</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.lines.map((l) => {
                      const skipped = skipIds.has(l.employee._id);
                      return (
                        <Table.Tr key={l.employee._id} style={skipped ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                          <Table.Td>{l.employee.employeeId}</Table.Td>
                          <Table.Td>{l.employee.name}</Table.Td>
                          <Table.Td><Badge size="sm" variant="light" color={PAY_TYPE_COLORS[payTypeOf(l)]}>{PAY_TYPE_LABELS[payTypeOf(l)]}</Badge></Table.Td>
                          <Table.Td>{AED(l.basic)}</Table.Td>
                          <Table.Td>{AED(l.allowance)}</Table.Td>
                          <Table.Td><CommissionCell line={l} /></Table.Td>
                          <Table.Td c={l.deductions ? 'red' : undefined}>{l.deductions ? `-${AED(l.deductions)}` : '-'}</Table.Td>
                          <Table.Td fw={700}>{AED(l.netPay)}</Table.Td>
                          <Table.Td c="dimmed">{AED(l.gratuityAccrual)}</Table.Td>
                          <Table.Td>
                            <Checkbox
                              checked={skipped}
                              onChange={() => toggleSkip(l.employee._id)}
                              aria-label={`Skip ${l.employee.name} in this run`}
                            />
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          )}
        </Stack>
      )}

      <Text fw={600} size="sm">Payroll History</Text>
      <DataTable
        columns={[
          { accessorKey: 'month', header: 'Month' },
          { accessorKey: 'account', header: 'Account', cell: (info) => info.getValue()?.name || '-' },
          { accessorKey: 'totalNet', header: 'Total Net Pay', cell: (info) => AED(info.getValue()) },
          { accessorKey: 'totalCommission', header: 'Commission', cell: (info) => AED(info.getValue()) },
          { accessorKey: 'totalDeductions', header: 'Deductions', cell: (info) => AED(info.getValue()) },
          {
            id: 'action',
            header: 'Actions',
            cell: (info) => (
              <Button size="compact-xs" variant="light" onClick={() => setViewRunId(info.row.original._id)}>View</Button>
            ),
          },
        ]}
        data={runsList.data}
        totalRowCount={runsList.totalRowCount}
        page={runsList.page}
        limit={runsList.limit}
        onPageChange={runsList.onPageChange}
        search={runsList.search}
        onSearchChange={runsList.onSearchChange}
        isLoading={runsList.isLoading}
        emptyLabel="No payroll runs yet"
      />

      <Modal opened={!!viewRunId} onClose={() => setViewRunId(null)} title={viewRunQuery.data ? `Payroll — ${viewRunQuery.data.data.run.month}` : ''} size="xl">
        {viewRunQuery.data && (
          <Stack gap="sm">
            <Group>
              <Badge variant="light">{viewRunQuery.data.data.run.account?.name}</Badge>
              <Badge color="green" variant="light">Total {AED(viewRunQuery.data.data.run.totalNet)}</Badge>
              <Button size="compact-xs" variant="light" onClick={() => exportCsv(viewRunQuery.data.data.run, viewRunQuery.data.data.lines)}>
                Export CSV
              </Button>
              {canDelete && (
                <Button
                  size="compact-xs"
                  variant="light"
                  color="red"
                  leftSection={<Trash2 size={14} />}
                  onClick={() => handleDelete(viewRunQuery.data.data.run)}
                >
                  Delete Run
                </Button>
              )}
            </Group>
            {viewRunQuery.data.data.run.skippedEmployees?.length > 0 && (
              <Alert color="yellow" variant="light">
                Skipped from this run: {viewRunQuery.data.data.run.skippedEmployees.map((e) => e.name).join(', ')}
              </Alert>
            )}
            <Table.ScrollContainer minWidth={800}>
              <Table striped verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th><Table.Th>Name</Table.Th><Table.Th>Pay Type</Table.Th><Table.Th>Basic</Table.Th><Table.Th>Allowance</Table.Th>
                    <Table.Th>Commission</Table.Th><Table.Th>Deductions</Table.Th><Table.Th>Net Pay</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {viewRunQuery.data.data.lines.map((l) => (
                    <Table.Tr key={l._id}>
                      <Table.Td>{l.employee?.employeeId}</Table.Td>
                      <Table.Td>{l.employee?.name}</Table.Td>
                      <Table.Td><Badge size="sm" variant="light" color={PAY_TYPE_COLORS[payTypeOf(l)]}>{PAY_TYPE_LABELS[payTypeOf(l)]}</Badge></Table.Td>
                      <Table.Td>{AED(l.basic)}</Table.Td>
                      <Table.Td>{AED(l.allowance)}</Table.Td>
                      <Table.Td><CommissionCell line={l} /></Table.Td>
                      <Table.Td c={l.deductions ? 'red' : undefined}>{l.deductions ? `-${AED(l.deductions)}` : '-'}</Table.Td>
                      <Table.Td fw={700}>{AED(l.netPay)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
