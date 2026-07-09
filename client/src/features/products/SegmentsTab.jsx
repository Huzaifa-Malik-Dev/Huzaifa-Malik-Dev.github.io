import { useState } from 'react';
import { Table, Button, Group, Modal, Stack, TextInput, Textarea, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Plus, Pencil, Power } from 'lucide-react';
import { fetchSegments, createSegment, updateSegment } from '../../api/segments';
import { useConfirm } from '../../context/ConfirmContext';

export default function SegmentsTab({ canEdit }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const segmentsQuery = useQuery({ queryKey: ['segments'], queryFn: fetchSegments });
  const segments = segmentsQuery.data?.data || [];

  const form = useForm({ initialValues: { name: '', description: '' } });
  const editForm = useForm({ initialValues: { name: '', description: '' } });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['segments'] });

  const openEdit = (row) => {
    setEditRow(row);
    editForm.setValues({ name: row.name, description: row.description });
  };

  const handleCreate = async (values) => {
    try {
      await createSegment(values);
      notifications.show({ color: 'dark', message: 'Segment created' });
      setCreateOpen(false);
      form.reset();
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not save', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleEdit = async (values) => {
    try {
      await updateSegment(editRow._id, values);
      notifications.show({ color: 'dark', message: 'Segment updated' });
      setEditRow(null);
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleToggleActive = async (row) => {
    const ok = await confirm({
      title: row.active ? 'Deactivate segment?' : 'Activate segment?',
      message: row.active
        ? `"${row.name}" will be hidden from new product assignments.`
        : `"${row.name}" will become available for new product assignments again.`,
      confirmLabel: row.active ? 'Yes, deactivate' : 'Yes, activate',
      color: row.active ? 'red' : 'green',
    });
    if (!ok) return;
    try {
      await updateSegment(row._id, { active: !row.active });
      notifications.show({ color: 'dark', message: `Segment ${row.active ? 'deactivated' : 'activated'}` });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div />
        {canEdit && (
          <Button leftSection={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Add Segment
          </Button>
        )}
      </Group>

      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Status</Table.Th>
              {canEdit && <Table.Th></Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {segments.map((s) => (
              <Table.Tr key={s._id}>
                <Table.Td>{s.name}</Table.Td>
                <Table.Td c="dimmed">{s.description || '-'}</Table.Td>
                <Table.Td>
                  <Badge color={s.active ? 'green' : 'gray'} variant="light">{s.active ? 'Active' : 'Inactive'}</Badge>
                </Table.Td>
                {canEdit && (
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Tooltip label="Edit segment">
                        <ActionIcon variant="light" size="lg" radius="md" onClick={() => openEdit(s)} aria-label="Edit segment">
                          <Pencil size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={s.active ? 'Deactivate' : 'Activate'}>
                        <ActionIcon variant="light" color={s.active ? 'orange' : 'green'} size="lg" radius="md" onClick={() => handleToggleActive(s)} aria-label="Toggle active">
                          <Power size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {segments.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={canEdit ? 4 : 3}>
                  <Text c="dimmed" ta="center" py="md">No segments yet</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add Segment" size="md">
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <TextInput label="Name" placeholder="e.g. e& Telecom" required {...form.getInputProps('name')} />
            <Textarea label="Description" {...form.getInputProps('description')} />
            <Button type="submit" mt="sm">Save Segment</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!editRow} onClose={() => setEditRow(null)} title={`Edit Segment — ${editRow?.name || ''}`} size="md">
        <form onSubmit={editForm.onSubmit(handleEdit)}>
          <Stack gap="sm">
            <TextInput label="Name" required {...editForm.getInputProps('name')} />
            <Textarea label="Description" {...editForm.getInputProps('description')} />
            <Button type="submit" mt="sm">Save changes</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
