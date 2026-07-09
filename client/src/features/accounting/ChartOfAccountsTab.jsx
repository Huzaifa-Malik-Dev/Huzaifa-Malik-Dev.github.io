import { useState } from 'react';
import { Table, Button, Group, Modal, Stack, TextInput, Select, NumberInput, Text, Badge } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { fetchAccounts, createAccount, recordTransaction, fetchAccountTransactions } from '../../api/accounting';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ChartOfAccountsTab({ canEdit }) {
  const queryClient = useQueryClient();
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [recordTxOpen, setRecordTxOpen] = useState(false);
  const [txAccount, setTxAccount] = useState(null);

  const accountsQuery = useQuery({ queryKey: ['accounting', 'accounts'], queryFn: fetchAccounts });
  const accounts = accountsQuery.data?.data || [];

  const txListQuery = useQuery({
    queryKey: ['accounting', 'accounts', txAccount?._id, 'transactions'],
    queryFn: () => fetchAccountTransactions(txAccount._id, { limit: 50 }),
    enabled: !!txAccount,
  });

  const accountForm = useForm({ initialValues: { name: '', type: 'Bank', opening: 0 } });
  const txForm = useForm({
    initialValues: { account: '', type: 'Deposit', date: new Date().toISOString().slice(0, 10), amount: 0, note: '' },
  });

  const refreshAccounts = () => queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] });

  const handleCreateAccount = async (values) => {
    try {
      await createAccount(values);
      notifications.show({ color: 'green', message: 'Account created' });
      setNewAccountOpen(false);
      accountForm.reset();
      refreshAccounts();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleRecordTx = async (values) => {
    try {
      await recordTransaction(values);
      notifications.show({ color: 'green', message: 'Transaction recorded' });
      setRecordTxOpen(false);
      txForm.reset();
      refreshAccounts();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  return (
    <Stack gap="md">
      {canEdit && (
        <Group>
          <Button leftSection={<Plus size={16} />} onClick={() => setNewAccountOpen(true)}>New Account</Button>
          <Button variant="light" leftSection={<ArrowLeftRight size={16} />} onClick={() => setRecordTxOpen(true)}>Record Transaction</Button>
        </Group>
      )}

      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Account</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Opening</Table.Th>
              <Table.Th>Running Balance</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.map((a) => (
              <Table.Tr key={a._id}>
                <Table.Td>{a.name}</Table.Td>
                <Table.Td><Badge variant="light">{a.type}</Badge></Table.Td>
                <Table.Td>{AED(a.opening)}</Table.Td>
                <Table.Td><Text fw={700}>{AED(a.balance)}</Text></Table.Td>
                <Table.Td>
                  <Button size="compact-xs" variant="light" onClick={() => setTxAccount(a)}>Transactions</Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {accounts.length === 0 && (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">No accounts yet</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={newAccountOpen} onClose={() => setNewAccountOpen(false)} title="New Account">
        <form onSubmit={accountForm.onSubmit(handleCreateAccount)}>
          <Stack gap="sm">
            <TextInput label="Account Name" placeholder="e.g. ADIB Current Account" required {...accountForm.getInputProps('name')} />
            <Select label="Type" data={['Bank', 'Cash']} required {...accountForm.getInputProps('type')} />
            <NumberInput label="Opening Balance (AED)" {...accountForm.getInputProps('opening')} />
            <Button type="submit" mt="sm">Save Account</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={recordTxOpen} onClose={() => setRecordTxOpen(false)} title="Record Transaction">
        <form onSubmit={txForm.onSubmit(handleRecordTx)}>
          <Stack gap="sm">
            <Select
              label="Account"
              data={accounts.map((a) => ({ value: a._id, label: a.name }))}
              required
              {...txForm.getInputProps('account')}
            />
            <Select label="Type" data={['Deposit', 'Withdrawal']} required {...txForm.getInputProps('type')} />
            <TextInput type="date" label="Date" required {...txForm.getInputProps('date')} />
            <NumberInput label="Amount (AED)" min={0.01} required {...txForm.getInputProps('amount')} />
            <TextInput label="Note" {...txForm.getInputProps('note')} />
            <Button type="submit" mt="sm">Save Transaction</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!txAccount} onClose={() => setTxAccount(null)} title={txAccount ? `${txAccount.name} - Transactions` : ''} size="lg">
        <Table striped verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr><Table.Th>Date</Table.Th><Table.Th>Type</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Note</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(txListQuery.data?.data || []).map((t) => (
              <Table.Tr key={t._id}>
                <Table.Td>{t.date}</Table.Td>
                <Table.Td><Badge variant="light">{t.type}</Badge></Table.Td>
                <Table.Td c={t.amount < 0 ? 'red' : 'green'}>{t.amount < 0 ? '-' : ''}{AED(Math.abs(t.amount))}</Table.Td>
                <Table.Td c="dimmed">{t.note}</Table.Td>
              </Table.Tr>
            ))}
            {(txListQuery.data?.data || []).length === 0 && (
              <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">No transactions yet</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Modal>
    </Stack>
  );
}
