import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, SimpleGrid, Paper, Text, Group, Badge, Loader, Center, Modal, ScrollArea,
  UnstyledButton, ThemeIcon, Divider,
} from '@mantine/core';
import { IdCard, Plane, Fingerprint, Landmark, ShieldCheck, CircleCheck } from 'lucide-react';
import { fetchComplianceSummary } from '../../api/hr';

const CATEGORY_ICON = { passport: IdCard, visa: Plane, eid: Fingerprint, labourCard: Landmark, insurance: ShieldCheck };

function EmployeeRow({ employee, onOpen }) {
  return (
    <UnstyledButton onClick={() => onOpen(employee._id)} w="100%">
      <Group justify="space-between" py={6} px={4} style={{ borderRadius: 6 }}>
        <Group gap="xs">
          <Text size="sm" fw={600}>{employee.name}</Text>
          <Text size="xs" c="dimmed">{employee.employeeId}</Text>
        </Group>
        <Text size="xs" c="dimmed">{employee.expiry || 'No date on file'}</Text>
      </Group>
    </UnstyledButton>
  );
}

export default function HrDashboardTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['hr', 'compliance-summary'], queryFn: fetchComplianceSummary });
  const [activeCategory, setActiveCategory] = useState(null);

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;

  const categories = data?.data?.categories || [];
  const totalExpired = data?.data?.totalExpired || 0;
  const totalExpiring = data?.data?.totalExpiring || 0;
  const selected = categories.find((c) => c.key === activeCategory);

  const goToEmployee = (id) => navigate(`/hr/${id}`);

  return (
    <Stack gap="md">
      <Group gap="md">
        <Paper withBorder p="md" radius="md" style={{ borderLeft: '3px solid var(--mantine-color-red-6)' }}>
          <Text size="sm" c="dimmed">Documents Expired</Text>
          <Text size="xl" fw={700}>{totalExpired}</Text>
        </Paper>
        <Paper withBorder p="md" radius="md" style={{ borderLeft: '3px solid var(--mantine-color-yellow-6)' }}>
          <Text size="sm" c="dimmed">Expiring in 30 Days</Text>
          <Text size="xl" fw={700}>{totalExpiring}</Text>
        </Paper>
      </Group>

      <Text size="sm" fw={600}>Document Expiry — click any card to see the affected employees</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }}>
        {categories.map((cat) => {
          const Icon = CATEGORY_ICON[cat.key] || IdCard;
          const flagged = cat.expiredCount + cat.expiringCount > 0;
          return (
            <Paper
              key={cat.key}
              withBorder
              p="md"
              radius="md"
              component={UnstyledButton}
              onClick={() => setActiveCategory(cat.key)}
              style={{ cursor: 'pointer' }}
            >
              <Group justify="space-between" mb="xs">
                <ThemeIcon variant="light" color={flagged ? 'red' : 'green'} size="lg" radius="md">
                  {flagged ? <Icon size={18} /> : <CircleCheck size={18} />}
                </ThemeIcon>
              </Group>
              <Text size="sm" fw={600}>{cat.label}</Text>
              <Group gap="xs" mt={4}>
                <Badge color="red" variant={cat.expiredCount ? 'filled' : 'light'} size="sm">{cat.expiredCount} expired</Badge>
                <Badge color="yellow" variant={cat.expiringCount ? 'filled' : 'light'} size="sm">{cat.expiringCount} expiring</Badge>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Modal opened={!!selected} onClose={() => setActiveCategory(null)} title={selected?.label} size="md">
        {selected && (
          <Stack gap="md">
            <div>
              <Group gap="xs" mb="xs">
                <Badge color="red" variant="light">Expired ({selected.expired.length})</Badge>
              </Group>
              <ScrollArea.Autosize mah={200}>
                <Stack gap={2}>
                  {selected.expired.length === 0 && <Text size="sm" c="dimmed">None</Text>}
                  {selected.expired.map((e) => <EmployeeRow key={e._id} employee={e} onOpen={goToEmployee} />)}
                </Stack>
              </ScrollArea.Autosize>
            </div>
            <Divider />
            <div>
              <Group gap="xs" mb="xs">
                <Badge color="yellow" variant="light">Expiring within 30 days ({selected.expiring.length})</Badge>
              </Group>
              <ScrollArea.Autosize mah={200}>
                <Stack gap={2}>
                  {selected.expiring.length === 0 && <Text size="sm" c="dimmed">None</Text>}
                  {selected.expiring.map((e) => <EmployeeRow key={e._id} employee={e} onOpen={goToEmployee} />)}
                </Stack>
              </ScrollArea.Autosize>
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
