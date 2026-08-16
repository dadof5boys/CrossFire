import type { PlayView } from '@spellfire/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayStore } from './playStore.js';

const view: PlayView = {
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
      deckName: 'A Deck',
      hand: { count: 0 },
      drawCount: 8,
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

describe('playStore', () => {
  beforeEach(() => usePlayStore.getState().reset());

  it('stores a personalized play view', () => {
    usePlayStore.getState().applyState(view);
    expect(usePlayStore.getState().view?.tableName).toBe('Arena');
    expect(usePlayStore.getState().view?.youSeat).toBe(0);
  });
});
