import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Title, Group, Button, Paper, Table, Progress, Text, TextInput, Loader, Center } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { fetchMisRollup, misExportUrl } from '../../api/mis';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

function pctColor(pct) {
  if (pct >= 100) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

export default function MisPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mis', 'rollup', month],
    queryFn: () => fetchMisRollup({ month: month || undefined }),
  });

  const rows = data?.data?.rows || [];
  const totals = data?.data?.totals;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>MIS & Targets</Title>
        <Group gap="sm">
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.currentTarget.value)} placeholder="All time" w={160} />
          <Button leftSection={<Download size={16} />} variant="light" component="a" href={misExportUrl(month)} target="_blank" rel="noreferrer">
            Export CSV
          </Button>
        </Group>
      </Group>
      <Text c="dimmed" size="sm">
        {month ? `Showing ${month}` : 'Showing lifetime totals — pick a month above to filter'} · Click a row to see their performance detail.
      </Text>

      <Paper withBorder p="md" radius="md">
        {isLoading ? (
          <Center py="xl"><Loader size="sm" /></Center>
        ) : (
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Agent</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>Submissions</Table.Th>
                  <Table.Th>Interested</Table.Th>
                  <Table.Th>Pipeline</Table.Th>
                  <Table.Th>Activated Orders</Table.Th>
                  <Table.Th>Achieved</Table.Th>
                  <Table.Th>Achievement</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8}><Center py="xl"><Text c="dimmed">No agents in scope</Text></Center></Table.Td>
                  </Table.Tr>
                ) : (
                  rows.map((r) => (
                    <Table.Tr
                      key={r.agentId}
                      onClick={() => navigate(`/mis/${r.agentId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <Text fw={600} size="sm">{r.name}</Text>
                        <Text size="xs" c="dimmed">{r.desig}</Text>
                      </Table.Td>
                      <Table.Td>{AED(r.target)}</Table.Td>
                      <Table.Td>{r.submissions}</Table.Td>
                      <Table.Td>{r.interested}</Table.Td>
                      <Table.Td>{r.pipelineCount} · {AED(r.pipelineValue)}</Table.Td>
                      <Table.Td>{r.activatedCount}</Table.Td>
                      <Table.Td>{AED(r.achieved)}</Table.Td>
                      <Table.Td w={160}>
                        <Group gap="xs" wrap="nowrap">
                          <Progress value={Math.min(100, r.achievementPct)} color={pctColor(r.achievementPct)} size="sm" w={90} />
                          <Text size="xs">{r.achievementPct}%</Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
              {totals && rows.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>{AED(totals.target)}</Table.Th>
                    <Table.Th>{totals.submissions}</Table.Th>
                    <Table.Th>{totals.interested}</Table.Th>
                    <Table.Th>{totals.pipelineCount} · {AED(totals.pipelineValue)}</Table.Th>
                    <Table.Th>{totals.activatedCount}</Table.Th>
                    <Table.Th>{AED(totals.achieved)}</Table.Th>
                    <Table.Th>{totals.achievementPct}%</Table.Th>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
    </Stack>
  );
}
