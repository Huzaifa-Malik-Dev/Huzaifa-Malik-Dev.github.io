import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Title, Text, Paper, SegmentedControl, Select, Group, Badge, Button, Loader, Center,
  SimpleGrid, NavLink, Tooltip, Switch, Alert,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { TriangleAlert } from 'lucide-react';
import {
  fetchPermissions,
  updateRolePermission,
  updateUserOverride,
  clearUserOverride,
  updateRoleImportExport,
  updateUserImportExportOverride,
  updateRoleAction,
  updateUserActionOverride,
} from '../../api/admin';
import { fetchEmployees } from '../../api/hr';
import { NAV_ITEMS, ROLE_LABELS } from '../../constants/nav';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const LEVEL_RANK = { none: 0, view: 1, edit: 2 };

function levelFor(view, edit, moduleKey) {
  if (edit?.includes(moduleKey)) return 'edit';
  if (view?.includes(moduleKey)) return 'view';
  return 'none';
}

// Anything in `list` that isn't in `roleDefault` - used to flag a person who has been granted
// more than their role normally gets, so an accidental over-grant doesn't go unnoticed.
function extras(list, roleDefault) {
  const roleSet = new Set(roleDefault || []);
  return (list || []).filter((k) => !roleSet.has(k));
}

export default function PermissionsPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('role');
  const [role, setRole] = useState('admin');
  const [personSearch, setPersonSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(personSearch, 300);
  const [selectedUser, setSelectedUser] = useState(null);

  const permsQuery = useQuery({ queryKey: ['admin', 'permissions'], queryFn: fetchPermissions });
  const perms = permsQuery.data?.data;

  const peopleQuery = useQuery({
    queryKey: ['hr', 'people-search', debouncedSearch],
    queryFn: () => fetchEmployees({ search: debouncedSearch || undefined, limit: 20 }),
    enabled: mode === 'person',
  });
  const people = peopleQuery.data?.data || [];

  const override = selectedUser ? perms?.userOverrides?.[selectedUser._id] : null;
  const effectiveView = mode === 'role' ? perms?.byRole?.[role] : (override?.view ?? perms?.byRole?.[selectedUser?.role]);
  const effectiveEdit = mode === 'role' ? perms?.editByRole?.[role] : (override?.edit ?? perms?.editByRole?.[selectedUser?.role]);
  const effectiveImportExport =
    mode === 'role' ? perms?.importExportByRole?.[role] : (override?.importExport ?? perms?.importExportByRole?.[selectedUser?.role]);
  const effectiveActions =
    mode === 'role' ? perms?.actionsByRole?.[role] : (override?.actions ?? perms?.actionsByRole?.[selectedUser?.role]);

  // Over-provisioning check (person mode only): compare this person's override against what
  // their role would normally get, across all three axes, so an accidental extra grant is
  // visible instead of silently sitting there.
  const roleDefaultView = perms?.byRole?.[selectedUser?.role] || [];
  const roleDefaultEdit = perms?.editByRole?.[selectedUser?.role] || [];
  const roleDefaultIE = perms?.importExportByRole?.[selectedUser?.role] || [];
  const roleDefaultActions = perms?.actionsByRole?.[selectedUser?.role] || [];
  const extraModuleAccess =
    mode === 'person' && override
      ? NAV_ITEMS.filter((item) => {
          const overrideLevel = levelFor(override.view, override.edit, item.key);
          const roleLevel = levelFor(roleDefaultView, roleDefaultEdit, item.key);
          return LEVEL_RANK[overrideLevel] > LEVEL_RANK[roleLevel];
        })
      : [];
  const extraImportExport = mode === 'person' && override ? extras(override.importExport, roleDefaultIE) : [];
  const extraActions = mode === 'person' && override ? extras(override.actions, roleDefaultActions) : [];
  const hasExtras = extraModuleAccess.length > 0 || extraImportExport.length > 0 || extraActions.length > 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'permissions'] });

  const handleChange = async (moduleKey, level) => {
    const moduleLabel = NAV_ITEMS.find((i) => i.key === moduleKey)?.label || moduleKey;
    try {
      if (mode === 'role') {
        await updateRolePermission({ role, module: moduleKey, level });
        notifications.show({ color: 'dark', message: `${ROLE_LABELS[role]} access to ${moduleLabel} set to "${level}"` });
      } else {
        if (!selectedUser) return;
        await updateUserOverride({ userId: selectedUser._id, module: moduleKey, level, role: selectedUser.role });
        notifications.show({ color: 'dark', message: `${selectedUser.name}'s access to ${moduleLabel} set to "${level}"` });
      }
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleImportExportChange = async (moduleKey, enabled) => {
    const moduleLabel = NAV_ITEMS.find((i) => i.key === moduleKey)?.label || moduleKey;
    try {
      if (mode === 'role') {
        await updateRoleImportExport({ role, module: moduleKey, enabled });
        notifications.show({ color: 'dark', message: `${ROLE_LABELS[role]} Import/Export for ${moduleLabel} ${enabled ? 'enabled' : 'disabled'}` });
      } else {
        if (!selectedUser) return;
        await updateUserImportExportOverride({ userId: selectedUser._id, module: moduleKey, enabled, role: selectedUser.role });
        notifications.show({ color: 'dark', message: `${selectedUser.name}'s Import/Export for ${moduleLabel} ${enabled ? 'enabled' : 'disabled'}` });
      }
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleActionChange = async (actionKey, enabled) => {
    const actionLabel = perms?.actionDefs?.find((a) => a.key === actionKey)?.label || actionKey;
    try {
      if (mode === 'role') {
        await updateRoleAction({ role, action: actionKey, enabled });
        notifications.show({ color: 'dark', message: `${ROLE_LABELS[role]} — "${actionLabel}" ${enabled ? 'enabled' : 'disabled'}` });
      } else {
        if (!selectedUser) return;
        await updateUserActionOverride({ userId: selectedUser._id, action: actionKey, enabled, role: selectedUser.role });
        notifications.show({ color: 'dark', message: `${selectedUser.name} — "${actionLabel}" ${enabled ? 'enabled' : 'disabled'}` });
      }
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not update', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const handleResetOverride = async () => {
    if (!selectedUser) return;
    try {
      await clearUserOverride(selectedUser._id);
      notifications.show({ color: 'dark', message: `${selectedUser.name} reset to role default` });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not reset', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const actingHasOwnOverride = !!perms?.userOverrides?.[currentUser.id];
  const isOwnAdminRow =
    mode === 'role'
      ? role === currentUser.role && !actingHasOwnOverride
      : selectedUser?._id === currentUser.id;

  const previewNav = useMemo(
    () => NAV_ITEMS.filter((item) => effectiveView?.includes(item.key)),
    [effectiveView]
  );

  if (permsQuery.isLoading) return <Center py="xl"><Loader size="sm" /></Center>;

  return (
    <Stack gap="md">
      <div>
        <Title order={4}>Permissions <Badge ml="xs" color="red" variant="light">EDITABLE</Badge></Title>
        <Text size="sm" c="dimmed">Pick a role to set the default for everyone in it, or a specific person to override just them. "Edit" always includes "View".</Text>
      </div>

      <Group align="flex-end">
        <SegmentedControl value={mode} onChange={setMode} data={[{ value: 'role', label: 'Role' }, { value: 'person', label: 'Person' }]} />
        {mode === 'role' ? (
          <Select data={ROLE_OPTIONS} value={role} onChange={setRole} w={240} />
        ) : (
          <Group align="flex-end">
            <Select
              placeholder="Search by name or username..."
              data={people.map((p) => ({ value: p._id, label: `${p.employeeId} — ${p.name} (${ROLE_LABELS[p.role]})` }))}
              value={selectedUser?._id || null}
              onChange={(id) => setSelectedUser(people.find((p) => p._id === id) || null)}
              searchable
              searchValue={personSearch}
              onSearchChange={setPersonSearch}
              nothingFoundMessage={peopleQuery.isFetching ? 'Searching...' : 'No matches'}
              clearable
              w={340}
            />
            {selectedUser && override && (
              <Tooltip
                label="Resetting would remove your own admin edit access - ask another admin instead"
                disabled={!(selectedUser._id === currentUser.id && !(perms?.editByRole?.[selectedUser.role] || []).includes('admin'))}
              >
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  onClick={handleResetOverride}
                  disabled={selectedUser._id === currentUser.id && !(perms?.editByRole?.[selectedUser.role] || []).includes('admin')}
                >
                  Reset to role default
                </Button>
              </Tooltip>
            )}
          </Group>
        )}
      </Group>

      {mode === 'person' && selectedUser && (
        <Text size="xs" c="dimmed">
          {override ? 'This person has a custom override.' : `Currently following the ${ROLE_LABELS[selectedUser.role]} role default.`}
        </Text>
      )}

      {mode === 'person' && selectedUser && hasExtras && (
        <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />} title={`${selectedUser.name} has MORE access than the ${ROLE_LABELS[selectedUser.role]} default`}>
          <Stack gap={2}>
            {extraModuleAccess.map((item) => (
              <Text key={item.key} size="xs">• {item.label}: {levelFor(override.view, override.edit, item.key)}</Text>
            ))}
            {extraImportExport.map((moduleKey) => (
              <Text key={moduleKey} size="xs">• {NAV_ITEMS.find((i) => i.key === moduleKey)?.label || moduleKey}: bulk import/export</Text>
            ))}
            {extraActions.map((actionKey) => (
              <Text key={actionKey} size="xs">• {perms?.actionDefs?.find((a) => a.key === actionKey)?.label || actionKey}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            {(mode === 'role' || selectedUser) &&
              NAV_ITEMS.map((item) => {
                const locked = item.key === 'admin' && isOwnAdminRow;
                const control = (
                  <SegmentedControl
                    size="xs"
                    value={levelFor(effectiveView, effectiveEdit, item.key)}
                    onChange={(level) => handleChange(item.key, level)}
                    disabled={locked}
                    data={[
                      { value: 'none', label: 'None' },
                      { value: 'view', label: 'View' },
                      { value: 'edit', label: 'Edit' },
                    ]}
                  />
                );
                return (
                  <Group key={item.key} justify="space-between">
                    <Group gap="xs">
                      <item.icon size={16} />
                      <Text size="sm">{item.label}</Text>
                    </Group>
                    {locked ? (
                      <Tooltip label="You can't change your own admin access - ask another admin to change this for you">
                        <div>{control}</div>
                      </Tooltip>
                    ) : (
                      control
                    )}
                  </Group>
                );
              })}
            {mode === 'person' && !selectedUser && <Text size="sm" c="dimmed">Search and select a person above.</Text>}

            {(mode === 'role' || selectedUser) && perms?.importExportModules?.length > 0 && (
              <>
                <Text size="xs" fw={600} c="dimmed" mt="sm">Bulk Import / Export</Text>
                <Text size="xs" c="dimmed" mb={4}>
                  Separate from View/Edit above — grants uploading/downloading spreadsheets of records, not just using the module.
                </Text>
                {NAV_ITEMS.filter((item) => perms.importExportModules.includes(item.key)).map((item) => (
                  <Group key={item.key} justify="space-between">
                    <Group gap="xs">
                      <item.icon size={16} />
                      <Text size="sm">{item.label}</Text>
                    </Group>
                    <Switch
                      checked={!!effectiveImportExport?.includes(item.key)}
                      onChange={(e) => handleImportExportChange(item.key, e.currentTarget.checked)}
                    />
                  </Group>
                ))}
              </>
            )}

            {(mode === 'role' || selectedUser) && perms?.actionDefs?.length > 0 && (
              <>
                <Text size="xs" fw={600} c="dimmed" mt="sm">Specific Actions</Text>
                <Text size="xs" c="dimmed" mb={4}>
                  Narrower than View/Edit — e.g. seeing Payroll history without being able to process or delete a run. Without one of these, the matching button is hidden, not just blocked.
                </Text>
                {perms.actionDefs.map((def) => {
                  const ModuleIcon = NAV_ITEMS.find((i) => i.key === def.module)?.icon;
                  return (
                    <Group key={def.key} justify="space-between">
                      <Group gap="xs">
                        {ModuleIcon && <ModuleIcon size={16} />}
                        <Text size="sm">{def.label}</Text>
                      </Group>
                      <Switch
                        checked={!!effectiveActions?.includes(def.key)}
                        onChange={(e) => handleActionChange(def.key, e.currentTarget.checked)}
                      />
                    </Group>
                  );
                })}
              </>
            )}
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Text size="sm" fw={600} mb="sm">Sidebar Preview</Text>
          <Stack gap={4}>
            {previewNav.length === 0 && <Text size="xs" c="dimmed">No modules visible.</Text>}
            {previewNav.map((item) => (
              <NavLink key={item.key} label={item.label} leftSection={<item.icon size={16} />} variant="light" active={item.key === 'dash'} />
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
