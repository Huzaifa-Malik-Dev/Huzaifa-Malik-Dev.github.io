import { notifications as mantineNotifications, notificationsStore } from '@mantine/notifications';

// Same import shape as '@mantine/notifications' (show/hide/update/clean/...), so every existing
// `notifications.show(...)` call site keeps working unchanged - only the import line changes.
const MAX_VISIBLE = 3;

// A toast is a small transient popup, not a place to read a paragraph — and error messages in
// particular are unbounded (e.g. a validation error listing one problem per row of an imported
// file). A long message here isn't just unreadable, it's swapped for a short generic one — the
// full detail belongs in the modal/page that has room for it, not cut off mid-sentence in a toast.
// Non-string messages (e.g. the clickable JSX span notification toasts use) pass through as-is.
const MAX_MESSAGE_LEN = 120;

function shortenMessage(message) {
  if (typeof message !== 'string' || message.length <= MAX_MESSAGE_LEN) return message;
  return 'Something went wrong.';
}

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
  return mantineNotifications.show({ ...opts, message: shortenMessage(opts.message) });
}

export const notifications = { ...mantineNotifications, show };
