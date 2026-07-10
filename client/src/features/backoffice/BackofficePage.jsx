import { useMemo, useState } from 'react';
import { Title, Group, Badge, Paper, Select, Modal, Stack, TextInput, Textarea, NumberInput, ActionIcon, SimpleGrid, Button, Tooltip, Indicator } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { MessageCircle } from 'lucide-react';
import DataTable from '../../components/DataTable';
import ImportExportBar from '../../components/ImportExportBar';
import { usePagedList } from '../../hooks/usePagedList';
import { useThreadUnreadCounts } from '../../hooks/useNotifications';
import { fetchOrderList, updateOrderStatus, updateOrder, exportOrders, importOrders } from '../../api/orders';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useChat } from '../../context/ChatContext';

const ORDER_STATUS = ['New', 'E& In-process', 'On Hold', 'Activated', 'Closed', 'Cancelled'];

const STATUS_COLOR = {
  New: 'gray',
  'E& In-process': 'blue',
  'On Hold': 'yellow',
  Activated: 'green',
  Closed: 'teal',
  Cancelled: 'red',
};

function AED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}

export default function BackofficePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const openChat = useChat();
  const canEdit = user.editModules?.includes('backoffice');
  const canChangeStatus = user.editModules?.includes('backoffice.statusChange');
  const [statusFilter, setStatusFilter] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const list = usePagedList(['orders'], fetchOrderList, { filters: { status: statusFilter || undefined } });

  const visibleDsrNos = useMemo(() => (list.data || []).map((r) => r.dsrNo), [list.data]);
  const { data: unreadData } = useThreadUnreadCounts(visibleDsrNos);
  const unreadCounts = unreadData?.data || {};

  const editForm = useForm({
    initialValues: {
      subDate: '', contact: '', contactNo: '', email: '', pid: '', ord: '', eOrderNo: '', sr: 'NEW',
      cat: '', product: '', contract: '12 Months', qty: 1, mrc: '', eAcctMgr: '', actDate: '', commission: '', remarks: '',
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    list.refetch();
  };

  const handleStatusChange = async (row, status) => {
    const ok = await confirm({
      title: 'Change order status?',
      message: `Set order ${row.dsrNo} (${row.customer}) status from "${row.status}" to "${status}"? The agent and Team Leader will be notified.`,
      confirmLabel: `Yes, set to "${status}"`,
      color: 'blue',
    });
    if (!ok) return;
    try {
      await updateOrderStatus(row._id, { status });
      notifications.show({ color: 'green', message: `${row.dsrNo} status changed to "${status}"` });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    editForm.setValues({
      subDate: row.subDate || '', contact: row.contact || '', contactNo: row.contactNo || '', email: row.email || '', pid: row.pid || '',
      ord: row.ord || '', eOrderNo: row.eOrderNo || '', sr: row.sr || 'NEW', cat: row.cat || '', product: row.product || '',
      contract: row.contract || '12 Months', qty: row.qty || 1, mrc: row.mrc || '', eAcctMgr: row.eAcctMgr || '',
      actDate: row.actDate || '', commission: row.commission || '', remarks: row.remarks || '',
    });
  };

  const handleEdit = async (values) => {
    try {
      const payload = {
        ...values,
        mrc: values.mrc === '' ? 0 : values.mrc,
        commission: values.commission === '' ? 0 : values.commission,
      };
      await updateOrder(editRow._id, payload);
      notifications.show({ color: 'green', message: 'Order updated' });
      setEditRow(null);
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'dsrNo', header: 'DSR No.' },
      { accessorKey: 'customer', header: 'Customer' },
      { accessorKey: 'product', header: 'Product' },
      { accessorKey: 'qty', header: 'Qty' },
      { accessorKey: 'mrc', header: 'MRC', cell: (info) => AED(info.getValue()) },
      { accessorKey: 'agentId', header: 'Agent', cell: (info) => info.getValue()?.name || '-' },
      { accessorKey: 'eOrderNo', header: 'e& Order No.' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const row = info.row.original;
          if (!canChangeStatus) return <Badge color={STATUS_COLOR[row.status] || 'gray'} variant="light">{row.status}</Badge>;
          return (
            <Select
              data={ORDER_STATUS}
              value={row.status}
              onChange={(v) => v && handleStatusChange(row, v)}
              size="xs"
              w={160}
              aria-label={`Change status for order ${row.eOrderNo || row._id}`}
            />
          );
        },
      },
      { accessorKey: 'commission', header: 'Commission', cell: (info) => AED(info.getValue()) },
      {
        id: 'action',
        header: 'Actions',
        cell: (info) => (
          <Tooltip label="Chat about this order (tag teammates, see full history)">
            <Indicator
              label={unreadCounts[info.row.original.dsrNo] > 9 ? '9+' : unreadCounts[info.row.original.dsrNo]}
              disabled={!unreadCounts[info.row.original.dsrNo]}
              size={16}
              color="red"
              offset={4}
            >
              <ActionIcon
                variant="light"
                size="lg"
                radius="md"
                onClick={(e) => { e.stopPropagation(); openChat(info.row.original.dsrNo); }}
                aria-label="Chat"
              >
                <MessageCircle size={18} />
              </ActionIcon>
            </Indicator>
          </Tooltip>
        ),
      },
    ],
    [canEdit, canChangeStatus, unreadCounts]
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1} size="h3">Back Office / Orders</Title>
        <Group gap="sm">
          <Select placeholder="All statuses" data={ORDER_STATUS} value={statusFilter} onChange={setStatusFilter} clearable w={200} />
          <ImportExportBar
            moduleKey="backoffice"
            filenamePrefix="orders"
            exportFn={exportOrders}
            importFn={importOrders}
            onImported={refresh}
          />
        </Group>
      </Group>

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
          emptyLabel="No orders yet — approve a pipeline deal to open one"
          onRowClick={openEdit}
        />
      </Paper>

      <Modal opened={!!editRow} onClose={() => setEditRow(null)} title={`Order — ${editRow?.dsrNo || ''}`} size="lg">
        <form onSubmit={editForm.onSubmit(handleEdit)}>
          <Stack gap="sm">
            <SimpleGrid cols={2}>
              <TextInput type="date" label="Submission Date" disabled={!canEdit} {...editForm.getInputProps('subDate')} />
              <TextInput type="date" label="Activation Date" disabled={!canEdit} {...editForm.getInputProps('actDate')} />
              <TextInput label="Contact Person" disabled={!canEdit} {...editForm.getInputProps('contact')} />
              <TextInput label="Contact No." disabled={!canEdit} {...editForm.getInputProps('contactNo')} />
              <TextInput label="Email" disabled={!canEdit} {...editForm.getInputProps('email')} />
              <TextInput label="PID" disabled={!canEdit} {...editForm.getInputProps('pid')} />
              <TextInput label="Order No." disabled={!canEdit} {...editForm.getInputProps('ord')} />
              <TextInput label="e& Order No." disabled={!canEdit} {...editForm.getInputProps('eOrderNo')} />
              <TextInput label="Subscription Type (NEW / MNP / MIG ...)" disabled={!canEdit} {...editForm.getInputProps('sr')} />
              <TextInput label="Category" disabled={!canEdit} {...editForm.getInputProps('cat')} />
              <TextInput label="Product" disabled={!canEdit} {...editForm.getInputProps('product')} />
              <TextInput label="Contract" disabled={!canEdit} {...editForm.getInputProps('contract')} />
              <TextInput label="e& Account Manager" disabled={!canEdit} {...editForm.getInputProps('eAcctMgr')} />
              <NumberInput label="Quantity" min={1} disabled={!canEdit} {...editForm.getInputProps('qty')} />
              <NumberInput label="MRC (AED)" min={0} disabled={!canEdit} {...editForm.getInputProps('mrc')} />
              <NumberInput label="Commission (AED)" min={0} disabled={!canEdit} {...editForm.getInputProps('commission')} />
            </SimpleGrid>
            <Textarea label="Remarks" disabled={!canEdit} {...editForm.getInputProps('remarks')} />
            {canEdit && <Button type="submit" mt="sm">Save changes</Button>}
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
