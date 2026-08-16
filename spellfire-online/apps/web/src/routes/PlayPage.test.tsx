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
    defend: vi.fn(),
    declineDefend: vi.fn(),
    ally: vi.fn(),
    cast: vi.fn(),
    resolveCombat: vi.fn(),
    syncPlay,
    joinTable,
    leaveTable: vi.fn(),
  }),
}));
vi.mock('../data/DatasetProvider.js', () => ({
  useDataset: () => ({
    cardById: new Map([
      ['1st/1', { id: '1st/1', title: 'Waterdeep', typeId: 13, bonus: null }],
      [
        '1st/42',
        {
          id: '1st/42',
          title: 'King Azoun IV',
          typeId: 7,
          bonus: 7,
          usesCodes: ['1', '2', 'd9', 'o9', 'd18', 'o18'],
        },
      ],
      [
        '1st/43',
        {
          id: '1st/43',
          title: 'Maligor the Red',
          typeId: 20,
          bonus: 3,
          usesCodes: ['1', '2', 'd9', 'o9', 'd19', 'o19'],
        },
      ],
      ['1st/54', { id: '1st/54', title: 'War Party', typeId: 1, bonus: 4 }],
      ['1st/96', { id: '1st/96', title: 'Horrors of the Abyss', typeId: 19, bonus: 5 }],
    ]),
  }),
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
  battlefield: null,
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

  it('shows defend and decline when an attack is waiting', () => {
    usePlayStore.getState().applyState({
      ...playing,
      youSeat: 1,
      activeSeat: 0,
      battlefield: {
        attackerInstanceId: 'p1',
        attackerCardId: '1st/43',
        targetInstanceId: 'r1',
        targetCardId: '1st/1',
        defenderInstanceId: null,
        defenderCardId: null,
        attackerAllies: [],
        defenderAllies: [],
        attackerSpells: [],
        defenderSpells: [],
        attackerTotal: 3,
        defenderTotal: 0,
      },
      seats: [
        playing.seats[0],
        {
          ...playing.seats[1],
          occupant: { userId: 'a', email: 'a@example.com' },
          pool: [{ instanceId: 'd1', cardId: '1st/42' }],
          realms: [{ instanceId: 'r1', cardId: '1st/1' }],
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/play/t1']}>
        <Routes>
          <Route path="/play/:tableId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /defend with champion/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline defense/i })).toBeInTheDocument();
    expect(screen.getByTestId('combat-totals')).toHaveTextContent('Totals 3 vs 0');
  });

  it('shows add-ally and resolve once a champion is defending', () => {
    usePlayStore.getState().applyState({
      ...playing,
      youSeat: 0,
      activeSeat: 0,
      battlefield: {
        attackerInstanceId: 'p1',
        attackerCardId: '1st/43',
        targetInstanceId: 'r1',
        targetCardId: '1st/1',
        defenderInstanceId: 'd1',
        defenderCardId: '1st/42',
        attackerAllies: [],
        defenderAllies: [],
        attackerSpells: [],
        defenderSpells: [],
        attackerTotal: 3,
        defenderTotal: 7,
      },
      seats: [
        {
          ...playing.seats[0],
          hand: [{ instanceId: 'ally1', cardId: '1st/54' }],
          pool: [{ instanceId: 'p1', cardId: '1st/43' }],
        },
        {
          ...playing.seats[1],
          occupant: { userId: 'b', email: 'b@example.com' },
          pool: [{ instanceId: 'd1', cardId: '1st/42' }],
          realms: [{ instanceId: 'r1', cardId: '1st/1' }],
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/play/t1']}>
        <Routes>
          <Route path="/play/:tableId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('combat-totals')).toHaveTextContent('Totals 3 vs 7');
    expect(screen.getByRole('button', { name: /add ally/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolve combat/i })).toBeInTheDocument();
  });

  it('shows cast-spell when the champion can use a spell in hand', () => {
    usePlayStore.getState().applyState({
      ...playing,
      youSeat: 0,
      activeSeat: 0,
      battlefield: {
        attackerInstanceId: 'p1',
        attackerCardId: '1st/43',
        targetInstanceId: 'r1',
        targetCardId: '1st/1',
        defenderInstanceId: 'd1',
        defenderCardId: '1st/42',
        attackerAllies: [],
        defenderAllies: [],
        attackerSpells: [],
        defenderSpells: [],
        attackerTotal: 3,
        defenderTotal: 7,
      },
      seats: [
        {
          ...playing.seats[0],
          hand: [{ instanceId: 'spl1', cardId: '1st/96' }],
          pool: [{ instanceId: 'p1', cardId: '1st/43' }],
        },
        {
          ...playing.seats[1],
          occupant: { userId: 'b', email: 'b@example.com' },
          pool: [{ instanceId: 'd1', cardId: '1st/42' }],
          realms: [{ instanceId: 'r1', cardId: '1st/1' }],
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/play/t1']}>
        <Routes>
          <Route path="/play/:tableId" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /cast spell/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolve combat/i })).toBeInTheDocument();
  });
});
