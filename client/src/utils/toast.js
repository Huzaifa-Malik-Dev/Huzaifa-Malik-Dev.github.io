import { notifications as mantineNotifications, notificationsStore } from '@mantine/notifications';

// Same import shape as '@mantine/notifications' (show/hide/update/clean/...), so every existing
// `notifications.show(...)` call site keeps working unchanged - only the import line changes.
const MAX_VISIBLE = 3;

// Matches <Notifications limit={3}/> in main.jsx, but changes what happens once that cap is
// hit: Mantine's own queueing DELAYS the newest toast until a visible one closes on its own.
// Here the newest toast always wins - the OLDEST currently-visible one is evicted immediately
// so a new toast is never stuck waiting behind old ones.
function show(opts) {
  const state = notificationsStore.getState();
  if (state.notifications.length >= MAX_VISIBLE) {
    const oldest = state.notifications[0];
    if (oldest) mantineNotifications.hide(oldest.id);
  }
  return mantineNotifications.show(opts);
}

export const notifications = { ...mantineNotifications, show };
