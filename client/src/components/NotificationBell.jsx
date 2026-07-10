import { useState } from 'react';
import { Popover, ActionIcon, Indicator, ScrollArea, Stack, Text, Group, Button, Divider } from '@mantine/core';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useUnreadCount, useNotificationActions } from '../hooks/useNotifications';
import { fetchNotifications } from '../api/notifications';

export default function NotificationBell() {
  const { user } = useAuth();
  const openChat = useChat();
  const [opened, setOpened] = useState(false);
  const { data: countData } = useUnreadCount(!!user);
  const { markRead, markAllRead } = useNotificationActions();

  const handleClick = (n) => {
    if (!n.read) markRead(n._id);
    if (n.refType === 'thread' && n.dsrNo) {
      openChat(n.dsrNo);
      setOpened(false);
    }
  };

  // Full list is only fetched when the popover opens — the poll above only ever fetches a count.
  const { data: listData } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => fetchNotifications(0),
    enabled: opened,
  });

  const unread = countData?.unread || 0;
  const items = listData?.data || [];

  return (
    <Popover width={360} position="bottom-end" opened={opened} onChange={setOpened} shadow="md">
      <Indicator disabled={unread === 0} label={unread > 9 ? '9+' : unread} size={16} color="red" offset={4}>
        <Popover.Target>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Notifications" onClick={() => setOpened((o) => !o)}>
            <Bell size={20} />
          </ActionIcon>
        </Popover.Target>
      </Indicator>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm">
          <Text fw={600} size="sm">Notifications</Text>
          <Button size="compact-xs" variant="subtle" onClick={markAllRead}>Mark all read</Button>
        </Group>
        <Divider />
        <ScrollArea.Autosize mah={360} viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Notifications list, scrollable' }}>
          <Stack gap={0}>
            {items.length === 0 && (
              <Text c="dimmed" size="sm" p="md" ta="center">No notifications yet</Text>
            )}
            {items.slice().reverse().map((n) => (
              <div
                key={n._id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '10px 14px',
                  cursor: n.read && !(n.refType === 'thread' && n.dsrNo) ? 'default' : 'pointer',
                  background: n.read ? 'transparent' : 'var(--mantine-color-red-light)',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid var(--mantine-color-red-6)',
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                }}
              >
                <Text size="sm" c={n.read ? 'dimmed' : undefined} fw={n.read ? 400 : 600}>{n.text}</Text>
                <Text size="xs" c="dimmed">{new Date(n.createdAt).toLocaleString()}</Text>
              </div>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
