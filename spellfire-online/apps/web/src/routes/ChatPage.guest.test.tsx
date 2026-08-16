import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({ isAuthed: false, user: null }),
}));
vi.mock('../auth/authDialogStore.js', () => ({
  useAuthDialog: (selector: (s: { open: () => void }) => unknown) => selector({ open: () => {} }),
}));
vi.mock('../realtime/RealtimeProvider.js', () => ({
  useRealtime: () => ({
    say: vi.fn(),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    tell: vi.fn(),
    createTable: vi.fn(),
    joinTable: vi.fn(),
    leaveTable: vi.fn(),
  }),
}));

import ChatPage from './ChatPage.js';

describe('ChatPage (signed out)', () => {
  it('prompts the user to sign in', () => {
    render(<ChatPage />);
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
