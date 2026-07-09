import { Stack, Title, Tabs, Paper, Group, Button, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ImportExportBar from '../../components/ImportExportBar';
import { exportEmployees, importEmployees } from '../../api/hr';
import EmployeeListTab from './EmployeeListTab';
import TeamAssignmentTab from './TeamAssignmentTab';
import HrDashboardTab from './HrDashboardTab';

export default function HrPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = user.editModules?.includes('hr');
  const canAddEmployee = user.editModules?.includes('hr.addEmployee');

  const tabs = [
    { value: 'dashboard', label: 'Dashboard', permKey: 'hr.dashboard' },
    { value: 'all', label: 'All Employees', permKey: 'hr.allEmployees' },
    { value: 'active', label: 'Active Employees', permKey: 'hr.activeEmployees' },
    { value: 'team', label: 'Team Assignment', permKey: 'hr.teamAssignment' },
    { value: 'passport', label: 'Passport Management', permKey: 'hr.passportManagement' },
  ].filter((t) => user.modules?.includes(t.permKey));

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>HR</Title>
        <Group gap="sm">
          <ImportExportBar
            moduleKey="hr"
            filenamePrefix="employees"
            kind="zip"
            exportFn={exportEmployees}
            importFn={importEmployees}
            onImported={() => queryClient.invalidateQueries({ queryKey: ['hr'] })}
          />
          {canAddEmployee && (
            <Button leftSection={<Plus size={16} />} onClick={() => navigate('/hr/new')}>
              Add Employee
            </Button>
          )}
        </Group>
      </Group>

      {tabs.length === 0 ? (
        <Text c="dimmed" size="sm">You don't have access to any HR sections.</Text>
      ) : (
        <Tabs defaultValue={tabs[0].value}>
          <Tabs.List>
            {tabs.map((t) => <Tabs.Tab key={t.value} value={t.value}>{t.label}</Tabs.Tab>)}
          </Tabs.List>

          {tabs.some((t) => t.value === 'dashboard') && (
            <Tabs.Panel value="dashboard" pt="md">
              <HrDashboardTab />
            </Tabs.Panel>
          )}
          {tabs.some((t) => t.value === 'all') && (
            <Tabs.Panel value="all" pt="md">
              <Paper withBorder p="md" radius="md">
                <EmployeeListTab canEdit={canEdit} />
              </Paper>
            </Tabs.Panel>
          )}
          {tabs.some((t) => t.value === 'active') && (
            <Tabs.Panel value="active" pt="md">
              <Paper withBorder p="md" radius="md">
                <EmployeeListTab activeOnly canEdit={canEdit} />
              </Paper>
            </Tabs.Panel>
          )}
          {tabs.some((t) => t.value === 'team') && (
            <Tabs.Panel value="team" pt="md">
              <TeamAssignmentTab canEdit={canEdit} />
            </Tabs.Panel>
          )}
          {tabs.some((t) => t.value === 'passport') && (
            <Tabs.Panel value="passport" pt="md">
              <Paper withBorder p="md" radius="md">
                <EmployeeListTab mode="passport" canEdit={canEdit} />
              </Paper>
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Stack>
  );
}
