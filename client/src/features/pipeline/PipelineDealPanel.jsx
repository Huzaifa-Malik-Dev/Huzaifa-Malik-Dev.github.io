import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Text, Paper, Group, Button, SimpleGrid, Select, NumberInput, TextInput,
  Textarea, Alert, Loader, Center, Divider, Modal, Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Check, X, Info, MessageCircle, Send } from 'lucide-react';
import { fetchPipelineOne, updatePipeline, escalateToTL, approvePipeline, rejectPipeline } from '../../api/pipeline';
import { fetchProducts } from '../../api/products';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useChat } from '../../context/ChatContext';

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

const PIPE_STAGES = ['10%- Prospect', '30% - Value Prop', '50% - Negotiation', '70% - Finalizing', '90% - Closing', '100% - Deal Won', '0% - Lost'];

const STAGE_COLOR = {
  '10%- Prospect': 'gray',
  '30% - Value Prop': 'blue',
  '50% - Negotiation': 'yellow',
  '70% - Finalizing': 'orange',
  '90% - Closing': 'teal',
  '100% - Deal Won': 'green',
  '0% - Lost': 'red',
};

const APPROVAL_INFO = {
  none: { color: 'gray', text: 'No Team Leader approval requested yet.' },
  pending_tl: { color: 'yellow', text: 'Waiting on the Team Leader to approve.' },
  approved: { color: 'green', text: 'Approved by Team Leader — order opened for Back Office.' },
  rejected: { color: 'red', text: 'Rejected by Team Leader.' },
};

// Confirm-step copy for each action - the whole point is the user should never be surprised
// by what a click does, matching the reference prototype's descriptive button labels.
const ACTION_INFO = {
  approve: {
    title: 'Approve this deal?',
    body: 'This opens an order and notifies Back Office to start processing it, and notifies the agent that their deal was approved.',
    color: 'green',
    confirmLabel: 'Yes, approve → Back Office',
  },
  reject: {
    title: 'Reject this deal?',
    body: 'The deal is returned to the agent as rejected and they are notified. You can add an optional reason below that the agent will see in the deal history.',
    color: 'red',
    confirmLabel: 'Yes, reject → return to agent',
  },
};

