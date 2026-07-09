import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/notifications';

const POLL_MS = Number(import.meta.env.VITE_NOTIFY_POLL_MS) || 20000;

// Cheap index-covered count, polled while the tab is focused (refetchIntervalInBackground
// defaults to false, so hidden tabs don't poll). The bell's full list is only fetched on click.
export function useUnreadCount(enabled) {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: api.fetchUnreadCount,
    enabled,
    refetchInterval: POLL_MS,
  });
}

// Per-row chat unread counts for whatever page of DSR/Pipeline records is currently visible -
// one batched request per poll, not one per row.
export function useThreadUnreadCounts(dsrNos) {
  return useQuery({
    queryKey: ['notifications', 'thread-unread', dsrNos],
    queryFn: () => api.fetchThreadUnreadCounts(dsrNos),
    enabled: dsrNos.length > 0,
    refetchInterval: POLL_MS,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  return {
    markRead: async (id) => {
      await api.markNotificationRead(id);
      invalidate();
    },
    markAllRead: async () => {
      await api.markAllNotificationsRead();
      invalidate();
    },
  };
}
