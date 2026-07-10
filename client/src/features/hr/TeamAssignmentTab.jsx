import { useNavigate } from 'react-router-dom';
import { Stack, Paper, Group, Select, Badge, Text, Loader, Center, Accordion, Avatar, Box } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '../../utils/toast';
import { fetchEmployees, updateEmployee } from '../../api/hr';
import { useConfirm } from '../../context/ConfirmContext';
import { colorFor, initials } from '../../utils/avatar';
import { employeeUrlId } from './employeeUrl';

// Full reporting chain this app has: Sales Head -> Teams Head -> Team Leader -> Agent.
// Rendered as a tree (Teams Head as the expandable top level, indentation shows depth) so the
// whole org shows at a glance instead of one flat "agent -> TL" list with no way to move
// Team Leaders between Teams Heads.
function PersonLabel({ person, navigate, size = 'sm' }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Avatar size={size === 'sm' ? 22 : 26} radius="xl" color={colorFor(person.name)}>{initials(person.name)}</Avatar>
      <div>
        <Text
          size={size}
          fw={600}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/hr/employees/${employeeUrlId(person.employeeId)}`)}
          title="Open profile"
        >
          {person.name}
        </Text>
        {person.desig && <Text size="xs" c="dimmed">{person.desig}</Text>}
      </div>
    </Group>
  );
}

export default function TeamAssignmentTab({ canEdit }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const thQuery = useQuery({ queryKey: ['hr', 'teams-heads'], queryFn: () => fetchEmployees({ role: 'teams_head', limit: 200 }) });
  const tlQuery = useQuery({ queryKey: ['hr', 'team-leaders'], queryFn: () => fetchEmployees({ role: 'team_leader', limit: 200 }) });
  const agentQuery = useQuery({ queryKey: ['hr', 'agents'], queryFn: () => fetchEmployees({ role: 'agent', limit: 200 }) });

  if (thQuery.isLoading || tlQuery.isLoading || agentQuery.isLoading) {
    return <Center py="xl"><Loader size="sm" /></Center>;
  }

  const teamsHeads = thQuery.data?.data || [];
  const teamLeaders = tlQuery.data?.data || [];
  const agents = agentQuery.data?.data || [];

  const thOptions = teamsHeads.map((th) => ({ value: th._id, label: th.name }));
  const tlOptions = teamLeaders.map((tl) => ({ value: tl._id, label: tl.name }));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['hr'] });

  const handleReassign = async (person, newManagerId, newManagerName, levelLabel) => {
    const ok = await confirm({
      title: `Reassign ${person.name}?`,
      message: `Move ${person.name} to report to ${newManagerName} as their ${levelLabel}? This takes effect immediately and everyone below them moves with them.`,
      confirmLabel: 'Yes, reassign',
      color: 'blue',
    });
    if (!ok) return;
    try {
      await updateEmployee(person._id, { reportsTo: newManagerId });
      notifications.show({ color: 'green', message: `${person.name} now reports to ${newManagerName}` });
      refresh();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not reassign', message: err.response?.data?.error || 'Something went wrong' });
    }
  };

  const unassignedTLs = teamLeaders.filter((tl) => !tl.reportsTo);
  const unassignedAgents = agents.filter((a) => !a.reportsTo);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        The full reporting chain: Teams Head → Team Leader → Agent. Click a name to open their profile, or use the dropdown to move them under a different manager.
      </Text>

      {teamsHeads.length === 0 ? (
        <Text size="sm" c="dimmed">No Teams Heads yet.</Text>
      ) : (
        <Accordion multiple defaultValue={teamsHeads.map((th) => th._id)} variant="separated" radius="md">
          {teamsHeads.map((th) => {
            const myTLs = teamLeaders.filter((tl) => String(tl.reportsTo) === String(th._id));
            const tlIds = new Set(myTLs.map((tl) => String(tl._id)));
            const agentCount = agents.filter((a) => tlIds.has(String(a.reportsTo))).length;
            return (
              <Accordion.Item key={th._id} value={th._id}>
                <Accordion.Control>
                  <Group justify="space-between" pr="sm" wrap="nowrap">
                    <PersonLabel person={th} navigate={navigate} />
                    <Group gap={6} wrap="nowrap">
                      <Badge variant="light" size="sm">{myTLs.length} team leader{myTLs.length === 1 ? '' : 's'}</Badge>
                      <Badge variant="light" color="gray" size="sm">{agentCount} agent{agentCount === 1 ? '' : 's'}</Badge>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm" pl="md" style={{ borderLeft: '2px solid var(--mantine-color-default-border)' }}>
                    {myTLs.length === 0 && <Text size="sm" c="dimmed">No team leaders assigned to this Teams Head yet.</Text>}
                    {myTLs.map((tl) => {
                      const myAgents = agents.filter((a) => String(a.reportsTo) === String(tl._id));
                      return (
                        <Paper key={tl._id} withBorder p="sm" radius="md">
                          <Group justify="space-between" wrap="nowrap">
                            <PersonLabel person={tl} navigate={navigate} />
                            <Group gap="xs" wrap="nowrap">
                              <Badge variant="light" size="xs">{myAgents.length} agent{myAgents.length === 1 ? '' : 's'}</Badge>
                              {canEdit && (
                                <Select
                                  label="Reports to (Teams Head)"
                                  data={thOptions}
                                  value={th._id}
                                  onChange={(v) => v && v !== th._id && handleReassign(tl, v, thOptions.find((o) => o.value === v)?.label, 'Teams Head')}
                                  size="xs"
                                  w={190}
                                  aria-label={`Reassign ${tl.name} to a different Teams Head`}
                                />
                              )}
                            </Group>
                          </Group>

                          <Box
                            mt="sm"
                            pl="md"
                            py={myAgents.length ? 'xs' : 0}
                            style={{
                              borderLeft: '2px dashed var(--mantine-color-default-border)',
                              background: myAgents.length ? 'var(--mantine-color-default-hover)' : 'transparent',
                              borderRadius: 6,
                            }}
                          >
                            <Stack gap={8}>
                              {myAgents.length === 0 && <Text size="xs" c="dimmed">No agents assigned to this Team Leader yet.</Text>}
                              {myAgents.map((agent) => (
                                <Group key={agent._id} justify="space-between" wrap="nowrap">
                                  <PersonLabel person={agent} navigate={navigate} size="xs" />
                                  {canEdit && (
                                    <Select
                                      label="Reports to (Team Leader)"
                                      data={tlOptions}
                                      value={tl._id}
                                      onChange={(v) => v && v !== tl._id && handleReassign(agent, v, tlOptions.find((o) => o.value === v)?.label, 'Team Leader')}
                                      size="xs"
                                      w={190}
                                      aria-label={`Reassign ${agent.name} to a different Team Leader`}
                                    />
                                  )}
                                </Group>
                              ))}
                            </Stack>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      {unassignedTLs.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Group mb="sm" gap="xs">
            <Text fw={600} size="sm">Unassigned Team Leaders</Text>
            <Badge variant="light" color="orange" size="sm">{unassignedTLs.length}</Badge>
          </Group>
          <Stack gap="xs">
            {unassignedTLs.map((tl) => (
              <Group key={tl._id} justify="space-between" wrap="nowrap">
                <PersonLabel person={tl} navigate={navigate} />
                {canEdit && (
                  <Select
                    data={thOptions}
                    placeholder="Assign to Teams Head..."
                    onChange={(v) => v && handleReassign(tl, v, thOptions.find((o) => o.value === v)?.label, 'Teams Head')}
                    size="xs"
                    w={200}
                  />
                )}
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {unassignedAgents.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Group mb="sm" gap="xs">
            <Text fw={600} size="sm">Unassigned Agents</Text>
            <Badge variant="light" color="orange" size="sm">{unassignedAgents.length}</Badge>
          </Group>
          <Stack gap="xs">
            {unassignedAgents.map((agent) => (
              <Group key={agent._id} justify="space-between" wrap="nowrap">
                <PersonLabel person={agent} navigate={navigate} size="xs" />
                {canEdit && (
                  <Select
                    data={tlOptions}
                    placeholder="Assign to Team Leader..."
                    onChange={(v) => v && handleReassign(agent, v, tlOptions.find((o) => o.value === v)?.label, 'Team Leader')}
                    size="xs"
                    w={200}
                  />
                )}
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
