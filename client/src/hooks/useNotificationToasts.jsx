import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '../utils/toast';
import * as api from '../api/notifications';
import { useChat } from '../context/ChatContext';

const POLL_MS = Number(import.meta.env.VITE_NOTIFY_POLL_MS) || 20000;

// Polls for notifications newer than the last one seen and surfaces each as a toast, same as a
// chat app's push notification would - clicking one opens the relevant chat directly. The first
// poll after mount only sets the cursor (no toast storm for a backlog of already-existing
// unread notifications on login/reload).
export function useNotificationToasts() {
  const openChat = useChat();
  const queryClient = useQueryClient();
  const lastSeqRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const afterSeq = lastSeqRef.current ?? 0;
        const isFirstLoad = lastSeqRef.current === null;
        const res = await api.fetchNotifications(afterSeq);
        if (cancelled) return;
        const items = res.data || [];

        if (items.length) {
          lastSeqRef.current = Math.max(...items.map((n) => n.seq));
          if (!isFirstLoad) {
            items.forEach((n) => {
              const toastId = `notif-${n._id}`;
              const clickable = n.refType === 'thread' && !!n.dsrNo;
              notifications.show({
                id: toastId,
                color: 'gray',
                autoClose: 8000,
                message: (
                  <span
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                    onClick={async () => {
                      await api.markNotificationRead(n._id);
                      queryClient.invalidateQueries({ queryKey: ['notifications'] });
                      if (clickable) openChat(n.dsrNo);
                      notifications.hide(toastId);
                    }}
                  >
                    {n.text}
                  </span>
                ),
              });
            });
            queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] });
          }
        } else if (isFirstLoad) {
          lastSeqRef.current = 0;
        }
      } catch {
        // Transient poll failure - just try again next interval.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [openChat, queryClient]);
}
