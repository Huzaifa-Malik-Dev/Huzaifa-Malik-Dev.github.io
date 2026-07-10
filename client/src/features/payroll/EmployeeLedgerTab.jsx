import { useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, Select, Radio, NumberInput, TextInput, Badge, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { Plus } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchLedger, createLedgerEntry } from '../../api/payroll';
import { fetchEmployees } from '../../api/hr';
import { useAuth } from '../../context/AuthContext';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLOR = { Open: 'yellow', Settled: 'green' };
const TYPE_COLOR = { Advance: 'blue', Loan: 'violet', Deduction: 'gray', Salary: 'green', Bonus: 'teal', Reimbursement: 'cyan' };
// Same simplification as the per-employee Ledger section: Deduct -> Deduction (open debit,
// auto-collected next payroll run), Add -> Bonus (settled credit) with the reason as the note.
const ACTION_TO_TYPE = { deduct: 'Deduction', add: 'Bonus' };

export default function EmployeeLedgerTab() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('payroll.ledger');
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const list = usePagedList(['payroll', 'ledger'], fetchLedger);
  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees-for-select'],
    queryFn: () => fetchEmployees({ limit: 200, active: 'true' }),
    enabled: canEdit,
  });
  const employees = employeesQuery.data?.data || [];

  const form = useForm({
    initialValues: { employee: '', date: new Date().toISOString().slice(0, 10), action: 'deduct', amount: '', note: '' },
    validate: {
      amount: (v) => (v === '' || v === null ? 'Amount is required' : null),
      note: (v, values) => (values.action === 'add' && !v.trim() ? 'Reason is required' : null),
    },
  });

  const handleCreate = async (values) => {
    try {
      const type = ACTION_TO_TYPE[values.action];
      await createLedgerEntry({ employee: values.employee, date: values.date, amount: values.amount, note: values.note, type });
      notifications.show({ color: 'green', message: `${type} recorded` });
      setCreateOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['payroll', 'ledger'] });
      list.refetch();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'employee', header: 'Employee', cell: (info) => info.getValue()?.name || '-' },
      { accessorKey: 'type', header: 'Type', cell: (info) => <Badge color={TYPE_COLOR[info.getValue()]} variant="light">{info.getValue()}</Badge> },
      { accessorKey: 'amount', header: 'Amount', cell: (info) => AED(info.getValue()) },
      { accessorKey: 'remaining', header: 'Remaining', cell: (info) => AED(info.getValue()) },
      { accessorKey: 'status', header: 'Status', cell: (info) => <Badge color={STATUS_COLOR[info.getValue()]} variant="light">{info.getValue()}</Badge> },
      { accessorKey: 'note', header: 'Note' },
    ],
    []
  );

  return (
    <Stack gap="md">
      {canEdit && (
        <Group>
          <Button leftSection={<Plus size={16} />} onClick={() => setCreateOpen(true)}>Add Ledger Entry</Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={list.data}
        totalRowCount={list.totalRowCount}
        page={list.page}
        limit={list.limit}
        onPageChange={list.onPageChange}
        search={list.search}
        onSearchChange={list.onSearchChange}
        isLoading={list.isLoading}
        emptyLabel="No ledger entries yet"
      />

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add Ledger Entry" size="md">
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <Select label="Employee" data={employees.map((e) => ({ value: e._id, label: `${e.employeeId} - ${e.name}` }))} required {...form.getInputProps('employee')} />
            <Radio.Group label="Action" required {...form.getInputProps('action')}>
              <Group mt={4}>
                <Radio value="deduct" label="Deduct Amount" />
                <Radio value="add" label="Add Amount" />
              </Group>
            </Radio.Group>
            <Text size="xs" c="dimmed">
              {form.values.action === 'deduct'
                ? 'Deducted in full from this employee\'s next payroll run.'
                : 'Recorded as already paid to this employee.'}
            </Text>
            <TextInput type="date" label="Date" required {...form.getInputProps('date')} />
            <NumberInput label="Amount (AED)" min={0} required {...form.getInputProps('amount')} />
            <TextInput
              label={form.values.action === 'add' ? 'Reason' : 'Note (optional)'}
              placeholder={form.values.action === 'add' ? 'e.g. Bonus, Reimbursement...' : undefined}
              required={form.values.action === 'add'}
              {...form.getInputProps('note')}
            />
            <Button type="submit" mt="sm">Save</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
