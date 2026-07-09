import { Stack, Title, Tabs } from '@mantine/core';
import { useAuth } from '../../context/AuthContext';
import PayrollRunTab from './PayrollRunTab';
import EmployeeLedgerTab from './EmployeeLedgerTab';

export default function PayrollPage() {
  const { user } = useAuth();
  const canEdit = user.editModules?.includes('payroll');

  return (
    <Stack>
      <Title order={3}>Payroll</Title>

      <Tabs defaultValue="run">
        <Tabs.List>
          <Tabs.Tab value="run">Payroll Run</Tabs.Tab>
          <Tabs.Tab value="ledger">Employee Ledger</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="run" pt="md">
          <PayrollRunTab canEdit={canEdit} />
        </Tabs.Panel>
        <Tabs.Panel value="ledger" pt="md">
          <EmployeeLedgerTab canEdit={canEdit} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
