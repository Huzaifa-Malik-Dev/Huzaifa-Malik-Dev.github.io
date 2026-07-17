import { useState } from 'react';
import { Stack, Title, SimpleGrid, Paper, Text, Group, RingProgress, Center, ScrollArea, Button, Modal, Textarea, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { notifications } from '../../utils/toast';
import { fetchDashboardSummary, fetchPendingCancellations } from '../../api/dashboard';
import { approveOrderCancellation, rejectOrderCancellation } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import PageToolbar from '../../components/PageToolbar';
import Tag from '../../components/Tag';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

// The Sales Head's queue for cancellation sign-off. It lives here rather than in Back Office
// because the Sales Head has no `backoffice` module access to browse orders with - and this works
// for directly-created orders too, which have no Pipeline deal to surface them on.
function PendingCancellations() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [rejectRow, setRejectRow] = useState(null);
  const { data } = useQuery({ queryKey: ['dashboard', 'pending-cancellations'], queryFn: fetchPendingCancellations });
  const rows = data?.data || [];

  const rejectForm = useForm({
    initialValues: { reason: '' },
    validate: { reason: (v) => (v?.trim() ? null : 'A reason is required to reject a cancellation request') },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const handleApprove = async (row) => {
    const ok = await confirm({
      title: 'Approve this cancellation?',
      message: `Order ${row.orderNo || row.dsrNo} (${row.customer}, ${AED(row.mrc)}) will be cancelled. The agent and Team Leader will be notified.`,
      confirmLabel: 'Yes, cancel the order',
      color: 'red',
    });
    if (!ok) return;
    try {
      await approveOrderCancellation(row._id);
      notifications.show({ color: 'green', message: 'Cancellation approved — the order is now cancelled' });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not approve', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleReject = async (values) => {
    try {
      await rejectOrderCancellation(rejectRow._id, values.reason);
      notifications.show({ color: 'green', message: 'Cancellation rejected — the order is unfrozen' });
      setRejectRow(null);
      rejectForm.reset();
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not reject', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  if (!rows.length) return null;

  return (
    <>
      <Alert color="red" variant="light" icon={<Ban size={16} />} title={`${rows.length} order${rows.length === 1 ? '' : 's'} awaiting your cancellation decision`}>
        <Stack gap="sm" mt="xs">
          {rows.map((row) => (
            <Paper key={row._id} withBorder p="sm" radius="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>{row.orderNo || row.dsrNo}</Text>
                    {row.direct && <Tag size="xs" color="grape">Direct</Tag>}
                    <Text size="sm">— {row.customer}</Text>
                    <Text size="sm" c="dimmed">({AED(row.mrc)}, {row.status})</Text>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    {row.cancellationRequestedBy?.name || 'Someone'} · agent {row.agentId?.name || '—'}
                    {row.cancellationRequestedAt ? ` · ${new Date(row.cancellationRequestedAt).toLocaleString()}` : ''}
                  </Text>
                  <Text size="sm" mt={4}>"{row.cancellationReason}"</Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <Button size="xs" color="red" onClick={() => handleApprove(row)}>Approve</Button>
                  <Button size="xs" variant="default" onClick={() => setRejectRow(row)}>Reject</Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Alert>

      <Modal opened={!!rejectRow} onClose={() => { setRejectRow(null); rejectForm.reset(); }} title="Reject cancellation request" size="md">
        <form onSubmit={rejectForm.onSubmit(handleReject)}>
          <Stack gap="sm">
            <Text size="sm">
              Order <b>{rejectRow?.orderNo || rejectRow?.dsrNo}</b> ({rejectRow?.customer}) stays as it is and unfreezes.
              The requester will see your reason.
            </Text>
            <Textarea label="Why are you rejecting this?" withAsterisk {...rejectForm.getInputProps('reason')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setRejectRow(null); rejectForm.reset(); }}>Cancel</Button>
              <Button type="submit" color="red">Reject request</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
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

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: fetchDashboardSummary });
  const s = data?.data;

  const pending = s?.pipeline?.pendingApproval;

  return (
    <Stack>
      <PageToolbar
        title={<Title order={1} size="h3">Dashboard</Title>}
        subtitle={`Welcome back, ${user.name} — here's what's happening in your scope.`}
      />

      {/* Self-hiding when there's nothing to decide, so it never takes space from anyone who
          isn't a Sales Head with a pending request. */}
      <PendingCancellations />

      {!isLoading && s && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <StatCard label="DSR Calls Logged" value={s.dsr.total} sub={`${s.dsr.today} today`} color="blue" />
            <StatCard label="Interested Leads" value={s.dsr.byStatus?.Interested || 0} color="green" />
            <StatCard label="Deals Pending TL Approval" value={pending?.count || 0} sub={pending ? AED(pending.value) : undefined} color="yellow" />
            <StatCard
              label="Orders Activated (This Month)"
              value={s.thisMonth.activatedCount}
              sub={`${AED(s.thisMonth.activatedMrc)} MRC · ${AED(s.thisMonth.commission)} commission`}
              color="teal"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder p="md" radius="md" style={{ gridColumn: 'span 2' }}>
              <Text fw={600} mb="sm">Pipeline by Stage</Text>
              <Stack gap="xs">
                {Object.keys(s.pipeline.byStage).length === 0 && <Text c="dimmed" size="sm">No deals yet</Text>}
                {Object.entries(s.pipeline.byStage).map(([stage, v]) => (
                  <Group key={stage} justify="space-between">
                    <Tag>{stage}</Tag>
                    <Text size="sm">{v.count} deal{v.count === 1 ? '' : 's'} · {AED(v.value)}</Text>
                  </Group>
                ))}
              </Stack>
              <Text size="xs" c="dimmed" mt="sm">Pending Team Leader approval: {pending?.count || 0} · Open pipeline value: {AED(s.pipeline.openValue)}</Text>
            </Paper>

            <Paper withBorder p="md" radius="md">
              <Text fw={600} mb="sm">Target vs Achievement</Text>
              {s.target.applicable ? (
                <Center>
                  <RingProgress
                    size={140}
                    thickness={14}
                    roundCaps
                    sections={[{ value: Math.min(100, s.target.pct), color: s.target.pct >= 100 ? 'green' : s.target.pct >= 50 ? 'yellow' : 'red' }]}
                    label={<Text ta="center" fw={700} size="lg">{s.target.pct}%</Text>}
                  />
                </Center>
              ) : (
                <Text c="dimmed" size="sm">No sales target applies to this role</Text>
              )}
              {s.target.applicable && (
                <Text ta="center" size="xs" c="dimmed" mt="xs">
                  {AED(s.target.achievement)} of {AED(s.target.value)} (this month)
                </Text>
              )}
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper withBorder p="md" radius="md">
              <Text fw={600} mb="sm">Orders by Status</Text>
              <Stack gap="xs">
                {Object.keys(s.orders.byStatus).length === 0 && <Text c="dimmed" size="sm">No orders yet</Text>}
                {Object.entries(s.orders.byStatus).map(([status, v]) => (
                  <Group key={status} justify="space-between">
                    <Tag>{status}</Tag>
                    <Text size="sm">{v.count} · {AED(v.value)}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>

            <Paper withBorder p="md" radius="md">
              <Text fw={600} mb="sm">Recent Notifications</Text>
              <ScrollArea h={180} viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Recent notifications, scrollable' }}>
                <Stack gap="xs">
                  {(s.recentNotifications || []).length === 0 && <Text c="dimmed" size="sm">Nothing yet</Text>}
                  {(s.recentNotifications || []).map((n) => (
                    <Text key={n._id} size="sm" fw={n.read ? 400 : 600}>{n.text}</Text>
                  ))}
                </Stack>
              </ScrollArea>
            </Paper>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
