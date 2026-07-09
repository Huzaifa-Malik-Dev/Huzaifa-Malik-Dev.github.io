import { Stack, Title, Tabs, SimpleGrid, Paper, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { fetchSummary } from '../../api/accounting';
import ChartOfAccountsTab from './ChartOfAccountsTab';
import ExpensesTab from './ExpensesTab';
import ChequesTab from './ChequesTab';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <Paper withBorder p="md" radius="md" style={{ borderLeft: `3px solid var(--mantine-color-${color}-6)` }}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="xl" fw={700}>{value}</Text>
      {sub && <Text size="xs" c="dimmed">{sub}</Text>}
    </Paper>
  );
}

export default function AccountingPage() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('accounting');

  const summaryQuery = useQuery({ queryKey: ['accounting', 'summary'], queryFn: fetchSummary });
  const s = summaryQuery.data?.data;

  return (
    <Stack>
      <Title order={3}>Accounting</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <StatCard label="Total Cash & Bank" value={AED(s?.totalCash)} sub={`${s?.accountsCount || 0} accounts`} color="green" />
        <StatCard label="Expenses This Month" value={AED(s?.totalExpensesThisMonth)} color="red" />
        <StatCard label="Pending Cheques" value={s?.pendingCheques ?? 0} sub="Deposited or awaiting clearance" color="blue" />
        <StatCard label="Bounced Cheques" value={s?.bouncedCheques ?? 0} sub="Needs follow-up" color={s?.bouncedCheques ? 'red' : 'green'} />
      </SimpleGrid>

      <Tabs defaultValue="coa">
        <Tabs.List>
          <Tabs.Tab value="coa">Chart of Accounts</Tabs.Tab>
          <Tabs.Tab value="expenses">Company Expenses</Tabs.Tab>
          <Tabs.Tab value="cheques">Cheques</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="coa" pt="md">
          <ChartOfAccountsTab canEdit={canEdit} />
        </Tabs.Panel>
        <Tabs.Panel value="expenses" pt="md">
          <ExpensesTab canEdit={canEdit} />
        </Tabs.Panel>
        <Tabs.Panel value="cheques" pt="md">
          <ChequesTab canEdit={canEdit} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
