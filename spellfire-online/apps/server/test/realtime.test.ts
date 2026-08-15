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
});
