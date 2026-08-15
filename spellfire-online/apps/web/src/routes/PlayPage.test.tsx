import type { PlayView } from '@spellfire/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sit = vi.fn();
const start = vi.fn();
const loadDeck = vi.fn();
const syncPlay = vi.fn();
const joinTable = vi.fn();

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({ isAuthed: true, user: { id: 'a', email: 'a@example.com' } }),
}));
vi.mock('../auth/authDialogStore.js', () => ({
  useAuthDialog: (selector: (s: { open: () => void }) => unknown) => selector({ open: () => {} }),
}));
vi.mock('../realtime/RealtimeProvider.js', () => ({
  useRealtime: () => ({
    sit,
    stand: vi.fn(),
    loadDeck,
    start,
    draw: vi.fn(),
    move: vi.fn(),
    passTurn: vi.fn(),
    syncPlay,
    joinTable,
    leaveTable: vi.fn(),
  }),
}));
vi.mock('../data/DatasetProvider.js', () => ({
  useDataset: () => ({ cardById: new Map() }),
}));
vi.mock('../hooks/useDecks.js', () => ({
  useDecksQuery: () => ({ data: [{ id: 'd1', name: 'Cloud Agent Deck', cards: [] }] }),
}));

import { usePlayStore } from '../store/playStore.js';
import PlayPage from './PlayPage.js';

const lobby: PlayView = {
  tableId: 't1',
  tableName: 'Arena',
  status: 'lobby',
  activeSeat: 0,
  turnNumber: 1,
  youSeat: 0,
  seats: [
    {
      occupant: { userId: 'a', email: 'a@example.com' },
      deckName: null,
      hand: { count: 0 },
      drawCount: 0,
      pool: [],
      realms: [],
      discard: [],
    },
    {
      occupant: null,
      deckName: null,
      hand: { count: 0 },
      drawCount: 0,
      pool: [],
      realms: [],
      discard: [],
    },
  ],
  spectators: [],
};

describe('PlayPage', () => {
  beforeEach(() => {
    sit.mockReset();
    start.mockReset();
    loadDeck.mockReset();
    usePlayStore.getState().reset();
    usePlayStore.getState().applyState(lobby);
  });

  it('shows the lobby controls to load a deck and start', () => {
    render(
      <MemoryRouter initialEntries={['/play/t1']}>
        <Routes>
          <Route path="/play/:tableId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Arena')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Choose deck')).toBeInTheDocument();
  });
});
