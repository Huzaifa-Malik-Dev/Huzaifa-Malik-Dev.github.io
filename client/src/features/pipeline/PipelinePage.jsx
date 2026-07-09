import { useMemo, useState } from 'react';
import { Title, Group, Badge, Paper, Select, Stack, Text, Tooltip, Modal, ActionIcon, Indicator } from '@mantine/core';
import { Bell, MessageCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import ImportExportBar from '../../components/ImportExportBar';
import { usePagedList } from '../../hooks/usePagedList';
import { useThreadUnreadCounts } from '../../hooks/useNotifications';
import { fetchPipelineList, exportPipeline, importPipeline } from '../../api/pipeline';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import PipelineDealPanel from './PipelineDealPanel';

const STAGES = ['10%- Prospect', '30% - Value Prop', '50% - Negotiation', '70% - Finalizing', '90% - Closing', '100% - Deal Won', '0% - Lost'];
const APPROVAL_OPTIONS = [
  { value: 'none', label: 'No approval requested' },
  { value: 'pending_tl', label: 'Pending Team Leader' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STAGE_COLOR = {
  '10%- Prospect': 'gray',
  '30% - Value Prop': 'blue',
  '50% - Negotiation': 'yellow',
  '70% - Finalizing': 'orange',
  '90% - Closing': 'teal',
  '100% - Deal Won': 'green',
  '0% - Lost': 'red',
};

const APPROVAL_COLOR = { none: 'gray', pending_tl: 'yellow', approved: 'green', rejected: 'red' };
const APPROVAL_LABEL = { none: '', pending_tl: 'Pending TL', approved: 'TL Approved', rejected: 'TL Rejected' };

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

export default function PipelinePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stageFilter, setStageFilter] = useState(null);
  const [approvalFilter, setApprovalFilter] = useState(null);
  const [openDealId, setOpenDealId] = useState(null);
  const openChat = useChat();

  const list = usePagedList(['pipeline'], fetchPipelineList, {
    filters: { stage: stageFilter || undefined, approval: approvalFilter || undefined },
  });

  const visibleDsrNos = useMemo(() => (list.data || []).map((r) => r.dsrNo), [list.data]);
  const { data: unreadData } = useThreadUnreadCounts(visibleDsrNos);
  const unreadCounts = unreadData?.data || {};

  const columns = useMemo(
    () => [
      {
        id: 'needsMe',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          const needsMe = row.approval === 'pending_tl' && (user.role === 'admin' || String(row.tlId) === String(user.id));
          return needsMe ? (
            <Tooltip label="Awaiting your approval">
              <Bell size={14} color="var(--mantine-color-yellow-6)" />
            </Tooltip>
          ) : null;
        },
      },
      { accessorKey: 'dsrNo', header: 'DSR No.' },
      { accessorKey: 'company', header: 'Company' },
      { accessorKey: 'customer', header: 'Customer' },
      {
        // Category folded into the Product column (as dimmed subtext) instead of its own
        // column — the two are almost always read together, and one fewer column leaves more
        // horizontal room for the rest on narrower laptop screens.
        id: 'product',
        header: 'Product',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <Text size="sm">{row.product || '—'}</Text>
              {row.cat && <Text size="xs" c="dimmed">{row.cat}</Text>}
            </div>
          );
        },
      },
      { accessorKey: 'qty', header: 'Qty' },
      // Annual is just MRC × 12 — showing both is redundant column space; Annual still shows in
      // the deal detail modal for anyone who wants it broken out.
      { accessorKey: 'mrc', header: 'MRC', cell: (info) => AED(info.getValue()) },
      { accessorKey: 'agentId', header: 'Agent', cell: (info) => info.getValue()?.name || '-' },
      {
        accessorKey: 'stage',
        header: 'Stage',
        cell: (info) => <Badge color={STAGE_COLOR[info.getValue()] || 'gray'} variant="light">{info.getValue()}</Badge>,
      },
      {
        accessorKey: 'approval',
        header: 'Approval',
        cell: (info) => {
          const row = info.row.original;
          return APPROVAL_LABEL[row.approval] ? (
            <Badge color={APPROVAL_COLOR[row.approval]} variant="light">{APPROVAL_LABEL[row.approval]}</Badge>
          ) : (
            <Text size="xs" c="dimmed">—</Text>
          );
        },
      },
      {
        id: 'action',
        header: '',
        cell: (info) => {
          const row = info.row.original;
          return (
            <Tooltip label="Chat about this deal (tag teammates, see full history)">
              <Indicator
                label={unreadCounts[row.dsrNo] > 9 ? '9+' : unreadCounts[row.dsrNo]}
                disabled={!unreadCounts[row.dsrNo]}
                size={16}
                color="red"
                offset={4}
              >
                <ActionIcon
                  variant="light"
                  size="lg"
                  radius="md"
                  onClick={(e) => { e.stopPropagation(); openChat(row.dsrNo); }}
                  aria-label="Chat"
                >
                  <MessageCircle size={18} />
                </ActionIcon>
              </Indicator>
            </Tooltip>
          );
        },
      },
    ],
    [user.id, user.role, unreadCounts]
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Sales Pipeline</Title>
        <Group gap="sm">
          <Select placeholder="All stages" data={STAGES} value={stageFilter} onChange={setStageFilter} clearable w={200} />
          <Select placeholder="All approval states" data={APPROVAL_OPTIONS} value={approvalFilter} onChange={setApprovalFilter} clearable w={200} />
          <ImportExportBar
            moduleKey="pipeline"
            filenamePrefix="pipeline"
            exportFn={exportPipeline}
            importFn={importPipeline}
            onImported={() => { queryClient.invalidateQueries({ queryKey: ['pipeline'] }); list.refetch(); }}
          />
        </Group>
      </Group>
      <Text size="sm" c="dimmed">Click a deal to view details, edit it, or move it through the approval workflow.</Text>

      <Paper withBorder p="md" radius="md">
        <DataTable
          columns={columns}
          data={list.data}
          totalRowCount={list.totalRowCount}
          page={list.page}
          limit={list.limit}
          onPageChange={list.onPageChange}
          search={list.search}
          onSearchChange={list.onSearchChange}
          isLoading={list.isLoading}
          emptyLabel="No deals in the pipeline yet — convert an Interested DSR to get started"
          onRowClick={(row) => setOpenDealId(row._id)}
        />
      </Paper>

      <Modal
        opened={!!openDealId}
        onClose={() => setOpenDealId(null)}
        title="Deal Details"
        size="70rem"
      >
        {openDealId && <PipelineDealPanel dealId={openDealId} />}
      </Modal>
    </Stack>
  );
}
