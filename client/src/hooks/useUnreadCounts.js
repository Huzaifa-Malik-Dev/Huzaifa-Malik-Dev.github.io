import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCounts } from '../api/views';

// Same cadence as the notification bell (useNotifications.js) - the app's one definition of "live".
const POLL_MS = Number(import.meta.env.VITE_NOTIFY_POLL_MS) || 20000;

// How many records in each module this user has never opened - the sidebar badge numbers. Counts
// the very same rows the list pages highlight as new (see server/controllers/viewController.js),
// so the badge and the highlighting always agree. Returns { dsr, pipeline, orders }.
//
// One request covers every badged nav item. api/views.js's markViewed invalidates this key when a
// record is opened, so the count drops the moment its highlight clears rather than at the next poll.
export function useUnreadCounts(enabled) {
  return useQuery({
    queryKey: ['views', 'unread-counts'],
    queryFn: fetchUnreadCounts,
    enabled,
    refetchInterval: POLL_MS,
  });
}
