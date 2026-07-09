import { useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, Select, NumberInput, TextInput, Badge, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Plus } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchLedger, createLedgerEntry } from '../../api/payroll';
import { fetchEmployees } from '../../api/hr';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLOR = { Open: 'yellow', Settled: 'green' };
const TYPE_COLOR = { Advance: 'blue', Loan: 'violet', Deduction: 'gray' };

export default function EmployeeLedgerTab({ canEdit }) {
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
    initialValues: { employee: '', date: new Date().toISOString().slice(0, 10), type: 'Advance', amount: 0, note: '' },
  });

  const handleCreate = async (values) => {
    try {
      await createLedgerEntry(values);
      notifications.show({ color: 'dark', message: `${values.type} recorded` });
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
            <Select
              label="Type"
              data={[
                { value: 'Advance', label: 'Advance' },
                { value: 'Loan', label: 'Loan' },
                { value: 'Deduction', label: 'Deduction (manual)' },
              ]}
              required
              {...form.getInputProps('type')}
            />
            <TextInput type="date" label="Date" required {...form.getInputProps('date')} />
            <NumberInput label="Amount (AED)" min={0.01} required {...form.getInputProps('amount')} />
            <Text size="xs" c="dimmed">Deducted in full on this employee's next payroll run.</Text>
            <TextInput label="Note" {...form.getInputProps('note')} />
            <Button type="submit" mt="sm">Save</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
