import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Drawer, Stack, Text, Group, Badge, Textarea, ActionIcon, ScrollArea, Paper, Chip, Loader, Center,
  Avatar, Divider, Box, Tooltip, FileButton,
} from '@mantine/core';
import { Send, MessageCircle, AtSign, Paperclip, FileText, Download } from 'lucide-react';
import { notifications } from '../utils/toast';
import { fetchThread, postThreadMessage, postThreadAttachment } from '../api/threads';
import { useAuth } from '../context/AuthContext';
import { colorFor, initials } from '../utils/avatar';

function timeOnly(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightMentions(text, people) {
  let result = escapeHtml(text);
  people.forEach((p) => {
    const re = new RegExp(`@${escapeHtml(p.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'gi');
    result = result.replace(re, (m) => `<span style="color:var(--mantine-color-red-4);font-weight:700">${m}</span>`);
  });
  return result;
}

function SystemEvent({ item }) {
  return (
    <Group justify="center" my={2}>
      <Group
        gap={6}
        px={10}
        py={3}
        style={{ background: 'var(--mantine-color-default-hover)', borderRadius: 999 }}
      >
        <Box w={5} h={5} style={{ borderRadius: '50%', background: 'var(--mantine-color-blue-5)', flexShrink: 0 }} />
        <Text size="xs" c="dimmed">
          <Text span fw={600} c="dimmed" inherit>{item.stage}</Text> · {item.text}
        </Text>
      </Group>
    </Group>
  );
}

function MessageGroup({ senderName, mine, msgs, people }) {
  return (
    <Group align="flex-end" gap={8} wrap="nowrap" justify={mine ? 'flex-end' : 'flex-start'}>
      {!mine && <Avatar size={30} radius="xl" color={colorFor(senderName)}>{initials(senderName)}</Avatar>}
      <Stack gap={3} maw="78%" align={mine ? 'flex-end' : 'flex-start'}>
        {!mine && <Text size="xs" fw={600} c={colorFor(senderName)} ml={4}>{senderName}</Text>}
        {msgs.map((item, i) => (
          <Paper
            key={i}
            px="sm"
            py={7}
            style={{
              background: mine ? 'var(--mantine-color-red-7)' : 'var(--mantine-color-default-hover)',
              color: mine ? 'white' : undefined,
              borderRadius: 14,
              borderBottomRightRadius: mine ? 4 : 14,
              borderBottomLeftRadius: mine ? 14 : 4,
            }}
          >
            {item.type === 'file' ? (
              <Group
                gap={8}
                component="a"
                href={`${import.meta.env.VITE_API_URL}${item.filePath}`}
                target="_blank"
                rel="noreferrer"
                wrap="nowrap"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <FileText size={20} style={{ flexShrink: 0 }} />
                <Text size="sm" fw={600} style={{ wordBreak: 'break-word' }}>{item.fileName}</Text>
                <Download size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
              </Group>
            ) : (
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: highlightMentions(item.text, people) }} />
            )}
          </Paper>
        ))}
        <Text size="10px" c="dimmed" mx={4}>{timeOnly(msgs[msgs.length - 1].ts)}</Text>
      </Stack>
      {mine && <Avatar size={30} radius="xl" color={colorFor(senderName)}>{initials(senderName)}</Avatar>}
    </Group>
  );
}

// Groups consecutive items: system events stand alone; consecutive human messages from the
// same sender (within a few minutes) collapse into one visual group with a single avatar/name,
// matching how every mainstream chat app (Slack, iMessage, WhatsApp) reduces repetition.
function buildGroups(items, myId) {
  const groups = [];
  items.forEach((item) => {
    if (item.type === 'sys') {
      groups.push({ kind: 'sys', item });
      return;
    }
    const last = groups[groups.length - 1];
    const sameSender = last?.kind === 'msg' && last.senderId === (item.userId || item.userName);
    const closeInTime = sameSender && new Date(item.ts) - new Date(last.msgs[last.msgs.length - 1].ts) < 3 * 60 * 1000;
    if (sameSender && closeInTime) {
      last.msgs.push(item);
    } else {
      groups.push({ kind: 'msg', senderId: item.userId || item.userName, senderName: item.userName, mine: item.userId === myId, msgs: [item] });
    }
  });
  return groups;
}

export default function ChatDrawer({ dsrNo, opened, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [taggedIds, setTaggedIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['thread', dsrNo],
    queryFn: () => fetchThread(dsrNo),
    enabled: opened && !!dsrNo,
  });
  const thread = data?.data;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread?.items?.length]);

  const toggleTag = (person) => {
    setTaggedIds((prev) => (prev.includes(person._id) ? prev.filter((id) => id !== person._id) : [...prev, person._id]));
    setText((prev) => (prev.includes(`@${person.name}`) ? prev : `${prev.trim() ? prev.trim() + ' ' : ''}@${person.name} `));
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await postThreadMessage(dsrNo, { text: trimmed, mentionIds: taggedIds });
      setText('');
      setTaggedIds([]);
      queryClient.invalidateQueries({ queryKey: ['thread', dsrNo] });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not send', message: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await postThreadAttachment(dsrNo, file, taggedIds);
      setTaggedIds([]);
      queryClient.invalidateQueries({ queryKey: ['thread', dsrNo] });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not send file', message: err.response?.data?.error || 'Something went wrong' });
    } finally {
      setUploading(false);
    }
  };

  const groups = buildGroups(thread?.items || [], user?.id);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={null}
      padding={0}
      withCloseButton={false}
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0 },
      }}
    >
      <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
        <Group
          justify="space-between"
          align="flex-start"
          p="md"
          style={{ borderBottom: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)' }}
        >
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Avatar size={38} radius="md" color="red" variant="light"><MessageCircle size={18} /></Avatar>
            <div>
              <Group gap={8}>
                <Text fw={700} size="sm">{dsrNo}</Text>
                {thread?.context?.status && <Badge size="xs" variant="light">{thread.context.status}</Badge>}
              </Group>
              {thread?.context?.company && <Text size="sm" c="dimmed">{thread.context.company}</Text>}
            </div>
          </Group>
          <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close chat">✕</ActionIcon>
        </Group>
        <Text size="10px" c="dimmed" px="md" pb="xs" pt={2}>Shared thread · agent, Team Leader, Teams Head, Sales Head &amp; Back Office</Text>
        <Divider />

        <ScrollArea flex={1} px="md" py="sm" viewportRef={scrollRef} viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Chat messages, scrollable' }} style={{ background: 'var(--mantine-color-body)', minHeight: 0 }}>
          {isLoading ? (
            <Center py="xl"><Loader size="sm" /></Center>
          ) : groups.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap={4}>
                <MessageCircle size={28} color="var(--mantine-color-dimmed)" />
                <Text c="dimmed" size="sm" ta="center">No activity yet.<br />Start the conversation below.</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap={10}>
              {groups.map((g, i) => {
                const prevTs = i > 0 ? (groups[i - 1].item?.ts || groups[i - 1].msgs?.[0]?.ts) : null;
                const curTs = g.item?.ts || g.msgs?.[0]?.ts;
                const showDay = !prevTs || dayLabel(prevTs) !== dayLabel(curTs);
                return (
                  <Box key={i}>
                    {showDay && (
                      <Group justify="center" my={6}>
                        <Text size="10px" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>{dayLabel(curTs)}</Text>
                      </Group>
                    )}
                    {g.kind === 'sys' ? (
                      <SystemEvent item={g.item} />
                    ) : (
                      <MessageGroup senderName={g.senderName} mine={g.mine} msgs={g.msgs} people={thread.people || []} />
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </ScrollArea>

        <Stack gap={0} style={{ borderTop: '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-body)' }}>
          {(thread?.people || []).length > 0 && (
            <Group gap={6} px="md" pt={10} pb={2} wrap="wrap" align="center">
              <Group gap={4} c="dimmed">
                <AtSign size={12} />
                <Text size="xs" fw={600}>Tag someone:</Text>
              </Group>
              {thread.people.filter((p) => p._id !== user?.id).map((p) => (
                <Chip
                  key={p._id}
                  size="xs"
                  variant="light"
                  checked={taggedIds.includes(p._id)}
                  onChange={() => toggleTag(p)}
                >
                  {p.name}
                </Chip>
              ))}
            </Group>
          )}

          <Group gap={8} p="md" align="flex-end" wrap="nowrap">
            <FileButton onChange={handleAttach} accept="image/png,image/jpeg,image/webp,application/pdf">
              {(props) => (
                <Tooltip label="Attach a file (image or PDF)" position="top" openDelay={400}>
                  <ActionIcon {...props} size={42} radius="xl" variant="light" color="gray" loading={uploading} aria-label="Attach file">
                    <Paperclip size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </FileButton>
            <Paper
              withBorder
              radius="xl"
              px="md"
              py={4}
              style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}
            >
              <Textarea
                variant="unstyled"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                autosize
                minRows={1}
                maxRows={5}
                style={{ flex: 1 }}
              />
            </Paper>
            <Tooltip label="Send (Enter) — Shift+Enter for a new line" position="top" openDelay={400}>
              <ActionIcon
                size={42}
                radius="xl"
                color="red"
                variant={text.trim() ? 'filled' : 'light'}
                onClick={handleSend}
                loading={sending}
                disabled={!text.trim()}
                aria-label="Send message"
              >
                <Send size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>
      </Stack>
    </Drawer>
  );
}
