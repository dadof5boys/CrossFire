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
    setPhase: vi.fn(),
    attack: vi.fn(),
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
  phase: 0,
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
      razedInstanceIds: [],
    },
    {
      occupant: null,
      deckName: null,
      hand: { count: 0 },
      drawCount: 0,
      pool: [],
      realms: [],
      discard: [],
      razedInstanceIds: [],
    },
  ],
  spectators: [],
  lastCombat: null,
};

describe('PlayPage', () => {
  beforeEach(() => {
    sit.mockReset();
    start.mockReset();
    loadDeck.mockReset();
    usePlayStore.getState().reset();
    usePlayStore.getState().applyState(lobby);
  });

  const playing: PlayView = {
    ...lobby,
    status: 'playing',
    phase: 0,
    seats: [
      {
        ...lobby.seats[0],
        deckName: 'A Deck',
        hand: [],
        drawCount: 3,
        pool: [{ instanceId: 'p1', cardId: '1st/43' }],
      },
      {
        ...lobby.seats[1],
        occupant: { userId: 'b', email: 'b@example.com' },
        deckName: 'B Deck',
        realms: [{ instanceId: 'r1', cardId: '1st/1' }],
      },
    ],
  };

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

  it('shows phase radios and an attack button when a champion can hit a realm', () => {
    usePlayStore.getState().applyState(playing);
    render(
      <MemoryRouter initialEntries={['/play/t1']}>
        <Routes>
          <Route path="/play/:tableId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('group', { name: /turn phase/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /combat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attack realm/i })).toBeInTheDocument();
  });
});
