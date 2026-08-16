import type { Deck } from '@prisma/client';
import { DeckInputSchema, type SavedDeck } from '@spellfire/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';

const ParamsSchema = z.object({ id: z.string().uuid() });

function serialize(deck: Deck): SavedDeck {
  return {
    id: deck.id,
    name: deck.name,
    cards: deck.cards as SavedDeck['cards'],
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };
}

export function registerDeckRoutes(app: FastifyInstance): void {
  const auth = { preHandler: app.authenticate };

  app.get('/api/decks', auth, async (req) => {
    const decks = await prisma.deck.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    return decks.map(serialize);
  });

  app.post('/api/decks', auth, async (req, reply) => {
    const parsed = DeckInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid deck', details: parsed.error.flatten() });
    }
    const deck = await prisma.deck.create({
      data: { userId: req.userId, name: parsed.data.name, cards: parsed.data.cards },
    });
    return reply.code(201).send(serialize(deck));
  });

  app.get('/api/decks/:id', auth, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'Invalid id' });
    const deck = await prisma.deck.findFirst({
      where: { id: params.data.id, userId: req.userId },
    });
    if (!deck) return reply.code(404).send({ error: 'Not found' });
    return serialize(deck);
  });

  app.put('/api/decks/:id', auth, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'Invalid id' });
    const body = DeckInputSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid deck', details: body.error.flatten() });
    }
    const existing = await prisma.deck.findFirst({
      where: { id: params.data.id, userId: req.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    const deck = await prisma.deck.update({
      where: { id: params.data.id },
      data: { name: body.data.name, cards: body.data.cards },
    });
    return serialize(deck);
  });

  app.delete('/api/decks/:id', auth, async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'Invalid id' });
    const result = await prisma.deck.deleteMany({
      where: { id: params.data.id, userId: req.userId },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
}
