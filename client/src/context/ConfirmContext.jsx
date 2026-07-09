import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, Stack, Text, Group, Button } from '@mantine/core';

const ConfirmContext = createContext(null);

// App-wide themed confirm dialog - replaces the browser's native confirm()/alert() so every
// "are you sure?" moment looks and feels like the rest of the app instead of an OS popup.
// Usage: const confirm = useConfirm(); const ok = await confirm({ title, message, confirmLabel, color });
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    ({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', color = 'red' } = {}) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({ title, message, confirmLabel, cancelLabel, color });
      }),
    []
  );

  const settle = (result) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* Explicit high zIndex — this can be triggered from inside another already-open Modal
          (e.g. Pipeline Deal Details), and same-z-index Modals stack by DOM/mount order, not
          by which one the user opened last. This must always win. */}
      <Modal opened={!!state} onClose={() => settle(false)} title={state?.title} size="sm" centered zIndex={10000}>
        <Stack gap="md">
          {state?.message && <Text size="sm">{state.message}</Text>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => settle(false)}>{state?.cancelLabel}</Button>
            <Button color={state?.color} onClick={() => settle(true)}>{state?.confirmLabel}</Button>
          </Group>
        </Stack>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
