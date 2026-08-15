import { DEFAULT_CHAT_CHANNEL } from '@spellfire/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const say = vi.fn();
const joinChannel = vi.fn();
const createTable = vi.fn();

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({ isAuthed: true, user: { id: 'u1', email: 'demo@example.com' } }),
}));
vi.mock('../auth/authDialogStore.js', () => ({
  useAuthDialog: (selector: (s: { open: () => void }) => unknown) => selector({ open: () => {} }),
}));
vi.mock('../realtime/RealtimeProvider.js', () => ({
  useRealtime: () => ({
    say,
    joinChannel,
    leaveChannel: vi.fn(),
    tell: vi.fn(),
    createTable,
    joinTable: vi.fn(),
    leaveTable: vi.fn(),
  }),
}));

import { useChatStore } from '../store/chatStore.js';
import ChatPage from './ChatPage.js';

describe('ChatPage', () => {
  beforeEach(() => {
    say.mockReset();
    joinChannel.mockReset();
    createTable.mockReset();
    useChatStore.getState().reset();
    useChatStore.setState({
      connected: true,
      currentChannel: DEFAULT_CHAT_CHANNEL,
      joinedChannels: [DEFAULT_CHAT_CHANNEL],
      messagesByChannel: {
        [DEFAULT_CHAT_CHANNEL]: [
          {
            id: 'm1',
            channel: DEFAULT_CHAT_CHANNEL,
            from: { userId: 'u1', email: 'demo@example.com' },
            text: 'Hello lobby',
            ts: '2026-01-01T12:00:00.000Z',
            kind: 'say',
          },
        ],
      },
      occupantsByChannel: {
        [DEFAULT_CHAT_CHANNEL]: [{ userId: 'u1', email: 'demo@example.com' }],
      },
    });
  });

  it('renders history, presence, and sends a say', () => {
    render(<ChatPage />);
    expect(screen.getByText('Hello lobby')).toBeInTheDocument();
    expect(screen.getByText('demo@example.com')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Chat message'), { target: { value: 'Ping' } });
    fireEvent.submit(screen.getByLabelText('Chat message').closest('form') as HTMLFormElement);
    expect(say).toHaveBeenCalledWith('Ping');
  });
});
