import { Stack, Title, Tabs, Paper, Group, Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EmployeeListTab from './EmployeeListTab';
import TeamAssignmentTab from './TeamAssignmentTab';

export default function HrPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = user.editModules?.includes('hr');
  const canAddEmployee = canEdit && user.actions?.includes('hr.addEmployee');

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>HR</Title>
        {canAddEmployee && (
          <Button leftSection={<Plus size={16} />} onClick={() => navigate('/hr/new')}>
            Add Employee
          </Button>
        )}
      </Group>

      <Tabs defaultValue="all">
        <Tabs.List>
          <Tabs.Tab value="all">All Employees</Tabs.Tab>
          <Tabs.Tab value="active">Active Employees</Tabs.Tab>
          <Tabs.Tab value="team">Team Assignment</Tabs.Tab>
          <Tabs.Tab value="passport">Passport Management</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="all" pt="md">
          <Paper withBorder p="md" radius="md">
            <EmployeeListTab canEdit={canEdit} />
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="active" pt="md">
          <Paper withBorder p="md" radius="md">
            <EmployeeListTab activeOnly canEdit={canEdit} />
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="team" pt="md">
          <TeamAssignmentTab canEdit={canEdit} />
        </Tabs.Panel>
        <Tabs.Panel value="passport" pt="md">
          <Paper withBorder p="md" radius="md">
            <EmployeeListTab mode="passport" canEdit={canEdit} />
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
