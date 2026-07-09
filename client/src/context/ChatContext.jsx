import { createContext, useCallback, useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ChatDrawer from '../components/ChatDrawer';
import { markThreadRead } from '../api/notifications';

const ChatContext = createContext(null);

// One ChatDrawer instance for the whole app, opened from anywhere (DSR/Pipeline rows, the
// notification bell, ...) via useChat().openChat(dsrNo) — so a notification click can open the
// right thread without every page needing its own drawer + read-tracking wiring.
export function ChatProvider({ children }) {
  const [dsrNo, setDsrNo] = useState(null);
  const queryClient = useQueryClient();

  const openChat = useCallback(
    (nextDsrNo) => {
      setDsrNo(nextDsrNo);
      markThreadRead(nextDsrNo).then(() => queryClient.invalidateQueries({ queryKey: ['notifications', 'thread-unread'] }));
    },
    [queryClient]
  );

  return (
    <ChatContext.Provider value={openChat}>
      {children}
      <ChatDrawer dsrNo={dsrNo} opened={!!dsrNo} onClose={() => setDsrNo(null)} />
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