// Content-only panel (no page chrome) - rendered inside a Modal by PipelinePage so approving,
// rejecting, escalating, or editing a deal never navigates the user away from their place in the list.
export default function PipelineDealPanel({ dealId }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const confirm = useConfirm();
  const openChat = useChat();
  const canEdit = user.editModules?.includes('pipeline');
  const [confirmAction, setConfirmAction] = useState(null); // 'approve' | 'reject' | 'escalateSalesHead' | null

  const { data, isLoading } = useQuery({ queryKey: ['pipeline', 'one', dealId], queryFn: () => fetchPipelineOne(dealId) });
  const deal = data?.data;

  const productsQuery = useQuery({ queryKey: ['products', 'options'], queryFn: () => fetchProducts({ limit: 200 }) });
  const products = productsQuery.data?.data || [];
  const categories = [...new Set(products.map((p) => p.cat))];

  const reasonForm = useForm({ initialValues: { reason: '' } });

  const editForm = useForm({
    initialValues: {
      cat: '', product: '', sr: '', price: 0, qty: 1, stage: '10%- Prospect',
      email: '', startedDate: '', expectedCloseDate: '', director: '', directorInvolvement: '', remarks: '',
    },
  });

  useEffect(() => {
    if (deal) {
      editForm.setValues({
        cat: deal.cat, product: deal.product, sr: deal.sr || '', price: deal.price, qty: deal.qty, stage: deal.stage,
        email: deal.email || '', startedDate: deal.startedDate || '', expectedCloseDate: deal.expectedCloseDate || '',
        director: deal.director || '', directorInvolvement: deal.directorInvolvement || '', remarks: deal.remarks,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?._id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline', 'one', dealId] });
  };

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;
  if (!deal) return <Text c="dimmed">Deal not found</Text>;

  const isTlOrAdmin = user.role === 'admin' || String(deal.tlId?._id || deal.tlId) === String(user.id);
  const isOwnerOrTlOrAdmin = isTlOrAdmin || String(deal.agentId?._id) === String(user.id);
  const canAct = canEdit && isOwnerOrTlOrAdmin;
  const canEditFields = canAct;
  const approvalInfo = APPROVAL_INFO[deal.approval] || APPROVAL_INFO.none;

  const handleSaveDeal = async (values) => {
    if (values.stage === '100% - Deal Won' && deal.stage !== '100% - Deal Won') {
      const ok = await confirm({
        title: 'Mark this deal as Won?',
        message: 'This opens an order and notifies Back Office to start processing it.',
        confirmLabel: 'Yes, mark Won',
        color: 'green',
      });
      if (!ok) return;
    }
    try {
      await updatePipeline(deal._id, values);
      notifications.show({ color: 'dark', message: 'Deal updated' });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleRequestApproval = async () => {
    const ok = await confirm({
      title: 'Request Team Leader approval?',
      message: `This notifies ${deal.tlId?.name || 'your Team Leader'} to review this deal.`,
      confirmLabel: 'Yes, request approval',
      color: 'blue',
    });
    if (!ok) return;
    try {
      await escalateToTL(deal._id);
      notifications.show({ color: 'dark', message: 'Sent to Team Leader for approval' });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not request approval', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleConfirm = async (values) => {
    try {
      if (confirmAction === 'approve') {
        await approvePipeline(deal._id);
        notifications.show({ color: 'dark', message: 'Approved and sent to Back Office' });
      } else if (confirmAction === 'reject') {
        await rejectPipeline(deal._id, values.reason);
        notifications.show({ color: 'dark', message: 'Rejected and returned to the agent' });
      }
      setConfirmAction(null);
      reasonForm.reset();
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not complete action', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const productOptions = products.filter((p) => !editForm.values.cat || p.cat === editForm.values.cat).map((p) => p.title);
  const info = confirmAction ? ACTION_INFO[confirmAction] : null;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Alert icon={<Info size={16} />} color="blue" variant="light" flex={1}>
          Ref <b>{deal.dsrNo}</b> — this reference number carries through to Back Office when the deal is won and never changes.
        </Alert>
        <Button variant="light" leftSection={<MessageCircle size={16} />} onClick={() => openChat(deal.dsrNo)}>
          Chat
        </Button>
      </Group>

      <Group>
        <Badge size="lg" color={STAGE_COLOR[deal.stage] || 'gray'} variant="light">{deal.stage}</Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper withBorder p="md" radius="md">
          <Divider label="Opportunity" labelPosition="left" mb="sm" />
          <form onSubmit={editForm.onSubmit(handleSaveDeal)}>
            <Stack gap="sm">
              <Group grow>
                <div>
                  <Text size="xs" c="dimmed">Customer</Text>
                  <Text size="sm">{deal.customer || '—'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Agent</Text>
                  <Text size="sm">{deal.agentId?.name || '—'}</Text>
                </div>
              </Group>
              <Select label="Stage" data={PIPE_STAGES} disabled={!canEditFields} {...editForm.getInputProps('stage')} />
              <Select label="Category" data={categories} disabled={!canEditFields} {...editForm.getInputProps('cat')} />
              <Select label="Product" data={productOptions} disabled={!canEditFields} {...editForm.getInputProps('product')} />
              <TextInput label="Subscription Type (NEW / MNP / MIG / B-ON ...)" disabled={!canEditFields} {...editForm.getInputProps('sr')} />
              <Group grow>
                <NumberInput label="Unit Price (MRC)" min={0} disabled={!canEditFields} {...editForm.getInputProps('price')} />
                <NumberInput label="Quantity" min={1} disabled={!canEditFields} {...editForm.getInputProps('qty')} />
              </Group>
              <Group grow>
                <div>
                  <Text size="xs" c="dimmed">MRC / month</Text>
                  <Text size="sm" fw={600}>{AED(deal.mrc)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Annual</Text>
                  <Text size="sm" fw={600}>{AED(deal.annual)}</Text>
                </div>
              </Group>
              <TextInput label="Customer Email" disabled={!canEditFields} {...editForm.getInputProps('email')} />
              <Group grow>
                <TextInput type="date" label="Started Date" disabled={!canEditFields} {...editForm.getInputProps('startedDate')} />
                <TextInput type="date" label="Expected Close Date" disabled={!canEditFields} {...editForm.getInputProps('expectedCloseDate')} />
              </Group>
              <Group grow>
                <TextInput label="Director" disabled={!canEditFields} {...editForm.getInputProps('director')} />
                <TextInput label="Director Involvement" disabled={!canEditFields} {...editForm.getInputProps('directorInvolvement')} />
              </Group>
              <Textarea label="Remarks" disabled={!canEditFields} {...editForm.getInputProps('remarks')} />
              {canEditFields && <Button type="submit">Save Changes</Button>}
            </Stack>
          </form>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Divider label="Team Leader Approval" labelPosition="left" mb="sm" />
          <Alert color={approvalInfo.color} variant="light">{approvalInfo.text}</Alert>

          <Divider label="Actions" labelPosition="left" mt="md" mb="sm" />
          {canAct ? (
            <Stack gap="xs">
              {deal.approval !== 'pending_tl' && deal.approval !== 'approved' && (
                <Button variant="light" leftSection={<Send size={16} />} onClick={handleRequestApproval}>
                  {deal.approval === 'rejected' ? 'Re-request Team Leader Approval' : 'Request Team Leader Approval'}
                </Button>
              )}
              {isTlOrAdmin && deal.approval === 'pending_tl' && (
                <>
                  <Button color="green" leftSection={<Check size={16} />} onClick={() => setConfirmAction('approve')}>
                    Approve → Back Office
                  </Button>
                  <Button color="red" variant="light" leftSection={<X size={16} />} onClick={() => setConfirmAction('reject')}>
                    Reject → Return to Agent
                  </Button>
                </>
              )}
              {deal.approval === 'approved' && (
                <Text size="sm" c="dimmed">Already approved and sent to Back Office — nothing more to do here.</Text>
              )}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">Only the deal owner, their Team Leader, or an admin can act on this deal.</Text>
          )}

          <Divider label="History" labelPosition="left" mt="md" mb="sm" />
          <Stack gap={6}>
            {(deal.history || []).slice().reverse().map((h, i) => (
              <Text key={i} size="xs" c="dimmed">
                <b>{h.userId?.name || 'System'}</b> — {h.text} <Text span c="dimmed">({new Date(h.ts).toLocaleString()})</Text>
              </Text>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Modal opened={!!confirmAction} onClose={() => setConfirmAction(null)} title={info?.title} size="md">
        <form onSubmit={reasonForm.onSubmit(handleConfirm)}>
          <Stack gap="sm">
            <Text size="sm">{info?.body}</Text>
            {(confirmAction === 'reject' || confirmAction === 'escalateSalesHead') && (
              <Textarea label="Reason (optional)" {...reasonForm.getInputProps('reason')} />
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button type="submit" color={info?.color}>{info?.confirmLabel}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
