import { Stack, Title, Tabs, Text } from '@mantine/core';
import { useAuth } from '../../context/AuthContext';
import PayrollRunTab from './PayrollRunTab';
import EmployeeLedgerTab from './EmployeeLedgerTab';

export default function PayrollPage() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('payroll');

  const tabs = [
    { value: 'run', label: 'Payroll Run', permKey: 'payroll.run' },
    { value: 'ledger', label: 'Employee Ledger', permKey: 'payroll.ledger' },
  ].filter((t) => user.modules?.includes(t.permKey));

  return (
    <Stack>
      <Title order={3}>Payroll</Title>

      {tabs.length === 0 ? (
        <Text c="dimmed" size="sm">You don't have access to any Payroll sections.</Text>
      ) : (
        <Tabs defaultValue={tabs[0].value}>
          <Tabs.List>
            {tabs.map((t) => <Tabs.Tab key={t.value} value={t.value}>{t.label}</Tabs.Tab>)}
          </Tabs.List>

          {tabs.some((t) => t.value === 'run') && (
            <Tabs.Panel value="run" pt="md">
              <PayrollRunTab canEdit={canEdit} />
            </Tabs.Panel>
          )}
          {tabs.some((t) => t.value === 'ledger') && (
            <Tabs.Panel value="ledger" pt="md">
              <EmployeeLedgerTab canEdit={canEdit} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Stack>
  );
}
