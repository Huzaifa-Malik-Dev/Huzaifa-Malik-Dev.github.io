import { useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, TextInput, Select, NumberInput, Badge, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { Plus, X } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { usePagedList } from '../../hooks/usePagedList';
import { fetchCheques, createCheque, updateChequeStatus, fetchAccounts } from '../../api/accounting';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLOR = { Pending: 'gray', Deposited: 'blue', Cleared: 'green', Bounced: 'red' };
const NEXT_STATUS = { Pending: 'Deposited', Deposited: 'Cleared' };

export default function ChequesTab({ canEdit }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const list = usePagedList(['accounting', 'cheques'], fetchCheques);
  const accountsQuery = useQuery({ queryKey: ['accounting', 'accounts'], queryFn: fetchAccounts });
  const accounts = accountsQuery.data?.data || [];

  const form = useForm({
    initialValues: {
      no: '', date: new Date().toISOString().slice(0, 10), dueDate: '', direction: 'Received',
      party: '', amount: '', account: '', note: '',
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
    list.refetch();
  };

  const handleCreate = async (values) => {
    try {
      await createCheque(values);
      notifications.show({ color: 'green', message: 'Cheque added' });
      setCreateOpen(false);
      form.reset();
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleStatus = async (id, status) => {
    try {
      await updateChequeStatus(id, status);
      notifications.show({ color: 'green', message: `Cheque marked ${status}` });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'no', header: 'No.' },
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'dueDate', header: 'Due Date' },
      { accessorKey: 'direction', header: 'Direction', cell: (info) => <Badge variant="light">{info.getValue()}</Badge> },
      { accessorKey: 'party', header: 'Party' },
      { accessorKey: 'amount', header: 'Amount', cell: (info) => AED(info.getValue()) },
      { accessorKey: 'account', header: 'Account', cell: (info) => info.getValue()?.name || '-' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <Badge color={STATUS_COLOR[info.getValue()]} variant="light">{info.getValue()}</Badge>,
      },
      {
        id: 'action',
        header: 'Actions',
        cell: (info) => {
          const row = info.row.original;
          const terminal = row.status === 'Cleared' || row.status === 'Bounced';
          if (!canEdit || terminal) return null;
          return (
            <Group gap={4}>
              <Button size="compact-xs" variant="light" onClick={() => handleStatus(row._id, NEXT_STATUS[row.status])}>
                Mark {NEXT_STATUS[row.status]}
              </Button>
              <Button size="compact-xs" variant="subtle" color="red" leftSection={<X size={12} />} onClick={() => handleStatus(row._id, 'Bounced')}>
                Bounced
              </Button>
            </Group>
          );
        },
      },
    ],
    [canEdit]
  );

  return (
    <Stack gap="md">
      {canEdit && (
        <Group>
          <Button leftSection={<Plus size={16} />} onClick={() => setCreateOpen(true)}>New Cheque</Button>
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
        emptyLabel="No cheques recorded yet"
      />

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Cheque" size="md">
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Cheque No." required {...form.getInputProps('no')} />
              <Select label="Direction" data={['Received', 'Issued']} required {...form.getInputProps('direction')} />
            </Group>
            <TextInput label="Party" placeholder="Customer / Vendor / Landlord" required {...form.getInputProps('party')} />
            <Group grow>
              <TextInput type="date" label="Date" required {...form.getInputProps('date')} />
              <TextInput type="date" label="Due Date" required {...form.getInputProps('dueDate')} />
            </Group>
            <Group grow>
              <NumberInput label="Amount (AED)" min={0.01} required {...form.getInputProps('amount')} />
              <Select label="Account" data={accounts.map((a) => ({ value: a._id, label: a.name }))} required {...form.getInputProps('account')} />
            </Group>
            <Textarea label="Note" rows={2} {...form.getInputProps('note')} />
            <Button type="submit" mt="sm">Save Cheque</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
