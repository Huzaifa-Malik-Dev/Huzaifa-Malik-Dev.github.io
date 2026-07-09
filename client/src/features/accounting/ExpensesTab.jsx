import { useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, TextInput, Select, NumberInput, Text, Badge, ActionIcon, Divider } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { Plus, Trash2 } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchExpenses, createExpense, fetchAccounts } from '../../api/accounting';
import { fetchEmployees } from '../../api/hr';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Commission', 'Other'];

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpensesTab({ canEdit }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const list = usePagedList(['accounting', 'expenses'], fetchExpenses);
  const accountsQuery = useQuery({ queryKey: ['accounting', 'accounts'], queryFn: fetchAccounts });
  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees-for-select'],
    queryFn: () => fetchEmployees({ limit: 200, active: 'true' }),
    enabled: canEdit,
  });

  const accounts = accountsQuery.data?.data || [];
  const employees = employeesQuery.data?.data || [];

  const form = useForm({
    initialValues: { category: 'Rent', amount: 0, date: new Date().toISOString().slice(0, 10), account: '', note: '', breakdown: [] },
  });

  const handleCreate = async (values) => {
    try {
      const payload = { ...values, breakdown: values.category === 'Salaries' ? values.breakdown : [] };
      await createExpense(payload);
      notifications.show({ color: 'green', message: 'Expense recorded' });
      setCreateOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      list.refetch();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const breakdownTotal = form.values.breakdown.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  const columns = useMemo(
    () => [
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'category', header: 'Category', cell: (info) => <Badge variant="light">{info.getValue()}</Badge> },
      { accessorKey: 'amount', header: 'Amount', cell: (info) => AED(info.getValue()) },
      { accessorKey: 'account', header: 'Account', cell: (info) => info.getValue()?.name || '-' },
      { accessorKey: 'note', header: 'Note' },
      {
        id: 'breakdown',
        header: 'Breakdown',
        cell: (info) => {
          const b = info.row.original.breakdown || [];
          if (!b.length) return '-';
          return <Text size="xs" c="dimmed">{b.length} employee{b.length > 1 ? 's' : ''}</Text>;
        },
      },
    ],
    []
  );

  return (
    <Stack gap="md">
      {canEdit && (
        <Group>
          <Button leftSection={<Plus size={16} />} onClick={() => setCreateOpen(true)}>New Expense</Button>
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
        emptyLabel="No expenses recorded yet"
      />

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Expense" size="md">
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <Select label="Category" data={CATEGORIES} required {...form.getInputProps('category')} />
            <TextInput type="date" label="Date" required {...form.getInputProps('date')} />
            <NumberInput label="Amount (AED)" min={0.01} required {...form.getInputProps('amount')} />
            <Select
              label="Paid From Account"
              description="Every expense, including salaries, must be paid from one account"
              data={accounts.map((a) => ({ value: a._id, label: a.name }))}
              required
              {...form.getInputProps('account')}
            />
            <TextInput label="Note" {...form.getInputProps('note')} />

            {form.values.category === 'Salaries' && (
              <>
                <Divider label="Employee Breakdown (optional)" labelPosition="left" />
                {form.values.breakdown.map((_, index) => (
                  <Group key={index} align="flex-end">
                    <Select
                      label="Employee"
                      data={employees.map((e) => ({ value: e._id, label: e.name }))}
                      style={{ flex: 1 }}
                      {...form.getInputProps(`breakdown.${index}.employee`)}
                    />
                    <NumberInput label="Amount" w={110} {...form.getInputProps(`breakdown.${index}.amount`)} />
                    <ActionIcon color="red" variant="subtle" onClick={() => form.removeListItem('breakdown', index)}>
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                ))}
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => form.insertListItem('breakdown', { employee: '', amount: 0, note: '' })}
                >
                  + Add Employee
                </Button>
                {form.values.breakdown.length > 0 && (
                  <Text size="xs" c={Math.abs(breakdownTotal - form.values.amount) > 0.01 ? 'red' : 'dimmed'}>
                    Breakdown total: {AED(breakdownTotal)} (must match expense amount)
                  </Text>
                )}
              </>
            )}

            <Button type="submit" mt="sm">Save Expense</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
