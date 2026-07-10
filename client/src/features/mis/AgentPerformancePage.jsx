import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Title, Text, Group, Paper, SimpleGrid, ActionIcon, Avatar, Badge, RingProgress, Center,
  Loader, TextInput, Table,
} from '@mantine/core';
import { ArrowLeft } from 'lucide-react';
import { fetchAgentPerformance } from '../../api/mis';
import { ROLE_LABELS } from '../../constants/nav';
import { colorFor, initials } from '../../utils/avatar';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

function StatCard({ label, value, sub, color = 'blue' }) {
  return (
    <Paper withBorder p="md" radius="md" style={{ borderLeft: `3px solid var(--mantine-color-${color}-6)` }}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="xl" fw={700}>{value}</Text>
      {sub && <Text size="xs" c="dimmed">{sub}</Text>}
    </Paper>
  );
}

// The MIS drill-down: how much this specific person (or, for a manager, their whole team) has
// actually done - target vs achievement, submissions, pipeline, activations - not just their
// generic HR profile.
export default function AgentPerformancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [month, setMonth] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mis', 'agent', id, month],
    queryFn: () => fetchAgentPerformance(id, { month: month || undefined }),
  });

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;

  const d = data?.data;
  if (!d) return <Text c="dimmed">No performance data found.</Text>;

  const { person, rows, totals } = d;
  const isManager = person.role !== 'agent';
  const pctColor = totals.achievementPct >= 100 ? 'green' : totals.achievementPct >= 50 ? 'yellow' : 'red';

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate(-1)} aria-label="Back to MIS">
            <ArrowLeft size={18} />
          </ActionIcon>
          <Avatar size={44} radius="xl" color={colorFor(person.name)}>{initials(person.name)}</Avatar>
          <div>
            <Title order={3}>{person.name}</Title>
            <Group gap="xs">
              <Text size="sm" c="dimmed">{person.employeeId} · {person.desig}</Text>
              <Badge size="xs" variant="light">{ROLE_LABELS[person.role] || person.role}</Badge>
            </Group>
          </div>
        </Group>
        <TextInput type="month" value={month} onChange={(e) => setMonth(e.currentTarget.value)} placeholder="All time" w={160} />
      </Group>
      <Text size="sm" c="dimmed">
        {isManager ? 'Rolled up across everyone reporting up to them.' : 'Individual performance.'}
        {' '}{month ? `Showing ${month}.` : 'Showing lifetime totals.'}
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <StatCard label="Target" value={AED(totals.target)} color="gray" />
        <StatCard label="Achieved" value={AED(totals.achieved)} sub={`${totals.achievementPct}% of target`} color={pctColor} />
        <StatCard label="Submissions (DSR)" value={totals.submissions} sub={`${totals.interested} interested`} color="blue" />
        <StatCard label="Activated Orders" value={totals.activatedCount} sub={`${totals.pipelineCount} in pipeline · ${AED(totals.pipelineValue)}`} color="teal" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper withBorder p="md" radius="md" style={{ gridColumn: 'span 1' }}>
          <Text fw={600} mb="sm" ta="center">Target vs Achievement</Text>
          <Center>
            <RingProgress
              size={150}
              thickness={15}
              roundCaps
              sections={[{ value: Math.min(100, totals.achievementPct), color: pctColor }]}
              label={<Text ta="center" fw={700} size="lg">{totals.achievementPct}%</Text>}
            />
          </Center>
          <Text ta="center" size="xs" c="dimmed" mt="xs">{AED(totals.achieved)} of {AED(totals.target)}</Text>
        </Paper>

        {isManager && (
          <Paper withBorder p="md" radius="md" style={{ gridColumn: 'span 2' }}>
            <Text fw={600} mb="sm">Team Breakdown</Text>
            <Table.ScrollContainer minWidth={500} scrollAreaProps={{ viewportProps: { tabIndex: 0, role: 'region', 'aria-label': 'Table, scrollable horizontally' } }}>
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Agent</Table.Th>
                    <Table.Th>Target</Table.Th>
                    <Table.Th>Achieved</Table.Th>
                    <Table.Th>Achievement</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.length === 0 ? (
                    <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" size="sm">No agents in scope</Text></Table.Td></Table.Tr>
                  ) : (
                    rows.map((r) => (
                      <Table.Tr key={r.agentId} onClick={() => navigate(`/mis/${r.agentId}`)} style={{ cursor: 'pointer' }}>
                        <Table.Td>{r.name}</Table.Td>
                        <Table.Td>{AED(r.target)}</Table.Td>
                        <Table.Td>{AED(r.achieved)}</Table.Td>
                        <Table.Td>{r.achievementPct}%</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}
