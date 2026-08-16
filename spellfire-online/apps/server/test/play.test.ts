import { describe, expect, it } from 'vitest';
import { RealtimeHub } from '../src/realtime/hub.js';
import { PlayTable } from '../src/realtime/play.js';

const alice = { userId: 'a', email: 'alice@example.com' };
const bob = { userId: 'b', email: 'bob@example.com' };
const realms = [{ cardId: '1st/1', qty: 8 }];
const mixed = [
  { cardId: '1st/1', qty: 4 },
  { cardId: '1st/43', qty: 4 },
];

function startedDuel(): PlayTable {
  const game = new PlayTable('t1', 'Arena');
  game.sit('s1', alice);
  game.sit('s2', bob);
  game.loadDeck('a', 'Alice Deck', mixed);
  game.loadDeck('b', 'Bob Deck', realms);
  expect(game.start()).toBeNull();
  return game;
}

function handOf(game: PlayTable, userId: string) {
  const view = game.viewFor(userId, []);
  const seat = view.youSeat;
  if (seat === null) throw new Error('expected seat');
  const hand = view.seats[seat].hand;
  if (!Array.isArray(hand)) throw new Error('expected visible hand');
  return hand;
}

describe('PlayTable', () => {
  it('caps seats at two and redacts the opponent hand', () => {
    const game = new PlayTable('t1', 'Arena');
    expect(game.sit('s1', alice)).toBe(0);
    expect(game.sit('s2', bob)).toBe(1);
    expect(game.sit('s3', { userId: 'c', email: 'c@example.com' })).toBe('Seats full');
    expect(game.loadDeck('a', 'Alice Deck', realms)).toBeNull();
    expect(game.loadDeck('b', 'Bob Deck', realms)).toBeNull();
    expect(game.start()).toBeNull();
    const aliceView = game.viewFor('a', []);
    const bobView = game.viewFor('b', []);
    expect(aliceView.phase).toBe(0);
    expect(Array.isArray(aliceView.seats[0].hand)).toBe(true);
    expect(aliceView.seats[0].hand).toHaveLength(5);
    expect(aliceView.seats[1].hand).toEqual({ count: 5 });
    expect(Array.isArray(bobView.seats[1].hand)).toBe(true);
    expect(bobView.seats[0].hand).toEqual({ count: 5 });
  });

  it('moves a realm from hand to realms and keeps it public', () => {
    const game = new PlayTable('t1', 'Arena');
    game.sit('s1', alice);
    game.loadDeck('a', 'Alice Deck', realms);
    game.start();
    const hand = handOf(game, 'a');
    const played = hand[0];
    if (!played) throw new Error('expected hand');
    expect(game.move('a', played.instanceId, 'realms')).toBeNull();
    const view = game.viewFor('b', []);
    expect(view.seats[0].realms).toHaveLength(1);
    expect(view.seats[0].realms[0]?.cardId).toBe(played.cardId);
    expect(view.seats[0].hand).toEqual({ count: 4 });
  });

  it('rejects a champion into realms and a realm into the pool', () => {
    const game = startedDuel();
    const champ = handOf(game, 'a').find((c) => c.cardId === '1st/43');
    const realm = handOf(game, 'a').find((c) => c.cardId === '1st/1');
    if (!champ || !realm) throw new Error('expected mixed opening hand');
    expect(game.move('a', champ.instanceId, 'realms')).toBe(
      'Only realms can enter the realms zone',
    );
    expect(game.move('a', realm.instanceId, 'pool')).toBe('Only champions can enter the pool');
    expect(game.move('a', champ.instanceId, 'pool')).toBeNull();
    expect(game.move('a', realm.instanceId, 'realms')).toBeNull();
  });

  it('blocks the opponent from drawing or moving off-turn', () => {
    const game = startedDuel();
    expect(game.draw('b')).toBe('Not your turn');
    const bobHand = handOf(game, 'b')[0];
    if (!bobHand) throw new Error('expected bob hand');
    expect(game.move('b', bobHand.instanceId, 'realms')).toBe('Not your turn');
    expect(game.attack('b', 'x', 'y')).toBe('Not your turn');
  });

  it('razes Waterdeep when Maligor attacks (3 vs 0)', () => {
    const game = startedDuel();
    const champ = handOf(game, 'a').find((c) => c.cardId === '1st/43');
    if (!champ) throw new Error('expected champion in hand');
    expect(game.move('a', champ.instanceId, 'pool')).toBeNull();
    expect(game.passTurn('a')).toBeNull();

    const realm = handOf(game, 'b')[0];
    if (!realm) throw new Error('expected realm');
    expect(game.move('b', realm.instanceId, 'realms')).toBeNull();
    expect(game.passTurn('b')).toBeNull();

    expect(game.attack('a', champ.instanceId, realm.instanceId)).toBeNull();
    expect(game.viewFor('a', []).battlefield?.targetInstanceId).toBe(realm.instanceId);
    expect(game.viewFor('a', []).lastCombat).toBeNull();
    expect(game.draw('a')).toBe('Resolve the current attack first');
    expect(game.declineDefend('a')).toBe('Not the defending player');
    expect(game.declineDefend('b')).toBeNull();
    const view = game.viewFor('a', []);
    expect(view.phase).toBe(4);
    expect(view.battlefield).toBeNull();
    expect(view.lastCombat).toMatchObject({
      attackerBonus: 3,
      defenderBonus: 0,
      razed: true,
      attackerDiscarded: false,
      defenderInstanceId: null,
    });
    expect(view.seats[1].razedInstanceIds).toEqual([realm.instanceId]);
    expect(view.seats[1].realms).toHaveLength(1);
    expect(view.seats[0].pool).toHaveLength(1);
  });

  it('does not raze when the attacker bonus is not greater', () => {
    const champ = { instanceId: 'atk', cardId: '1st/43' };
    const fortress = { instanceId: 'def', cardId: '1st/1' };
    const lookup = (id: string) => {
      if (id === '1st/43') return { typeId: 20, bonus: 3 };
      if (id === '1st/1') return { typeId: 13, bonus: 5 };
      return undefined;
    };
    const isolated = new PlayTable('t2', 'Arena', lookup);
    isolated.sit('s1', alice);
    isolated.sit('s2', bob);
    isolated.loadDeck('a', 'A', mixed);
    isolated.loadDeck('b', 'B', realms);
    isolated.start();
    isolated.seats[0].pool = [champ];
    isolated.seats[1].realms = [fortress];
    expect(isolated.attack('a', 'atk', 'def')).toBeNull();
    expect(isolated.battlefield?.targetInstanceId).toBe('def');
    expect(isolated.declineDefend('b')).toBeNull();
    expect(isolated.lastCombat?.razed).toBe(false);
    expect(isolated.razed.has('def')).toBe(false);
  });

  it('razes when a stronger champion beats the defending champion', () => {
    const game = startedDuel();
    const attacker = { instanceId: 'atk', cardId: '1st/42' };
    const defender = { instanceId: 'defc', cardId: '1st/43' };
    const realm = { instanceId: 'def', cardId: '1st/1' };
    game.seats[0].pool = [attacker];
    game.seats[1].pool = [defender];
    game.seats[1].realms = [realm];
    expect(game.attack('a', 'atk', 'def')).toBeNull();
    expect(game.defend('b', 'defc')).toBeNull();
    expect(game.lastCombat).toMatchObject({
      attackerBonus: 7,
      defenderBonus: 3,
      razed: true,
      attackerDiscarded: false,
      defenderInstanceId: 'defc',
    });
    expect(game.razed.has('def')).toBe(true);
    expect(game.seats[0].pool).toHaveLength(1);
    expect(game.seats[1].pool).toHaveLength(1);
    expect(game.battlefield).toBeNull();
  });

  it('discards the attacker when the defending champion is not weaker', () => {
    const game = startedDuel();
    const attacker = { instanceId: 'atk', cardId: '1st/43' };
    const defender = { instanceId: 'defc', cardId: '1st/42' };
    const realm = { instanceId: 'def', cardId: '1st/1' };
    game.seats[0].pool = [attacker];
    game.seats[1].pool = [defender];
    game.seats[1].realms = [realm];
    expect(game.attack('a', 'atk', 'def')).toBeNull();
    expect(game.defend('b', 'defc')).toBeNull();
    expect(game.lastCombat).toMatchObject({
      attackerBonus: 3,
      defenderBonus: 7,
      razed: false,
      attackerDiscarded: true,
    });
    expect(game.razed.has('def')).toBe(false);
    expect(game.seats[0].pool).toHaveLength(0);
    expect(game.seats[0].discard.map((c) => c.instanceId)).toEqual(['atk']);
    expect(game.seats[1].pool).toHaveLength(1);
  });

  it('rejects an attack in the end phase', () => {
    const game = startedDuel();
    const champ = { instanceId: 'atk', cardId: '1st/43' };
    const realm = { instanceId: 'def', cardId: '1st/1' };
    game.seats[0].pool = [champ];
    game.seats[1].realms = [realm];
    expect(game.setPhase('a', 5)).toBeNull();
    expect(game.attack('a', 'atk', 'def')).toBe('Cannot attack in the end phase');
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
