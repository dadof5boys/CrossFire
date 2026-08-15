import { describe, expect, it } from 'vitest';
import { RealtimeHub } from '../src/realtime/hub.js';
import { PlayTable } from '../src/realtime/play.js';

const alice = { userId: 'a', email: 'alice@example.com' };
const bob = { userId: 'b', email: 'bob@example.com' };
const cards = [
  { cardId: '1st/1', qty: 4 },
  { cardId: '1st/2', qty: 4 },
];

describe('PlayTable', () => {
  it('caps seats at two and redacts the opponent hand', () => {
    const game = new PlayTable('t1', 'Arena');
    expect(game.sit('s1', alice)).toBe(0);
    expect(game.sit('s2', bob)).toBe(1);
    expect(game.sit('s3', { userId: 'c', email: 'c@example.com' })).toBe('Seats full');
    expect(game.loadDeck('a', 'Alice Deck', cards)).toBeNull();
    expect(game.loadDeck('b', 'Bob Deck', cards)).toBeNull();
    expect(game.start()).toBeNull();
    const aliceView = game.viewFor('a', []);
    const bobView = game.viewFor('b', []);
    expect(Array.isArray(aliceView.seats[0].hand)).toBe(true);
    expect(aliceView.seats[0].hand).toHaveLength(5);
    expect(aliceView.seats[1].hand).toEqual({ count: 5 });
    expect(Array.isArray(bobView.seats[1].hand)).toBe(true);
    expect(bobView.seats[0].hand).toEqual({ count: 5 });
  });

  it('moves a card from hand to pool and keeps it public', () => {
    const game = new PlayTable('t1', 'Arena');
    game.sit('s1', alice);
    game.loadDeck('a', 'Alice Deck', cards);
    game.start();
    const hand = game.viewFor('a', []).seats[0].hand;
    if (!Array.isArray(hand) || !hand[0]) throw new Error('expected hand');
    const played = hand[0];
    expect(game.move('a', played.instanceId, 'pool')).toBeNull();
    const view = game.viewFor('b', []);
    expect(view.seats[0].pool).toHaveLength(1);
    expect(view.seats[0].pool[0]?.cardId).toBe(played.cardId);
    expect(view.seats[0].hand).toEqual({ count: 4 });
  });
});

describe('RealtimeHub play wiring', () => {
  it('auto-sits the table creator', () => {
    const hub = new RealtimeHub();
    const table = hub.createTable('s1', alice, 'Table 1');
    expect(table.playerCount).toBe(1);
    expect(hub.playView(table.id, 'a')?.youSeat).toBe(0);
  });
});
