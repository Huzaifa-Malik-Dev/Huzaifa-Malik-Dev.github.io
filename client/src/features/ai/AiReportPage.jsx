import { useState } from 'react';
import { Stack, Title, Group, Select, Button, Paper, Text, List, Loader, Center, Badge } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, RefreshCw } from 'lucide-react';
import { fetchAiReport } from '../../api/ai';

const PERIODS = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'Last 7 Days' },
  { value: 'monthly', label: 'This Month' },
];

const FLAG_COLOR = { good: 'green', warn: 'yellow', bad: 'red' };

export default function AiReportPage() {
  const [period, setPeriod] = useState('daily');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ai', 'report', period],
    queryFn: () => fetchAiReport(period),
  });

  const report = data?.data;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>AI Reports</Title>
        <Group gap="sm">
          <Select data={PERIODS} value={period} onChange={(v) => v && setPeriod(v)} w={180} />
          <Button leftSection={<RefreshCw size={16} />} variant="light" loading={isFetching} onClick={() => refetch()}>
            Regenerate
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : report ? (
        <Paper withBorder p="xl" radius="md">
          <Group gap="xs" mb={4}>
            <Sparkles size={18} />
            <Text fw={700} size="lg">{report.title}</Text>
          </Group>
          <Text size="xs" c="dimmed" mb="md">
            Generated for {report.generatedFor} · {new Date(report.generatedAt).toLocaleString()}
          </Text>

          <Text fw={600} mb={6}>Summary</Text>
          <List size="sm" spacing="xs" mb="lg">
            {report.summary.map((line, i) => (
              <List.Item key={i}>{line}</List.Item>
            ))}
          </List>

          <Text fw={600} mb={6}>Flags</Text>
          <Stack gap="xs">
            {report.flags.map((f, i) => (
              <Paper
                key={i}
                p="sm"
                radius="sm"
                style={{ borderLeft: `3px solid var(--mantine-color-${FLAG_COLOR[f.type]}-6)`, background: `var(--mantine-color-${FLAG_COLOR[f.type]}-light)` }}
              >
                <Group gap="xs">
                  <Badge size="xs" color={FLAG_COLOR[f.type]} variant="filled">{f.type}</Badge>
                  <Text size="sm">{f.text}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      ) : (
        <Text c="dimmed">No data available.</Text>
      )}
    </Stack>
  );
}
