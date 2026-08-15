import type { AddressInfo } from 'node:net';
import { type Socket as ClientSocket, io as ioc } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

function tokenFor(userId: string, email: string): string {
  return `test-token:${userId}:${email}`;
}

const app = buildApp({
  verifyToken: async (token) => {
    if (!token.startsWith('test-token:')) return null;
    const parts = token.split(':');
    return { userId: parts[1] ?? '', email: parts[2] ?? `${parts[1]}@test.local` };
  },
  loadDeck: async (_userId, deckId) => {
    if (deckId === 'deck-a') return { name: 'A Deck', cards: [{ cardId: '1st/43', qty: 8 }] };
    if (deckId === 'deck-b') return { name: 'B Deck', cards: [{ cardId: '1st/1', qty: 8 }] };
    return null;
  },
});

function connect(userId: string, email: string): Promise<ClientSocket> {
  const addr = app.server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const socket = ioc(`http://127.0.0.1:${addr.port}`, {
      auth: { token: tokenFor(userId, email) },
      transports: ['websocket'],
      forceNew: true,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function once<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: T) => resolve(payload));
  });
}

function emitAck<T = unknown>(
  socket: ClientSocket,
  event: string,
  payload: unknown,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timed out`)), 4000);
    socket.emit(event, payload, (err: string | null, extra?: T) => {
      clearTimeout(timer);
      if (err) reject(new Error(`${event}: ${err}`));
      else resolve(extra);
    });
  });
}

type PlayState = {
  status: string;
  phase: number;
  lastCombat: { razed: boolean; attackerBonus: number; defenderBonus: number } | null;
  seats: [
    {
      hand: unknown;
      pool: { instanceId: string; cardId: string }[];
      realms: { instanceId: string; cardId: string }[];
      razedInstanceIds: string[];
    },
    {
      hand: unknown;
      pool: { instanceId: string; cardId: string }[];
      realms: { instanceId: string; cardId: string }[];
      razedInstanceIds: string[];
    },
  ];
};

function waitForState(
  socket: ClientSocket,
  pred: (view: PlayState) => boolean,
): Promise<PlayState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('play:state timed out')), 4000);
    const onState = (view: PlayState) => {
      if (!pred(view)) return;
      clearTimeout(timer);
      socket.off('play:state', onState);
      resolve(view);
    };
    socket.on('play:state', onState);
  });
}

describe('realtime socket', () => {
  beforeAll(async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a connection without a valid token', async () => {
    const addr = app.server.address() as AddressInfo;
    await expect(
      new Promise((_, reject) => {
        const socket = ioc(`http://127.0.0.1:${addr.port}`, {
          auth: { token: 'nope' },
          transports: ['websocket'],
          forceNew: true,
        });
        socket.on('connect_error', (err) => {
          socket.close();
          reject(err);
        });
      }),
    ).rejects.toThrow(/Unauthorized/);
  });

  it('joins Main, broadcasts say, and updates presence', async () => {
    const a = await connect('user-a', 'a@example.com');
    const aPresence = once<{ users: { email: string }[] }>(a, 'chat:presence');
    const b = await connect('user-b', 'b@example.com');
    const presence = await aPresence;
    expect(presence.users.some((u) => u.email === 'a@example.com')).toBe(true);
    expect(presence.users.some((u) => u.email === 'b@example.com')).toBe(true);

    const received = once<{ text: string; from: { email: string } }>(b, 'chat:message');
    a.emit('chat:say', { channel: 'Main', text: 'Hello from A' });
    const msg = await received;
    expect(msg.text).toBe('Hello from A');
    expect(msg.from.email).toBe('a@example.com');

    a.close();
    b.close();
  });

  it('delivers a whisper to the target user', async () => {
    const a = await connect('user-e', 'e@example.com');
    const b = await connect('user-f', 'f@example.com');
    const received = once<{ text: string; to: { email: string } }>(b, 'chat:whisper');
    a.emit('chat:tell', { toUserId: 'user-f', text: 'psst' });
    const whisper = await received;
    expect(whisper.text).toBe('psst');
    expect(whisper.to.email).toBe('f@example.com');
    a.close();
    b.close();
  });

  it('creates a table and lists it to peers', async () => {
    const a = await connect('user-c', 'c@example.com');
    const b = await connect('user-d', 'd@example.com');
    const listed = once<{ tables: { name: string }[] }>(b, 'table:list');
    a.emit('table:create', { name: 'Arena 1' });
    const payload = await listed;
    expect(payload.tables.some((t) => t.name === 'Arena 1')).toBe(true);
    a.close();
    b.close();
  });

  it('starts a tabletop and hides the opponent hand', async () => {
    const a = await connect('user-p1', 'p1@example.com');
    const b = await connect('user-p2', 'p2@example.com');
    const table = await emitAck<{ id: string; name: string }>(a, 'table:create', {
      name: 'Play Test',
    });
    const tableId = table?.id;
    expect(tableId).toBeTruthy();

    await emitAck(b, 'table:join', { tableId });
    await emitAck(b, 'play:sit', { tableId });
    await emitAck(a, 'play:load-deck', { tableId, deckId: 'deck-a' });
    await emitAck(b, 'play:load-deck', { tableId, deckId: 'deck-b' });

    const startedA = waitForState(
      a,
      (v) => v.status === 'playing' && Array.isArray(v.seats[0].hand),
    );
    const startedB = waitForState(
      b,
      (v) => v.status === 'playing' && !Array.isArray(v.seats[0].hand),
    );
    await emitAck(a, 'play:start', { tableId });
    const viewA = await startedA;
    const viewB = await startedB;
    expect(viewA.seats[0].hand).toHaveLength(5);
    expect(viewB.seats[0].hand).toEqual({ count: 5 });

    const hand = viewA.seats[0].hand as { instanceId: string; cardId: string }[];
    const moved = waitForState(b, (v) => v.seats[0].pool.length > 0);
    await emitAck(a, 'play:move', { tableId, instanceId: hand[0]?.instanceId, toZone: 'pool' });
    const after = await moved;
    expect(after.seats[0].pool.some((c) => c.cardId === '1st/43')).toBe(true);

    a.close();
    b.close();
  });

  it('enforces turn order and razes a realm on a winning attack', async () => {
    const a = await connect('user-r1', 'r1@example.com');
    const b = await connect('user-r2', 'r2@example.com');
    const table = await emitAck<{ id: string }>(a, 'table:create', { name: 'Combat Test' });
    const tableId = table?.id;
    expect(tableId).toBeTruthy();

    await emitAck(b, 'table:join', { tableId });
    await emitAck(b, 'play:sit', { tableId });
    await emitAck(a, 'play:load-deck', { tableId, deckId: 'deck-a' });
    await emitAck(b, 'play:load-deck', { tableId, deckId: 'deck-b' });

    const started = waitForState(
      a,
      (v) => v.status === 'playing' && Array.isArray(v.seats[0].hand),
    );
    await emitAck(a, 'play:start', { tableId });
    const viewA = await started;
    const champ = (viewA.seats[0].hand as { instanceId: string }[])[0];
    expect(champ).toBeTruthy();

    await expect(
      new Promise<string>((resolve, reject) => {
        b.emit('play:draw', { tableId }, (err: string | null) => {
          if (err) resolve(err);
          else reject(new Error('expected off-turn draw to fail'));
        });
      }),
    ).resolves.toBe('Not your turn');

    await emitAck(a, 'play:move', { tableId, instanceId: champ?.instanceId, toZone: 'pool' });
    await emitAck(a, 'play:pass-turn', { tableId });

    const bobReady = waitForState(
      b,
      (v) => v.status === 'playing' && Array.isArray(v.seats[1].hand),
    );
    await emitAck(b, 'play:sync', { tableId });
    const viewB = await bobReady;
    const realm = (viewB.seats[1].hand as { instanceId: string }[])[0];
    expect(realm).toBeTruthy();
    await emitAck(b, 'play:move', { tableId, instanceId: realm?.instanceId, toZone: 'realms' });
    await emitAck(b, 'play:pass-turn', { tableId });

    const razed = waitForState(a, (v) => v.lastCombat?.razed === true);
    await emitAck(a, 'play:attack', {
      tableId,
      attackerInstanceId: champ?.instanceId,
      targetInstanceId: realm?.instanceId,
    });
    const after = await razed;
    expect(after.phase).toBe(4);
    expect(after.lastCombat).toMatchObject({ attackerBonus: 3, defenderBonus: 0, razed: true });
    expect(after.seats[1].razedInstanceIds).toEqual([realm?.instanceId]);

    a.close();
    b.close();
  });
});
