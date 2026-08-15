import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';

// A fixed test user; the injected verifier maps its bearer token to this id.
const TEST_USER = randomUUID();
const OTHER_USER = randomUUID();

function tokenFor(userId: string): string {
  return `test-token:${userId}`;
}

const app: FastifyInstance = buildApp({
  verifyToken: async (token) =>
    token.startsWith('test-token:') ? token.slice('test-token:'.length) : null,
});

function authHeader(userId: string) {
  return { authorization: `Bearer ${tokenFor(userId)}` };
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await prisma.deck.deleteMany({ where: { userId: { in: [TEST_USER, OTHER_USER] } } });
  await app.close();
  await prisma.$disconnect();
});

describe('deck API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decks' });
    expect(res.statusCode).toBe(401);
  });

  it('creates, lists, updates, and deletes a deck for the owner', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/decks',
      headers: authHeader(TEST_USER),
      payload: { name: 'Test Deck', cards: [{ cardId: '1st/1', qty: 2 }] },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created.name).toBe('Test Deck');
    expect(created.cards).toEqual([{ cardId: '1st/1', qty: 2 }]);
    const deckId = created.id as string;

    const list = await app.inject({
      method: 'GET',
      url: '/api/decks',
      headers: authHeader(TEST_USER),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((d: { id: string }) => d.id === deckId)).toBe(true);

    const update = await app.inject({
      method: 'PUT',
      url: `/api/decks/${deckId}`,
      headers: authHeader(TEST_USER),
      payload: { name: 'Renamed Deck', cards: [{ cardId: 'FR/2', qty: 1 }] },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().name).toBe('Renamed Deck');
    expect(update.json().cards).toEqual([{ cardId: 'FR/2', qty: 1 }]);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/decks/${deckId}`,
      headers: authHeader(TEST_USER),
    });
    expect(del.statusCode).toBe(204);
  });

  it('rejects an invalid deck payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/decks',
      headers: authHeader(TEST_USER),
      payload: { name: '', cards: [{ cardId: '1st/1', qty: -1 }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("does not expose another user's deck", async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/decks',
      headers: authHeader(OTHER_USER),
      payload: { name: 'Private', cards: [] },
    });
    const deckId = create.json().id as string;

    const get = await app.inject({
      method: 'GET',
      url: `/api/decks/${deckId}`,
      headers: authHeader(TEST_USER),
    });
    expect(get.statusCode).toBe(404);
  });
});
